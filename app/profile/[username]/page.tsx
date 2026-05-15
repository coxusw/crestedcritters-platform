import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import ProfileQrButton from "@/app/components/isopedia/ProfileQrButton";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";

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

function getTrustLevel(totalCredits: number) {
  if (totalCredits >= 100) return "Expert Contributor";
  if (totalCredits >= 50) return "Trusted Contributor";
  if (totalCredits >= 20) return "Active Contributor";
  if (totalCredits >= 5) return "Community Contributor";
  if (totalCredits >= 1) return "New Contributor";
  return "Getting Started";
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
  const usernameForLinks = profile.username || cleanUsername;

  const publicName =
    profile.display_name ||
    profile.business_name ||
    profile.username ||
    "Isopedia Contributor";

  const businessName =
    profile.business_name && profile.business_name !== publicName
      ? profile.business_name
      : null;

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <IsopediaNav active="profile" />

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#102016] shadow-2xl shadow-black/30">
          <div className="bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_38%),linear-gradient(135deg,rgba(6,78,59,0.55),rgba(7,19,12,0.95))] px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
            <div className="mx-auto max-w-5xl text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-300 sm:text-xs sm:tracking-[0.35em]">
                Isopedia Contributor
              </p>

              <h1 className="mt-3 break-words text-4xl font-black tracking-tight text-white sm:mt-4 sm:text-5xl lg:text-6xl">
                {publicName}
              </h1>

              {businessName && (
                <p className="mx-auto mt-4 max-w-3xl break-words text-base font-bold leading-7 text-emerald-300 sm:text-lg">
                  Business: {businessName}
                </p>
              )}

              <div className="mt-5 flex flex-wrap justify-center gap-2 sm:mt-6">
                <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-200">
                  {trustLevel}
                </div>

                {assignedBadges.map((badge) => (
                  <BadgeChip key={badge.id} badge={badge} />
                ))}
              </div>

              {profile.bio ? (
                <p className="mx-auto mt-6 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-emerald-50/80 sm:mt-8 sm:text-base lg:text-lg">
                  {profile.bio}
                </p>
              ) : (
                <p className="mx-auto mt-6 max-w-3xl text-sm leading-7 text-emerald-50/50 sm:mt-8 sm:text-base lg:text-lg">
                  This contributor has not added a bio yet.
                </p>
              )}

              <div
                className={`mx-auto mt-7 grid max-w-5xl gap-3 sm:gap-4 ${
                  isOwner ? "sm:grid-cols-3" : "sm:max-w-3xl sm:grid-cols-2"
                }`}
              >
                <ProfileQrButton title={publicName} username={usernameForLinks} />

                <Link
                  href={`/isopedia/collection/${usernameForLinks}`}
                  className="flex min-h-12 items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-emerald-300 sm:py-4 sm:text-base"
                >
                  View Collection
                </Link>

                {isOwner && (
                  <Link
                    href="/account"
                    className="flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-black/30 sm:py-4 sm:text-base"
                  >
                    Edit Profile
                  </Link>
                )}
              </div>

              <div className="mx-auto mt-7 grid max-w-5xl gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4">
                <StatHighlight label="Total Credits" value={totalCredits} />
                <StatHighlight label="Images Added" value={imageEditsCount} />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-[#102016] p-4 shadow-xl shadow-black/20 sm:mt-8 sm:p-6 lg:p-8">
          <h2 className="text-center text-2xl font-black text-white sm:text-left sm:text-3xl">
            Contributor Stats
          </h2>

          <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-[#07130c]/70 sm:mt-6">
            <InlineStat
              icon="🪲"
              label="Species Submitted"
              value={submittedSpeciesCount}
            />
            <InlineStat
              icon="🛡️"
              label="Submissions Verified"
              value={verifiedSpeciesCount}
            />
            <InlineStat
              icon="✎"
              label="Suggested Edits"
              value={suggestedEditsCount}
            />
            <InlineStat
              icon="🛡️"
              label="Edits Verified"
              value={verifiedEditsCount}
            />
            <InlineStat
              icon="🖼️"
              label="Images Contributed"
              value={imageEditsCount}
            />
          </div>
        </section>

        <p className="mt-6 text-center text-sm leading-6 text-emerald-100/60 sm:mt-8">
          ♡ Thank you for helping build and improve Isopedia!
        </p>
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
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center shadow-xl shadow-black/20 sm:rounded-3xl sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300/80 sm:text-xs sm:tracking-[0.25em]">
        {label}
      </p>

      <p className="mt-2 text-4xl font-black text-white sm:mt-4 sm:text-5xl">
        {value}
      </p>
    </div>
  );
}

function InlineStat({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  return (
    <div className="grid grid-cols-[36px_1fr_auto] items-center gap-3 border-b border-white/10 px-4 py-4 last:border-b-0 sm:grid-cols-[48px_1fr_auto] sm:gap-4 sm:px-7 sm:py-5">
      <div className="text-xl text-emerald-300 sm:text-2xl">{icon}</div>

      <p className="text-sm font-bold leading-5 text-emerald-50/80 sm:text-lg">
        {label}
      </p>

      <p className="text-2xl font-black text-white sm:text-3xl">{value}</p>
    </div>
  );
}