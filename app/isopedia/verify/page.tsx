import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSpeciesAnnouncementForSubmission } from "@/lib/content-agent/isopedia";
import { awardIsoTokens } from "@/lib/isotokens";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import VerifySubmitButton from "@/app/components/isopedia/VerifySubmitButton";

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
  trade_names: string | null;
  common_name: string;
  scientific_name: string | null;
  difficulty: string | null;
  origin: string | null;
  temperature: string | null;
  humidity: string | null;
  diet: string | null;
  substrate: string | null;
  notes: string | null;
  image_url: string | null;
  submitted_by: string | null;
  created_at: string | null;
  profiles: Profile | null;
};

async function verifySubmission(formData: FormData) {
  "use server";

  const submissionId = String(formData.get("submission_id") || "");
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/verify");
  }

  const { data: submissionForReward } = await supabase
    .from("isopedia_submissions")
    .select("id, submitted_by, status")
    .eq("id", submissionId)
    .maybeSingle<{ id: string; submitted_by: string | null; status: string | null }>();

  if (!submissionForReward) {
    redirect("/verify?error=submission-not-found");
  }

  if (submissionForReward.status !== "unverified") {
    revalidatePath("/verify");
    revalidatePath("/isopedia/verify");
    revalidatePath("/admin/isopedia/verify");
    redirect("/verify?verified=true&already=true");
  }

  const { error } = await supabase.rpc("verify_isopedia_submission", {
    submission_id: submissionId,
  });

  if (error) {
    redirect(
      `/verify?error=${encodeURIComponent(
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
      `/verify?error=${encodeURIComponent(
        creditError.message || "verified-but-credit-tracking-failed"
      )}`
    );
  }

  if (submissionForReward?.submitted_by) {
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

  revalidatePath("/review");
  revalidatePath("/isopedia/review");
  revalidatePath("/verify");
  revalidatePath("/isopedia/verify");
  revalidatePath("/admin/isopedia/verify");
  revalidatePath("/");
  revalidatePath("/admin/isopedia");
  revalidatePath("/admin/isopedia/review");
  revalidatePath("/admin/content-agent");
  redirect("/verify?verified=true");
}

async function rejectSubmission(formData: FormData) {
  "use server";

  const submissionId = String(formData.get("submission_id") || "");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("reject_isopedia_submission", {
    submission_id: submissionId,
  });

  if (error) {
    redirect(
      `/verify?error=${encodeURIComponent(
        error.message || "reject-failed"
      )}`
    );
  }

  revalidatePath("/review");
  revalidatePath("/isopedia/review");
  revalidatePath("/verify");
  revalidatePath("/isopedia/verify");
  revalidatePath("/admin/isopedia/verify");
  revalidatePath("/admin/isopedia");
  redirect("/verify?rejected=true");
}

export default async function VerifySubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    verified?: string;
    rejected?: string;
    error?: string;
  }>;
}) {
  noStore();

  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/verify");
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("id, username, role")
    .eq("id", user.id)
    .maybeSingle();

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

  const { data: submissions } = await supabase
    .from("isopedia_submissions")
    .select(
      `
      id,
      organism_type,
      genus,
      species,
      morph,
      trade_names,
      common_name,
      scientific_name,
      difficulty,
      origin,
      temperature,
      humidity,
      diet,
      substrate,
      notes,
      image_url,
      submitted_by,
      created_at,
      profiles:submitted_by (
        id,
        username,
        display_name,
        business_name,
        role
      )
    `
    )
    .eq("status", "unverified")
    .order("created_at", { ascending: true })
    .returns<Submission[]>();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <IsopediaNav active="review" />

        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="text-emerald-300 underline" href="/review">
            Back to Review Queue
          </Link>
          <Link className="text-emerald-300 underline" href="/">
            Browse Species
          </Link>
        </div>

        <header className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
            Species Verification
          </p>
          <h1 className="mt-2 text-3xl font-bold">Verify Species Submissions</h1>
          <p className="mt-3 text-slate-300">
            Review new community species submissions before they are published
            to Isopedia.
          </p>
        </header>

        {isStaff && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            {isAdmin ? "Admin Mode Enabled" : "Moderator Mode Enabled"}
          </div>
        )}

        {params.verified === "true" && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-100">
            Submission verified, published to Isopedia, and sent to the Isopedia smart poster.
          </div>
        )}

        {params.rejected === "true" && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-100">
            Submission rejected.
          </div>
        )}

        {params.error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-100">
            {decodeURIComponent(params.error)}
          </div>
        )}

        {!submissions || submissions.length === 0 ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <h2 className="text-2xl font-bold">No submissions waiting</h2>
            <p className="mt-2 text-slate-300">
              There are currently no unverified species submissions.
            </p>
          </section>
        ) : (
          <section className="space-y-5">
            {submissions.map((submission) => {
              const contributorName =
                submission.profiles?.display_name ||
                submission.profiles?.business_name ||
                submission.profiles?.username ||
                "Unknown contributor";

              const canVerify = isAdmin || submission.submitted_by !== user.id;

              return (
                <article
                  key={submission.id}
                  className="grid gap-5 rounded-3xl border border-white/10 bg-white/5 p-5 md:grid-cols-[220px_1fr]"
                >
                  <div>
                    {submission.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={submission.image_url}
                        alt={submission.common_name}
                        className="h-52 w-full rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="grid h-52 place-items-center rounded-2xl bg-slate-900 text-sm text-slate-400">
                        No image submitted.
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-amber-300">
                        Unverified Submission
                      </p>
                      <h2 className="mt-1 text-2xl font-bold">
                        {submission.common_name}
                      </h2>
                      {submission.scientific_name && (
                        <p className="italic text-slate-300">
                          {submission.scientific_name}
                        </p>
                      )}
                      <p className="mt-2 text-sm text-slate-400">
                        Submitted by{" "}
                        {submission.profiles?.username ? (
                          <Link
                            className="text-emerald-300 underline"
                            href={`/profile/${submission.profiles.username}`}
                          >
                            {contributorName}
                          </Link>
                        ) : (
                          contributorName
                        )}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoCard label="Type" value={submission.organism_type} />
                      <InfoCard label="Difficulty" value={submission.difficulty} />
                      <InfoCard label="Origin" value={submission.origin} />
                      <InfoCard label="Temperature" value={submission.temperature} />
                      <InfoCard label="Humidity" value={submission.humidity} />
                      <InfoCard label="Diet" value={submission.diet} />
                      <InfoCard label="Substrate" value={submission.substrate} />
                      <InfoCard
                        label="Classification"
                        value={[submission.genus, submission.species, submission.morph]
                          .filter(Boolean)
                          .join(" ")}
                      />
                    </div>

                    {submission.notes && (
                      <div className="rounded-2xl bg-slate-900/80 p-4">
                        <h3 className="font-semibold text-emerald-200">
                          Care Notes
                        </h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                          {submission.notes}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      {canVerify ? (
                        <form action={verifySubmission}>
                          <input
                            type="hidden"
                            name="submission_id"
                            value={submission.id}
                          />
                          <VerifySubmitButton>
                            Verify & Publish
                          </VerifySubmitButton>
                        </form>
                      ) : (
                        <span className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-400">
                          Your Submission
                        </span>
                      )}

                      {isStaff && (
                        <form action={rejectSubmission}>
                          <input
                            type="hidden"
                            name="submission_id"
                            value={submission.id}
                          />
                          <button className="rounded-2xl bg-red-500 px-4 py-2 font-bold text-white">
                            Reject
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-2xl bg-slate-900/80 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-200">{value || "Not provided"}</div>
    </div>
  );
}
