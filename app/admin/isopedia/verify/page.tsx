import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { createSpeciesAnnouncementForSubmission } from "@/lib/content-agent/isopedia";
import { productionIsopediaUrl } from "@/lib/isopedia-site";
import { awardIsoTokens, reverseIsoTokenAwards } from "@/lib/isotokens";

export const dynamic = "force-dynamic";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  business_name: string | null;
  role: string | null;
};

type Submission = {
  id: string;
  organism_type: string | null;
  genus: string | null;
  species: string | null;
  morph: string | null;
  common_name: string;
  scientific_name: string | null;
  difficulty: string | null;
  origin: string | null;
  image_url: string | null;
  submitted_by: string | null;
  verified_by: string | null;
  status: string | null;
  created_at: string | null;
  verified_at: string | null;
  submitter: Profile | null;
  verifier: Profile | null;
};

type SubmissionForDelete = {
  id: string;
  organism_type: string | null;
  genus: string | null;
  species: string | null;
  morph: string | null;
  common_name: string;
  scientific_name: string | null;
  image_url: string | null;
  status: string | null;
};

type PublishedSpeciesForDelete = {
  id: number;
  organism_type: string | null;
  genus: string | null;
  species: string | null;
  morph: string | null;
  common_name: string;
  scientific_name: string | null;
  image_url: string | null;
  created_at: string | null;
};

async function requireIsopediaAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const [{ data: adminProfile }, { data: roleProfile }] = await Promise.all([
    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle(),
  ]);

  if (!adminProfile && roleProfile?.role !== "admin") {
    redirect("/admin/login");
  }

  return user;
}

