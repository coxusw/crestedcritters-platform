import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sanitizeHtml from "sanitize-html";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { awardIsoTokens } from "@/lib/isotokens";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  business_name: string | null;
  role: string | null;
};

type Species = {
  id: number;
  common_name: string;
  slug: string;
};

type SuggestedEdit = {
  id: string;
  species_id: number;
  suggested_by: string;
  verified_by: string | null;
  field_name: string;
  current_value: string | null;
  proposed_value: string;
  status: string;
  created_at: string | null;
  profiles: Profile | null;
  isopedia_species: Species | null;
};

function fieldLabel(fieldName: string) {
  const labels: Record<string, string> = {
    common_name: "Common Name",
    scientific_name: "Scientific Name",
    difficulty: "Difficulty",
    origin: "Origin",
    temperature: "Temperature",
    humidity: "Humidity",
    diet: "Diet",
    substrate: "Substrate",
    notes: "Care Notes",
    image_url: "Image",
    organism_type: "Type",
    genus: "Genus",
    species: "Species",
    morph: "Morph",
    trade_names: "Trade Names",
  };

  return labels[fieldName] || fieldName;
}

function cleanRichText(html: string | null) {
  if (!html) return "";

  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "h1",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "hr",
      "span",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      span: ["style"],
      p: ["style"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    },
  });
}

