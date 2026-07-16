import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { publicSpeciesSlug, storedSpeciesSlug } from "@/lib/isopedia-slugs";
import { awardIsoTokens } from "@/lib/isotokens";
import SuggestedEditInput from "@/app/components/isopedia/SuggestedEditInput";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    submitted?: string;
    count?: string;
    error?: string;
  }>;
};

type Profile = {
  id: string;
  username: string | null;
};

type Species = {
  id: number;
  common_name: string;
  scientific_name: string | null;
  slug: string;
  organism_type: string | null;
  genus: string | null;
  species: string | null;
  morph: string | null;
  trade_names: string | null;
  difficulty: string | null;
  origin: string | null;
  temperature: string | null;
  humidity: string | null;
  diet: string | null;
  substrate: string | null;
  notes: string | null;
  source_info: string | null;
  image_url: string | null;
};

type EditableFieldName =
  | "common_name"
  | "scientific_name"
  | "organism_type"
  | "genus"
  | "species"
  | "morph"
  | "trade_names"
  | "difficulty"
  | "origin"
  | "temperature"
  | "humidity"
  | "diet"
  | "substrate"
  | "notes"
  | "source_info"
  | "image_url";

const EDITABLE_FIELDS: Array<{
  name: EditableFieldName;
  type: "plain" | "rich" | "image";
}> = [
  { name: "common_name", type: "plain" },
  { name: "scientific_name", type: "plain" },
  { name: "organism_type", type: "plain" },
  { name: "genus", type: "plain" },
  { name: "species", type: "plain" },
  { name: "morph", type: "plain" },
  { name: "trade_names", type: "plain" },
  { name: "difficulty", type: "plain" },
  { name: "origin", type: "plain" },
  { name: "temperature", type: "plain" },
  { name: "humidity", type: "plain" },
  { name: "diet", type: "plain" },
  { name: "substrate", type: "plain" },
  { name: "notes", type: "rich" },
  { name: "source_info", type: "plain" },
  { name: "image_url", type: "image" },
];

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOptionalContext(value: FormDataEntryValue | null) {
  const cleaned = cleanText(value);
  return cleaned ? cleaned.slice(0, 2000) : null;
}

function isSuggestedEditContextSchemaError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const message = `${error.code || ""} ${error.message || ""}`.toLowerCase();
  return (
    message.includes("edit_reason") ||
    message.includes("source_info") ||
    message.includes("schema cache")
  );
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function isBlankRichText(value: string) {
  const cleaned = stripHtml(value);
  return !cleaned;
}

function getCurrentValue(species: Species, fieldName: EditableFieldName) {
  return species[fieldName] || "";
}

function valuesMatch(currentValue: string, proposedValue: string, type: "plain" | "rich" | "image") {
  if (type === "rich") {
    return stripHtml(currentValue) === stripHtml(proposedValue);
  }

  return currentValue.trim() === proposedValue.trim();
}

function proposedValueForField(
  formData: FormData,
  field: (typeof EDITABLE_FIELDS)[number]
) {
  const proposedValue = cleanText(formData.get(`field_${field.name}`));

  if (!proposedValue) return "";
  if (field.type === "rich" && isBlankRichText(proposedValue)) return "";

  return proposedValue;
}