async function verifyAdminSubmission(formData: FormData) {
  "use server";

  const user = await requireIsopediaAdmin();

  const submissionId = String(formData.get("submission_id") || "");
  const supabase = createSupabaseAdminClient();

  if (!submissionId) redirect("/admin/isopedia/verify?error=missing-submission");

  const { data: submissionForReward } = await supabase
    .from("isopedia_submissions")
    .select("id, submitted_by, status")
    .eq("id", submissionId)
    .maybeSingle<{ id: string; submitted_by: string | null; status: string | null }>();

  if (!submissionForReward) {
    redirect("/admin/isopedia/verify?error=submission-not-found");
  }

  if (submissionForReward.status !== "unverified") {
    revalidateSubmissionPaths();
    redirect("/admin/isopedia/verify?verified=true&already=true");
  }

  const { error } = await supabase.rpc("verify_isopedia_submission", {
    submission_id: submissionId,
  });

  if (error) {
    redirect(
      `/admin/isopedia/verify?error=${encodeURIComponent(
        error.message || "verify-failed"
      )}`
    );
  }

  const { error: creditError } = await supabase
    .from("isopedia_submissions")
    .update({
      verified_by: user.id,
      verified_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (creditError) {
    redirect(
      `/admin/isopedia/verify?error=${encodeURIComponent(
        creditError.message || "verified-but-credit-tracking-failed"
      )}`
    );
  }

  if (submissionForReward.submitted_by) {
    await awardIsoTokens(supabase, {
      profileId: submissionForReward.submitted_by,
      amount: 15,
      reason: "species_verified",
      reasonKey: `species_verified_submitter:${submissionId}`,
      description: "Submitted species was verified and published.",
      entityType: "species_submission",
      entityId: submissionId,
    });

    if (submissionForReward.submitted_by !== user.id) {
      await awardIsoTokens(supabase, {
        profileId: user.id,
        amount: 5,
        reason: "species_verifier",
        reasonKey: `species_verified_reviewer:${submissionId}`,
        description: "Verified a community species submission.",
        entityType: "species_submission",
        entityId: submissionId,
      });
    }
  }

  try {
    await createSpeciesAnnouncementForSubmission(submissionId);
  } catch (autoPostError) {
    console.error("Failed to auto-create Isopedia species announcement:", autoPostError);
  }

  revalidateSubmissionPaths();
  redirect("/admin/isopedia/verify?verified=true");
}

async function rejectAdminSubmission(formData: FormData) {
  "use server";

  await requireIsopediaAdmin();

  const submissionId = String(formData.get("submission_id") || "");
  const supabase = createSupabaseAdminClient();

  if (!submissionId) redirect("/admin/isopedia/verify?error=missing-submission");

  const { error } = await supabase.rpc("reject_isopedia_submission", {
    submission_id: submissionId,
  });

  if (error) {
    redirect(
      `/admin/isopedia/verify?error=${encodeURIComponent(
        error.message || "reject-failed"
      )}`
    );
  }

  revalidateSubmissionPaths();
  redirect("/admin/isopedia/verify?rejected=true");
}

async function deleteAdminSubmission(formData: FormData) {
  "use server";

  await requireIsopediaAdmin();

  const submissionId = String(formData.get("submission_id") || "");
  const status = String(formData.get("status") || "");
  const supabase = createSupabaseAdminClient();

  if (!submissionId) redirect("/admin/isopedia/verify?error=missing-submission");

  const { data: submissionForDelete, error: readError } = await supabase
    .from("isopedia_submissions")
    .select(
      `
      id,
      organism_type,
      genus,
      species,
      morph,
      common_name,
      scientific_name,
      image_url,
      status
    `
    )
    .eq("id", submissionId)
    .maybeSingle<SubmissionForDelete>();

  if (readError) {
    redirect(
      `/admin/isopedia/verify?error=${encodeURIComponent(
        readError.message || "submission-read-failed"
      )}`
    );
  }

  if (!submissionForDelete) {
    redirect("/admin/isopedia/verify?error=submission-not-found");
  }

  let deletedPublishedSpecies = false;

  if (submissionForDelete.status === "verified") {
    let matchingSpecies: PublishedSpeciesForDelete | undefined;

    try {
      matchingSpecies = await findPublishedSpeciesForSubmission(
        supabase,
        submissionForDelete
      );
    } catch (matchError) {
      const message =
        matchError instanceof Error ? matchError.message : "published-species-match-failed";
      redirect(
        `/admin/isopedia/verify?error=${encodeURIComponent(
          `Could not check matching published species: ${message}`
        )}`
      );
    }

    if (matchingSpecies) {
      const { error: speciesDeleteError } = await supabase
        .from("isopedia_species")
        .delete()
        .eq("id", matchingSpecies.id);

      if (speciesDeleteError) {
        redirect(
          `/admin/isopedia/verify?error=${encodeURIComponent(
            speciesDeleteError.message || "published-species-delete-failed"
          )}`
        );
      }

      deletedPublishedSpecies = true;
    }
  }

  const { error } = await supabase
    .from("isopedia_submissions")
    .delete()
    .eq("id", submissionId);

  if (error) {
    redirect(
      `/admin/isopedia/verify?error=${encodeURIComponent(
        error.message || "delete-failed"
      )}`
    );
  }

  try {
    await reverseIsoTokenAwards({
      reasonKeys: [
        `species_submission:${submissionId}`,
        `species_verified_submitter:${submissionId}`,
        `species_verified_reviewer:${submissionId}`,
      ],
      description: `Submission ${submissionId} was deleted by an admin.`,
    });
  } catch (reversalError) {
    const message =
      reversalError instanceof Error ? reversalError.message : "token-reversal-failed";
    redirect(
      `/admin/isopedia/verify?error=${encodeURIComponent(
        `Submission deleted, but IsoToken reversal failed: ${message}`
      )}`
    );
  }

  revalidateSubmissionPaths();
  redirect(
    `/admin/isopedia/verify?deleted=true${
      status ? `&deletedStatus=${encodeURIComponent(status)}` : ""
    }${deletedPublishedSpecies ? "&deletedSpecies=true" : ""
    }`
  );
}

export default async function AdminVerifySubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    verified?: string;
    rejected?: string;
    deleted?: string;
    deletedStatus?: string;
    deletedSpecies?: string;
    error?: string;
  }>;
}) {
  await requireIsopediaAdmin();

  const params = await searchParams;
  const supabase = createSupabaseAdminClient();
  const { data: submissions, error } = await supabase
    .from("isopedia_submissions")
    .select(
      `
      id,
      organism_type,
      genus,
      species,
      morph,
      common_name,
      scientific_name,
      difficulty,
      origin,
      image_url,
      submitted_by,
      verified_by,
      status,
      created_at,
      verified_at,
      submitter:submitted_by (
        id,
        username,
        display_name,
        business_name,
        role
      ),
      verifier:verified_by (
        id,
        username,
        display_name,
        business_name,
        role
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<Submission[]>();

  if (error) throw new Error(error.message);

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="text-emerald-300 underline" href="/admin/isopedia/review">
            Back to Review Queues
          </Link>
          <Link className="text-emerald-300 underline" href="/admin/isopedia">
            Isopedia Admin
          </Link>
          <Link className="text-emerald-300 underline" href="/isopedia/verify">
            Public Pending Queue
          </Link>
        </div>

        <header className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
            Species Submissions
          </p>
          <h1 className="mt-2 text-3xl font-black">Admin Submission Manager</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Review pending species submissions and remove bogus or duplicate
            submissions after verification. Deleting a submission also reverses
            the IsoTokens awarded for that submission and its verification.
          </p>
        </header>

        {params.verified === "true" && (
          <Notice tone="good">Submission verified and published.</Notice>
        )}
        {params.rejected === "true" && (
          <Notice tone="bad">Submission rejected.</Notice>
        )}
        {params.deleted === "true" && (
          <Notice tone="bad">
            Submission deleted
            {params.deletedStatus ? ` (${params.deletedStatus})` : ""}. Related
            IsoToken awards were reversed.
            {params.deletedSpecies === "true"
              ? " The matching published species entry was also removed."
              : ""}
          </Notice>
        )}
        {params.error && <Notice tone="bad">{decodeURIComponent(params.error)}</Notice>}

        {!submissions?.length ? (
          <section className="rounded-lg border border-white/10 bg-white/[0.05] p-8 text-center">
            <h2 className="text-2xl font-black">No submissions found</h2>
            <p className="mt-2 text-sm text-slate-300">
              The submission table is currently empty.
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            {submissions.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function SubmissionCard({ submission }: { submission: Submission }) {
  const submitterName = profileName(submission.submitter);
  const verifierName = profileName(submission.verifier);
  const status = submission.status || "unknown";
  const isUnverified = status === "unverified";
  const publishedSearchUrl = `${productionIsopediaUrl}/?q=${encodeURIComponent(
    submission.common_name
  )}`;

  return (
    <article
      id={`submission-${submission.id}`}
      className="grid gap-5 rounded-lg border border-white/10 bg-white/[0.05] p-5 md:grid-cols-[190px_1fr]"
    >
      <div>
        {submission.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={submission.image_url}
            alt={submission.common_name}
            className="h-44 w-full rounded-lg object-cover"
          />
        ) : (
          <div className="grid h-44 place-items-center rounded-lg bg-black/30 text-sm text-slate-400">
            No image
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={`text-xs font-black uppercase tracking-[0.22em] ${statusClass(status)}`}>
              {status}
            </p>
            <h2 className="mt-1 text-2xl font-black">{submission.common_name}</h2>
            {submission.scientific_name && (
              <p className="italic text-slate-300">{submission.scientific_name}</p>
            )}
          </div>
          <Link
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-emerald-200 hover:bg-white/10"
            href={publishedSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Search Published
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <InfoCard label="Type" value={submission.organism_type} />
          <InfoCard
            label="Classification"
            value={[submission.genus, submission.species, submission.morph]
              .filter(Boolean)
              .join(" ")}
          />
          <InfoCard label="Difficulty" value={submission.difficulty} />
          <InfoCard label="Origin" value={submission.origin} />
          <InfoCard label="Submitted By" value={submitterName} />
          <InfoCard label="Verified By" value={verifierName} />
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          {isUnverified && (
            <>
              <form action={verifyAdminSubmission}>
                <input type="hidden" name="submission_id" value={submission.id} />
                <button className="rounded-md bg-emerald-400 px-4 py-2 font-black text-slate-950 hover:bg-emerald-300">
                  Verify & Publish
                </button>
              </form>
              <form action={rejectAdminSubmission}>
                <input type="hidden" name="submission_id" value={submission.id} />
                <button className="rounded-md bg-amber-400 px-4 py-2 font-black text-slate-950 hover:bg-amber-300">
                  Reject
                </button>
              </form>
            </>
          )}
          <form action={deleteAdminSubmission}>
            <input type="hidden" name="submission_id" value={submission.id} />
            <input type="hidden" name="status" value={status} />
            <button className="rounded-md bg-red-500 px-4 py-2 font-black text-white hover:bg-red-400">
              Delete Submission
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}

function InfoCard({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <div className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm text-slate-200">{value || "Not provided"}</div>
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "good" | "bad";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border p-4 text-sm font-bold ${
        tone === "good"
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
          : "border-red-400/30 bg-red-500/10 text-red-100"
      }`}
    >
      {children}
    </div>
  );
}