async function verifySuggestedEdit(formData: FormData) {
  "use server";

  const editId = String(formData.get("edit_id") || "");
  const speciesSlug = String(formData.get("species_slug") || "");

  const supabase = await createSupabaseServerClient();

  if (!editId) {
    redirect("/verify-edits?error=missing-edit");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/verify-edits");
  }

  const { data: editForReward } = await supabase
    .from("isopedia_suggested_edits")
    .select("id, suggested_by")
    .eq("id", editId)
    .maybeSingle<{ id: string; suggested_by: string | null }>();

  const { error } = await supabase.rpc("verify_isopedia_suggested_edit", {
    edit_id: editId,
  });

  if (error) {
    redirect(
      `/verify-edits?error=${encodeURIComponent(
        error.message || "verify-failed"
      )}`
    );
  }

  await supabase
    .from("isopedia_suggested_edits")
    .update({
      verified_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", editId);

  if (editForReward?.suggested_by) {
    await awardIsoTokens(supabase, {
      profileId: editForReward.suggested_by,
      amount: 2,
      reason: "suggested_edit_verified",
      reasonKey: `suggested_edit_verified:${editId}`,
      description: "Suggested edit was verified and applied.",
      entityType: "suggested_edit",
      entityId: editId,
    });

    if (editForReward.suggested_by !== user.id) {
      await awardIsoTokens(supabase, {
        profileId: user.id,
        amount: 5,
        reason: "suggested_edit_verifier",
        reasonKey: `suggested_edit_verified_reviewer:${editId}`,
        description: "Verified a community suggested edit.",
        entityType: "suggested_edit",
        entityId: editId,
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/verify-edits");
  revalidatePath("/review");

  if (speciesSlug) {
    revalidatePath(`/${speciesSlug}`);
  }

  redirect("/verify-edits?verified=true");
}

async function rejectSuggestedEdit(formData: FormData) {
  "use server";

  const editId = String(formData.get("edit_id") || "");

  const supabase = await createSupabaseServerClient();

  if (!editId) {
    redirect("/verify-edits?error=missing-edit");
  }

  const { error } = await supabase.rpc("reject_isopedia_suggested_edit", {
    edit_id: editId,
  });

  if (error) {
    redirect(
      `/verify-edits?error=${encodeURIComponent(
        error.message || "reject-failed"
      )}`
    );
  }

  revalidatePath("/verify-edits");
  revalidatePath("/review");

  redirect("/verify-edits?rejected=true");
}

export default async function VerifySuggestedEditsPage({
  searchParams,
}: {
  searchParams: Promise<{
    verified?: string;
    rejected?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/verify-edits");
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("id, username, role")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!currentProfile?.username) {
    redirect("/account?error=profile-required");
  }

  const { data: adminProfile } = await supabase
    .from("admin_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = currentProfile.role === "admin" || Boolean(adminProfile);
  const isModerator = currentProfile.role === "moderator";
  const isStaff = isAdmin || isModerator;

  const { data: edits } = await supabase
    .from("isopedia_suggested_edits")
    .select(
      `
      id,
      species_id,
      suggested_by,
      verified_by,
      field_name,
      current_value,
      proposed_value,
      status,
      created_at,
      profiles:suggested_by (
        id,
        username,
        display_name,
        business_name,
        role
      ),
      isopedia_species:species_id (
        id,
        common_name,
        slug
      )
    `
    )
    .eq("status", "unverified")
    .order("created_at", { ascending: true })
    .returns<SuggestedEdit[]>();

  return (
    <main className="min-h-screen bg-[#0c1710] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <IsopediaNav active="review" />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/review"
            className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
          >
            Back to Review Queue
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-white/10 bg-[#142318] px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-[#18291d]"
          >
            Browse Species
          </Link>
        </div>

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
            Community Edit Verification
          </p>

          <h1 className="mt-2 text-4xl font-black text-white">
            Verify Suggested Edits
          </h1>

          <p className="mt-3 max-w-3xl text-slate-300">
            Review suggested edits from contributors. Staff can reject edits,
            and admins can verify their own edits.
          </p>

          {isStaff && (
            <div className="mt-4 inline-flex rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-200">
              {isAdmin ? "Admin Mode Enabled" : "Moderator Mode Enabled"}
            </div>
          )}
        </div>

        {params.verified === "true" && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
            Suggested edit verified and applied to the species profile.
          </div>
        )}

        {params.rejected === "true" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Suggested edit rejected.
          </div>
        )}

        {params.error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {decodeURIComponent(params.error)}
          </div>
        )}

        {!edits || edits.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[#142318] p-8 text-center shadow-xl shadow-black/20">
            <h2 className="text-2xl font-bold text-white">
              No suggested edits waiting
            </h2>

            <p className="mt-3 text-slate-400">
              There are currently no unverified suggested edits.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {edits.map((edit) => {
              const suggesterName =
                edit.profiles?.display_name ||
                edit.profiles?.business_name ||
                edit.profiles?.username ||
                "Unknown contributor";

              const canVerify = isAdmin || edit.suggested_by !== user.id;
              const isCareNotes = edit.field_name === "notes";
              const isImage = edit.field_name === "image_url";

              const safeCurrentHtml = isCareNotes
                ? cleanRichText(edit.current_value)
                : "";

              const safeProposedHtml = isCareNotes
                ? cleanRichText(edit.proposed_value)
                : "";

              return (
                <article
                  key={edit.id}
                  className="rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-xl shadow-black/20"
                >
                  <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
                        Unverified Suggested Edit
                      </p>

                      <h2 className="mt-2 text-3xl font-black text-white">
                        {edit.isopedia_species?.common_name ||
                          "Unknown Species"}
                      </h2>

                      <p className="mt-2 text-slate-300">
                        Field:{" "}
                        <span className="font-semibold text-white">
                          {fieldLabel(edit.field_name)}
                        </span>
                      </p>

                      <p className="mt-3 text-sm text-slate-400">
                        Suggested by{" "}
                        {edit.profiles?.username ? (
                          <Link
                            href={`/profile/${edit.profiles.username}`}
                            className="font-semibold text-emerald-300 hover:text-emerald-200"
                          >
                            {suggesterName}
                          </Link>
                        ) : (
                          suggesterName
                        )}
                      </p>

                      {edit.isopedia_species?.slug && (
                        <Link
                          href={`/${edit.isopedia_species.slug}`}
                          className="mt-3 inline-block text-sm font-semibold text-emerald-300 hover:text-emerald-200"
                        >
                          View species page
                        </Link>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <form action={verifySuggestedEdit}>
                        <input type="hidden" name="edit_id" value={edit.id} />

                        <input
                          type="hidden"
                          name="species_slug"
                          value={edit.isopedia_species?.slug || ""}
                        />

                        <button
                          type="submit"
                          disabled={!canVerify}
                          className={
                            canVerify
                              ? "rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-emerald-300"
                              : "cursor-not-allowed rounded-xl bg-slate-700 px-5 py-3 font-bold text-slate-400"
                          }
                        >
                          {canVerify ? "Verify & Apply" : "Your Edit"}
                        </button>
                      </form>

                      {isStaff && (
                        <form action={rejectSuggestedEdit}>
                          <input type="hidden" name="edit_id" value={edit.id} />

                          <button
                            type="submit"
                            className="rounded-xl bg-red-500/20 px-5 py-3 font-bold text-red-200 transition hover:bg-red-500/30"
                          >
                            Reject
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-[#0b140d]/70 p-5">
                      <h3 className="mb-3 text-lg font-bold text-white">
                        Current Value
                      </h3>

                      {isImage && edit.current_value ? (
                        <div className="grid gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={edit.current_value}
                            alt="Current species image"
                            className="max-h-80 w-full rounded-xl object-contain"
                          />

                          <a
                            href={edit.current_value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-emerald-300 hover:text-emerald-200"
                          >
                            Open current image
                          </a>
                        </div>
                      ) : isImage ? (
                        <p className="text-slate-400">
                          No image currently listed.
                        </p>
                      ) : isCareNotes && safeCurrentHtml ? (
                        <div
                          className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-300 prose-a:text-emerald-300 prose-strong:text-white prose-li:text-slate-300"
                          dangerouslySetInnerHTML={{
                            __html: safeCurrentHtml,
                          }}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap break-words text-slate-300">
                          {edit.current_value || "Not listed"}
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                      <h3 className="mb-3 text-lg font-bold text-white">
                        Proposed Value
                      </h3>

                      {isImage ? (
                        <div className="grid gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={edit.proposed_value}
                            alt="Proposed species image"
                            className="max-h-80 w-full rounded-xl object-contain"
                          />

                          <a
                            href={edit.proposed_value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-emerald-300 hover:text-emerald-200"
                          >
                            Open proposed image
                          </a>
                        </div>
                      ) : isCareNotes ? (
                        safeProposedHtml ? (
                          <div
                            className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-300 prose-a:text-emerald-300 prose-strong:text-white prose-li:text-slate-300"
                            dangerouslySetInnerHTML={{
                              __html: safeProposedHtml,
                            }}
                          />
                        ) : (
                          <p className="text-slate-400">No value submitted.</p>
                        )
                      ) : (
                        <p className="whitespace-pre-wrap break-words text-slate-100">
                          {edit.proposed_value || "No value submitted."}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