async function submitSuggestedEdit(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!profile?.username) {
    redirect("/account?error=profile-required");
  }

  const species_id = Number(formData.get("species_id"));
  const species_slug = cleanText(formData.get("species_slug"));
  const public_species_slug = publicSpeciesSlug(species_slug);
  const edit_reason = cleanOptionalContext(formData.get("edit_reason"));
  const source_info = cleanOptionalContext(formData.get("source_info"));

  if (!species_id || !species_slug) {
    redirect("/?error=missing-species");
  }

  const { data: species } = await supabase
    .from("isopedia_species")
    .select(
      `
      id,
      common_name,
      scientific_name,
      slug,
      organism_type,
      genus,
      species,
      morph,
      trade_names,
      difficulty,
      origin,
      temperature,
      humidity,
      diet,
      substrate,
      notes,
      source_info,
      image_url
    `
    )
    .eq("id", species_id)
    .maybeSingle<Species>();

  if (!species) {
    redirect("/?error=missing-species");
  }

  const updated_at = new Date().toISOString();
  const editRows = EDITABLE_FIELDS.flatMap((field) => {
    const proposed_value = proposedValueForField(formData, field);
    if (!proposed_value) return [];

    const current_value = getCurrentValue(species, field.name);
    if (valuesMatch(current_value, proposed_value, field.type)) return [];

    return [
      {
        species_id,
        suggested_by: user.id,
        field_name: field.name,
        current_value,
        proposed_value,
        edit_reason,
        source_info,
        status: "unverified",
        updated_at,
      },
    ];
  });

  if (!editRows.length) {
    redirect(`/${public_species_slug}/suggest-edit?error=value-required`);
  }

  let insertResult = await supabase
    .from("isopedia_suggested_edits")
    .insert(editRows)
    .select("id")
    .returns<Array<{ id: string }>>();

  if (insertResult.error && isSuggestedEditContextSchemaError(insertResult.error)) {
    const fallbackRows = editRows.map((row) => ({
      species_id: row.species_id,
      suggested_by: row.suggested_by,
      field_name: row.field_name,
      current_value: row.current_value,
      proposed_value: row.proposed_value,
      status: row.status,
      updated_at: row.updated_at,
    }));

    insertResult = await supabase
      .from("isopedia_suggested_edits")
      .insert(fallbackRows)
      .select("id")
      .returns<Array<{ id: string }>>();
  }

  const error = insertResult.error;
  const edits = insertResult.data || [];

  if (error || !edits.length) {
    redirect(`/${public_species_slug}/suggest-edit?error=save-failed`);
  }

  await Promise.all(
    edits.map((edit) =>
      awardIsoTokens(supabase, {
        profileId: user.id,
        amount: 3,
        reason: "suggested_edit_submission",
        reasonKey: `suggested_edit_submission:${edit.id}`,
        description: "Submitted a suggested edit for review.",
        entityType: "suggested_edit",
        entityId: edit.id,
      })
    )
  );

  redirect(
    `/${public_species_slug}/suggest-edit?submitted=true&count=${edits.length}`
  );
}

export default async function SuggestEditPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const lookupSlug = storedSpeciesSlug(slug);
  const query = await searchParams;

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/${slug}/suggest-edit`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!profile?.username) {
    redirect("/account?error=profile-required");
  }

  const { data: species } = await supabase
    .from("isopedia_species")
    .select(
      `
      id,
      common_name,
      scientific_name,
      slug,
      organism_type,
      genus,
      species,
      morph,
      trade_names,
      difficulty,
      origin,
      temperature,
      humidity,
      diet,
      substrate,
      notes,
      source_info,
      image_url
    `
    )
    .eq("slug", lookupSlug)
    .maybeSingle<Species>();

  if (!species) {
    redirect("/");
  }

  const publicSlug = publicSpeciesSlug(species.slug);
  const submittedCount = Number(query.count || 0);
  const submittedLabel =
    submittedCount === 1 ? "Suggested edit" : "Suggested edits";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <Link
            href={`/${publicSlug}`}
            className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
          >
            ← Back to {species.common_name}
          </Link>
        </div>

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
            Community Suggested Edit
          </p>
          <h1 className="mt-2 text-4xl font-bold text-white">
            Suggest an Edit
          </h1>
          <p className="mt-3 max-w-3xl text-slate-300">
            Suggest a correction or improvement for{" "}
            <span className="font-semibold text-white">
              {species.common_name}
            </span>
            . Your edit will stay unverified until another contributor verifies
            it.
          </p>
        </div>

        {query.submitted === "true" && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
            {submittedLabel} submitted.{" "}
            {submittedCount > 1 ? "They are" : "It is"} now waiting for
            another contributor to verify.
          </div>
        )}

        {query.error === "invalid-field" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Please choose a valid field to edit.
          </div>
        )}

        {query.error === "value-required" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Please enter at least one suggested change before submitting.
          </div>
        )}

        {query.error === "save-failed" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Suggested edit could not be saved. Please try again.
          </div>
        )}

        <form
          action={submitSuggestedEdit}
          className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-xl shadow-black/20"
        >
          <input type="hidden" name="species_id" value={species.id} />
          <input type="hidden" name="species_slug" value={species.slug} />

          <SuggestedEditInput species={species} />

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-400">
              Suggesting as{" "}
              <Link
                href={`/profile/${profile.username}`}
                className="font-semibold text-emerald-300 hover:text-emerald-200"
              >
                @{profile.username}
              </Link>
            </p>

            <button
              type="submit"
              className="rounded-xl bg-emerald-400 px-6 py-3 font-bold text-slate-950 transition hover:bg-emerald-300"
            >
              Submit Suggested Edit
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