function profileName(profile: Profile | null) {
  if (!profile) return null;
  return profile.display_name || profile.business_name || profile.username;
}

function normalizeMatchValue(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function sameMatchValue(
  left: string | null | undefined,
  right: string | null | undefined
) {
  return normalizeMatchValue(left) === normalizeMatchValue(right);
}

function canonicalImageUrl(value: string | null | undefined) {
  if (!value) return "";

  try {
    const parsed = new URL(value);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return value.split("?")[0].split("#")[0];
  }
}

function isPublishedSpeciesMatch(
  submission: SubmissionForDelete,
  species: PublishedSpeciesForDelete
) {
  const submissionImageUrl = canonicalImageUrl(submission.image_url);
  const speciesImageUrl = canonicalImageUrl(species.image_url);
  const imageMatches = submissionImageUrl
    ? submissionImageUrl === speciesImageUrl
    : !speciesImageUrl;

  return (
    imageMatches &&
    sameMatchValue(submission.common_name, species.common_name) &&
    sameMatchValue(submission.scientific_name, species.scientific_name) &&
    sameMatchValue(submission.organism_type, species.organism_type) &&
    sameMatchValue(submission.genus, species.genus) &&
    sameMatchValue(submission.species, species.species) &&
    sameMatchValue(submission.morph, species.morph)
  );
}

async function findPublishedSpeciesForSubmission(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  submission: SubmissionForDelete
) {
  const { data: candidates, error } = await supabase
    .from("isopedia_species")
    .select(
      `
      id,
      organism_type,
      genus,
      species,
      morph,
      common_name,
      scientific_name,
      image_url,
      created_at
    `
    )
    .eq("common_name", submission.common_name)
    .order("created_at", { ascending: false })
    .returns<PublishedSpeciesForDelete[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (candidates || []).find((candidate) =>
    isPublishedSpeciesMatch(submission, candidate)
  );
}

function statusClass(status: string) {
  if (status === "verified") return "text-emerald-300";
  if (status === "rejected") return "text-red-300";
  if (status === "unverified") return "text-amber-300";
  return "text-slate-300";
}

function revalidateSubmissionPaths() {
  revalidatePath("/admin/isopedia/verify");
  revalidatePath("/admin/isopedia/review");
  revalidatePath("/admin/isopedia");
  revalidatePath("/isopedia/verify");
  revalidatePath("/isopedia/review");
  revalidatePath("/isopedia");
  revalidatePath("/");
}
