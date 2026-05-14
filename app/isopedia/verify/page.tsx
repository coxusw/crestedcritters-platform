import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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

  const { error } = await supabase.rpc("verify_isopedia_submission", {
    submission_id: submissionId,
  });

  if (error) {
    redirect(
      `/isopedia/verify?error=${encodeURIComponent(
        error.message || "verify-failed"
      )}`
    );
  }

  revalidatePath("/isopedia/review");
  revalidatePath("/isopedia/verify");
  revalidatePath("/isopedia");

  redirect("/isopedia/verify?verified=true");
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
      `/isopedia/verify?error=${encodeURIComponent(
        error.message || "reject-failed"
      )}`
    );
  }

  revalidatePath("/isopedia/review");
  revalidatePath("/isopedia/verify");

  redirect("/isopedia/verify?rejected=true");
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
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/isopedia/verify");
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

  const isAdmin =
    currentProfile.role === "admin" || Boolean(adminProfile);

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
    <main className="min-h-screen bg-[#0c1710] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/isopedia/review"
            className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
          >
            ← Back to Review Queue
          </Link>

          <Link
            href="/isopedia"
            className="rounded-xl border border-white/10 bg-[#142318] px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-[#18291d]"
          >
            Browse Species
          </Link>
        </div>

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
            Species Verification
          </p>

          <h1 className="mt-2 text-4xl font-black text-white">
            Verify Species Submissions
          </h1>

          <p className="mt-3 max-w-3xl text-slate-300">
            Review new community species submissions before they are published
            to Isopedia.
          </p>

          {isStaff && (
            <div className="mt-4 inline-flex rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-200">
              {isAdmin ? "Admin Mode Enabled" : "Moderator Mode Enabled"}
            </div>
          )}
        </div>

        {params.verified === "true" && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
            Submission verified and published.
          </div>
        )}

        {params.rejected === "true" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Submission rejected.
          </div>
        )}

        {params.error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {decodeURIComponent(params.error)}
          </div>
        )}

        {!submissions || submissions.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[#142318] p-8 text-center shadow-xl shadow-black/20">
            <h2 className="text-2xl font-bold text-white">
              No submissions waiting
            </h2>

            <p className="mt-3 text-slate-400">
              There are currently no unverified species submissions.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
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
                  className="overflow-hidden rounded-3xl border border-white/10 bg-[#142318] shadow-xl shadow-black/20"
                >
                  <div className="grid gap-0 lg:grid-cols-[420px_1fr]">
                    <div className="border-b border-white/10 bg-[#0b140d] p-4 lg:border-b-0 lg:border-r">
                      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-[#0c1710]">
                        {submission.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={submission.image_url}
                            alt={submission.common_name}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="px-6 text-center text-sm text-slate-500">
                            No image submitted.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
                            Unverified Submission
                          </p>

                          <h2 className="mt-2 text-3xl font-black text-white">
                            {submission.common_name}
                          </h2>

                          {submission.scientific_name && (
                            <p className="mt-2 italic text-slate-400">
                              {submission.scientific_name}
                            </p>
                          )}

                          <p className="mt-3 text-sm text-slate-400">
                            Submitted by{" "}
                            {submission.profiles?.username ? (
                              <Link
                                href={`/isopedia/profile/${submission.profiles.username}`}
                                className="font-semibold text-emerald-300 hover:text-emerald-200"
                              >
                                {contributorName}
                              </Link>
                            ) : (
                              contributorName
                            )}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <form action={verifySubmission}>
                            <input
                              type="hidden"
                              name="submission_id"
                              value={submission.id}
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
                              {canVerify
                                ? "Verify & Publish"
                                : "Your Submission"}
                            </button>
                          </form>

                          {isStaff && (
                            <form action={rejectSubmission}>
                              <input
                                type="hidden"
                                name="submission_id"
                                value={submission.id}
                              />

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

                      <div className="grid gap-4 sm:grid-cols-2">
                        <InfoCard
                          label="Type"
                          value={submission.organism_type}
                        />

                        <InfoCard
                          label="Difficulty"
                          value={submission.difficulty}
                        />

                        <InfoCard label="Genus" value={submission.genus} />

                        <InfoCard label="Species" value={submission.species} />

                        <InfoCard label="Morph" value={submission.morph} />

                        <InfoCard
                          label="Trade Names"
                          value={submission.trade_names}
                        />

                        <InfoCard
                          label="Temperature"
                          value={submission.temperature}
                        />

                        <InfoCard
                          label="Humidity"
                          value={submission.humidity}
                        />

                        <InfoCard label="Diet" value={submission.diet} />

                        <InfoCard
                          label="Substrate"
                          value={submission.substrate}
                        />
                      </div>

                      {submission.notes && (
                        <div className="mt-5 rounded-2xl border border-white/10 bg-[#0b140d]/70 p-5">
                          <h3 className="mb-3 text-lg font-bold text-white">
                            Care Notes
                          </h3>

                          <div className="whitespace-pre-wrap text-slate-300">
                            {submission.notes}
                          </div>
                        </div>
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

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b140d]/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>

      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-100">
        {value || "Not provided"}
      </p>
    </div>
  );
}