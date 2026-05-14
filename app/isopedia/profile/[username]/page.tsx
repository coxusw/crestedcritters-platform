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

type Badge = {
  id: string;
  label: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  is_active: boolean | null;
};

type BadgeAssignment = {
  id: string;
  assigned_at: string | null;
  profile_badges: Badge | null;
};

type PageProps = {
  params: Promise<{
    username: string;
  }>;
};

const badgeColorClasses: Record<string, string> = {
  emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  green: "border-green-400/30 bg-green-400/10 text-green-200",
  lime: "border-lime-400/30 bg-lime-400/10 text-lime-200",
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  yellow: "border-yellow-400/30 bg-yellow-400/10 text-yellow-200",
  orange: "border-orange-400/30 bg-orange-400/10 text-orange-200",
  red: "border-red-400/30 bg-red-400/10 text-red-200",
  rose: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  pink: "border-pink-400/30 bg-pink-400/10 text-pink-200",
  purple: "border-purple-400/30 bg-purple-400/10 text-purple-200",
  violet: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  indigo: "border-indigo-400/30 bg-indigo-400/10 text-indigo-200",
  blue: "border-blue-400/30 bg-blue-400/10 text-blue-200",
  cyan: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  sky: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  slate: "border-slate-400/30 bg-slate-400/10 text-slate-200",
  zinc: "border-zinc-400/30 bg-zinc-400/10 text-zinc-200",
  neutral: "border-neutral-400/30 bg-neutral-400/10 text-neutral-200",
};

function cleanUrl(url: string | null) {
  if (!url) return null;

  const trimmed = url.trim();

  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

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
    badgeAssignments,
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

    supabase
      .from("profile_badge_assignments")
      .select(
        `
        id,
        assigned_at,
        profile_badges:badge_id (
          id,
          label,
          description,
          color,
          icon,
          is_active
        )
      `
      )
      .eq("profile_id", profile.id)
      .order("assigned_at", { ascending: false })
      .returns<BadgeAssignment[]>(),
  ]);

  const assignedBadges =
    badgeAssignments.data
      ?.map((assignment) => assignment.profile_badges)
      .filter((badge): badge is Badge => Boolean(badge && badge.is_active)) ||
    [];

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

  const websiteUrl = cleanUrl(profile.website_url);
  const facebookUrl = cleanUrl(profile.facebook_url);

  const usernameForLinks = profile.username || cleanUsername;

  const publicName =
    profile.display_name ||
    profile.business_name ||
    profile.username ||
    "Isopedia Contributor";

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
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-[#0b140d] text-4xl font-black uppercase text-emerald-300 shadow-xl shadow-black/20">
                  {publicName.charAt(0)}
                </div>

                <div>
                  <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
                    Isopedia Contributor
                  </p>

                  <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
                    {publicName}
                  </h1>

                  {profile.username && (
                    <p className="mt-2 text-emerald-50/70">
                      @{profile.username}
                    </p>
                  )}

                  {profile.business_name && (
                    <p className="mt-4 max-w-2xl text-lg font-semibold text-emerald-50/90">
                      {profile.business_name}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2">
                    <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-200">
                      {trustLevel}
                    </div>

                    {assignedBadges.map((badge) => (
                      <BadgeChip key={badge.id} badge={badge} />
                    ))}
                  </div>
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

              {assignedBadges.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-100/40">
                    Badges
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {assignedBadges.map((badge) => (
                      <BadgeChip key={badge.id} badge={badge} />
                    ))}
                  </div>
                </div>
              )}

              <h2 className="mt-6 text-lg font-bold text-white">Links</h2>

              <div className="mt-4 grid gap-3">
                <Link
                  href={`/isopedia/collection/${usernameForLinks}`}
                  className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
                >
                  View Collection
                </Link>

                {websiteUrl ? (
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-white/10 bg-[#142318] px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-[#18291d]"
                  >
                    Visit Website
                  </a>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-[#142318] px-4 py-3 text-sm text-emerald-50/40">
                    No website listed
                  </div>
                )}

                {facebookUrl ? (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-white/10 bg-[#142318] px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-[#18291d]"
                  >
                    Facebook Page
                  </a>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-[#142318] px-4 py-3 text-sm text-emerald-50/40">
                    No Facebook listed
                  </div>
                )}

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

function BadgeChip({ badge }: { badge: Badge }) {
  const colorKey = badge.color || "emerald";
  const classes =
    badgeColorClasses[colorKey] ||
    "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";

  return (
    <span
      title={badge.description || badge.label}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black shadow-sm ${classes}`}
    >
      {badge.icon && <span aria-hidden="true">{badge.icon}</span>}
      <span>{badge.label}</span>
    </span>
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