import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { publicSpeciesSlug, storedSpeciesSlug } from "@/lib/isopedia-slugs";
import SuggestedEditInput from "@/app/components/isopedia/SuggestedEditInput";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    submitted?: string;
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
  difficulty: string | null;
  origin: string | null;
  temperature: string | null;
  humidity: string | null;
  diet: string | null;
  substrate: string | null;
  notes: string | null;
  image_url: string | null;
};

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
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

function getCurrentValue(species: Species, fieldName: string) {
  if (fieldName === "common_name") return species.common_name;
  if (fieldName === "scientific_name") return species.scientific_name || "";
  if (fieldName === "difficulty") return species.difficulty || "";
  if (fieldName === "origin") return species.origin || "";
  if (fieldName === "temperature") return species.temperature || "";
  if (fieldName === "humidity") return species.humidity || "";
  if (fieldName === "diet") return species.diet || "";
  if (fieldName === "substrate") return species.substrate || "";
  if (fieldName === "notes") return species.notes || "";
  if (fieldName === "image_url") return species.image_url || "";
  return "";
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
  const field_name = cleanText(formData.get("field_name"));
  const proposed_value = cleanText(formData.get("proposed_value"));

  const allowedFields = [
    "common_name",
    "scientific_name",
    "difficulty",
    "origin",
    "temperature",
    "humidity",
    "diet",
    "substrate",
    "notes",
    "image_url",
  ];

  if (!species_id || !species_slug) {
    redirect("/?error=missing-species");
  }

  if (!allowedFields.includes(field_name)) {
    redirect(`/${public_species_slug}/suggest-edit?error=invalid-field`);
  }

  if (!proposed_value || isBlankRichText(proposed_value)) {
    redirect(`/${public_species_slug}/suggest-edit?error=value-required`);
  }

  const { data: species } = await supabase
    .from("isopedia_species")
    .select(
      `
      id,
      common_name,
      scientific_name,
      slug,
      difficulty,
      origin,
      temperature,
      humidity,
      diet,
      substrate,
      notes,
      image_url
    `
    )
    .eq("id", species_id)
    .maybeSingle<Species>();

  if (!species) {
    redirect("/?error=missing-species");
  }

  const current_value = getCurrentValue(species, field_name);

  const { error } = await supabase.from("isopedia_suggested_edits").insert({
    species_id,
    suggested_by: user.id,
    field_name,
    current_value,
    proposed_value,
    status: "unverified",
    updated_at: new Date().toISOString(),
  });

  if (error) {
    redirect(`/${public_species_slug}/suggest-edit?error=save-failed`);
  }

  redirect(`/${public_species_slug}/suggest-edit?submitted=true`);
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
      difficulty,
      origin,
      temperature,
      humidity,
      diet,
      substrate,
      notes,
      image_url
    `
    )
    .eq("slug", lookupSlug)
    .maybeSingle<Species>();

  if (!species) {
    redirect("/");
  }

  const publicSlug = publicSpeciesSlug(species.slug);

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
            Suggested edit submitted. It is now waiting for another contributor
            to verify it.
          </div>
        )}

        {query.error === "invalid-field" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Please choose a valid field to edit.
          </div>
        )}

        {query.error === "value-required" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Please enter a suggested replacement before submitting.
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

          <div className="grid gap-6">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <h2 className="text-lg font-bold text-white">
                Current Species Information
              </h2>

              <div className="mt-4 grid gap-3 text-sm text-slate-300">
                <CurrentValue label="Common Name" value={species.common_name} />
                <CurrentValue
                  label="Scientific Name"
                  value={species.scientific_name}
                />
                <CurrentValue label="Difficulty" value={species.difficulty} />
                <CurrentValue label="Origin" value={species.origin} />
                <CurrentValue label="Temperature" value={species.temperature} />
                <CurrentValue label="Humidity" value={species.humidity} />
                <CurrentValue label="Diet" value={species.diet} />
                <CurrentValue label="Substrate" value={species.substrate} />
                <CurrentValue label="Image URL" value={species.image_url} />
              </div>
            </div>

            <SuggestedEditInput />
          </div>

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

function CurrentValue({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900 p-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words text-slate-200">
        {value || "Not listed"}
      </p>
    </div>
  );
}
