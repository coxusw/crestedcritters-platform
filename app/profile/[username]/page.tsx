import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import ProfileQrButton from "@/app/components/isopedia/ProfileQrButton";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  business_name: string | null;
  bio: string | null;
  website_url: string | null;
  facebook_url: string | null;
  created_at: string | null;
};

type PageProps = {
  params: Promise<{
    username: string;
  }>;
};

function getTrustLevel(totalCredits: number) {
  if (totalCredits >= 100) return "Expert Contributor";
  if (totalCredits >= 50) return "Trusted Contributor";
  if (totalCredits >= 20) return "Active Contributor";
  if (totalCredits >= 5) return "Community Contributor";
  if (totalCredits >= 1) return "New Contributor";
  return "Getting Started";
}

function getTrustDescription(totalCredits: number) {
  if (totalCredits >= 100) {
    return "A highly established Isopedia contributor with a strong history of verified community support.";
  }

  if (totalCredits >= 50) {
    return "A trusted contributor with a strong record of helping improve the Isopedia database.";
  }

  if (totalCredits >= 20) {
    return "An active contributor helping build and refine the Isopedia community database.";
  }

  if (totalCredits >= 5) {
    return "A community contributor with growing activity across Isopedia.";
  }

  if (totalCredits >= 1) {
    return "A new contributor who has started helping build Isopedia.";
  }

  return "This profile is ready to start contributing to Isopedia.";
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cleanUsername = username.toLowerCase().trim();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      `
      id,
      username,
      display_name,
      business_name,
      bio,
      website_url,
      facebook_url,
      created_at
    `
    )
    .eq("username", cleanUsername)
    .maybeSingle<Profile>();

  if (error || !profile) {
    notFound();
  }

  const isOwner = user?.id === profile.id;

  const [
    submittedSpecies,
    verifiedSpecies,
    suggestedEdits,
    verifiedEdits,
    imageEdits,
  ] = await Promise.all([
    supabase
      .from("isopedia_submissions")
      .select("id", { count: "exact", head: true })
      .eq("submitted_by", profile.id),

    supabase
      .from("isopedia_submissions")
      .select("id", { count: "exact", head: true })
      .eq("verified_by", profile.id),

    supabase
      .from("isopedia_suggested_edits")
      .select("id", { count: "exact", head: true })
      .eq("suggested_by", profile.id),

    supabase
      .from("isopedia_suggested_edits")
      .select("id", { count: "exact", head: true })
      .eq("verified_by", profile.id),

    supabase
      .from("isopedia_suggested_edits")
      .select("id", { count: "exact", head: true })
      .eq("suggested_by", profile.id)
      .eq("field_name", "image_url"),
  ]);

  const submittedSpeciesCount = submittedSpecies.count || 0;
  const verifiedSpeciesCount = verifiedSpecies.count || 0;
  const suggestedEditsCount = suggestedEdits.count || 0;
  const verifiedEditsCount = verifiedEdits.count || 0;
  const imageEditsCount = imageEdits.count || 0;

  const totalCredits =
    submittedSpeciesCount +
    verifiedSpeciesCount +
    suggestedEditsCount +
    verifiedEditsCount;

  const trustLevel = getTrustLevel(totalCredits);

  const usernameForLinks = profile.username || cleanUsername;

  const publicName =
    profile.display_name || profile.username || "Isopedia Contributor";

  return (
    <main className="min-h-screen bg-[#0c1710] px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/isopedia"
            className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
          >
            ← Back to Isopedia
          </Link>

          <div className="flex flex-wrap gap-2">
            <ProfileQrButton title={publicName} username={usernameForLinks} />

            <Link
              href={`/isopedia/collection/${usernameForLinks}`}
              className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
            >
              View Collection
            </Link>

            <Link
              href="/isopedia/submit"
              className="rounded-xl border border-white/10 bg-[#142318] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#18291d]"
            >
              Submit Species
            </Link>

            {isOwner && (
              <Link
                href="/account"
                className="rounded-xl border border-white/10 bg-[#142318] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#18291d]"
              >
                Edit Profile
              </Link>
            )}
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#142318] shadow-2xl shadow-black/30">
          <div className="bg-gradient-to-br from-emerald-500/20 via-[#142318] to-[#0c1710] p-6 sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-center">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
                  Isopedia Contributor
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
                  {publicName}
                </h1>

                {profile.business_name && (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-emerald-100/45">
                      Business Name
                    </p>

                    <p className="mt-2 text-lg font-bold text-emerald-50">
                      {profile.business_name}
                    </p>
                  </div>
                )}

                <div className="mt-5 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-200">
                  {trustLevel}
                </div>
              </div>

              <div className="grid gap-3">
                <StatHighlight label="Total Credits" value={totalCredits} />
                <StatHighlight label="Images Added" value={imageEditsCount} />
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:p-10 lg:grid-cols-[1fr_340px]">
            <div>
              <h2 className="text-2xl font-bold text-white">About</h2>

              {profile.bio ? (
                <p className="mt-4 whitespace-pre-wrap leading-7 text-emerald-50/75">
                  {profile.bio}
                </p>
              ) : (
                <p className="mt-4 text-emerald-50/50">
                  This contributor has not added a bio yet.
                </p>
              )}

              {isOwner && !profile.bio && (
                <Link
                  href="/account"
                  className="mt-5 inline-flex rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
                >
                  Add Bio
                </Link>
              )}
            </div>

            <aside className="rounded-3xl border border-white/10 bg-[#0b140d]/70 p-5">
              <h2 className="text-lg font-bold text-white">Contributor</h2>

              <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="text-sm font-black text-emerald-200">
                  {trustLevel}
                </p>

                <p className="mt-2 text-sm leading-6 text-emerald-50/60">
                  {getTrustDescription(totalCredits)}
                </p>
              </div>

              <div className="mt-5 grid gap-3">
                <Link
                  href={`/isopedia/collection/${usernameForLinks}`}
                  className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
                >
                  View Collection
                </Link>

                {isOwner && (
                  <Link
                    href="/account"
                    className="rounded-xl border border-white/10 bg-[#142318] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#18291d]"
                  >
                    Edit Profile
                  </Link>
                )}
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
                Contributor Stats
              </p>

              <h2 className="mt-2 text-3xl font-black text-white">
                Community Credits
              </h2>

              <p className="mt-2 text-emerald-50/60">
                Public contribution history for this Isopedia member.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#142318] px-4 py-3 text-sm font-bold text-emerald-100/70">
              {trustLevel}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Species Submitted"
              value={submittedSpeciesCount}
              description="New species info submitted"
            />

            <StatCard
              label="Submissions Verified"
              value={verifiedSpeciesCount}
              description="New species verified"
            />

            <StatCard
              label="Suggested Edits"
              value={suggestedEditsCount}
              description="Corrections or updates suggested"
            />

            <StatCard
              label="Edits Verified"
              value={verifiedEditsCount}
              description="Suggested edits reviewed"
            />

            <StatCard
              label="Images Contributed"
              value={imageEditsCount}
              description="Image suggestions submitted"
            />
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-xl shadow-black/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-emerald-100/50">
                  Total Community Credit
                </p>

                <p className="mt-2 text-4xl font-black text-white">
                  {totalCredits}
                </p>
              </div>

              <Link
                href={`/isopedia/collection/${usernameForLinks}`}
                className="inline-flex rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
              >
                View Collection
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatHighlight({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-100/50">
        {label}
      </p>

      <p className="mt-2 text-4xl font-black text-white">{value}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#142318] p-5 shadow-xl shadow-black/20">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-100/40">
        {label}
      </p>

      <p className="mt-3 text-4xl font-black text-white">{value}</p>

      <p className="mt-2 text-sm leading-5 text-emerald-50/55">
        {description}
      </p>
    </div>
  );
}