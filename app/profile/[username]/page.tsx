import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { absoluteIsopediaUrl } from "@/lib/isopedia-site";
import ProfileQrButton from "@/app/components/isopedia/ProfileQrButton";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  business_name: string | null;
  bio: string | null;
  profile_logo_url: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
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

type CollectionItem = {
  id: string;
  status: "owned" | "wishlist";
  is_public: boolean;
  is_favorite: boolean;
  is_most_wanted: boolean;
  isopedia_species: {
    id: number;
    common_name: string;
    scientific_name: string | null;
    slug: string;
    image_url: string | null;
    difficulty: string | null;
  } | null;
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

function publicProfileName(
  profile: Pick<Profile, "username" | "display_name" | "business_name">
) {
  return profile.display_name || profile.username || "Isopedia User";
}

function cleanUrl(url: string | null) {
  if (!url) return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function instagramUrl(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const handle = trimmed.replace(/^@/, "");
  return `https://instagram.com/${handle}`;
}

function getTrustLevel(isoTokens: number) {
  if (isoTokens >= 100) return "Expert Contributor";
  if (isoTokens >= 50) return "Trusted Contributor";
  if (isoTokens >= 20) return "Active Contributor";
  if (isoTokens >= 5) return "Community Contributor";
  if (isoTokens >= 1) return "New Contributor";
  return "Getting Started";
}

async function getProfileByUsername(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  username: string
) {
  const fullSelect =
    "id, username, display_name, business_name, bio, profile_logo_url, website_url, facebook_url, instagram_url, created_at";

  const query = await supabase
    .from("profiles")
    .select(fullSelect)
    .eq("username", username)
    .maybeSingle<Profile>();

  if (!query.error) return { data: query.data, error: query.error };

  const fallbackQuery = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, business_name, bio, profile_logo_url, website_url, facebook_url, created_at"
    )
    .eq("username", username)
    .maybeSingle<Omit<Profile, "instagram_url">>();

  if (!fallbackQuery.error) {
    return {
      data: fallbackQuery.data
        ? { ...fallbackQuery.data, instagram_url: null }
        : null,
      error: fallbackQuery.error,
    };
  }

  const minimalQuery = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, business_name, bio, website_url, facebook_url, created_at"
    )
    .eq("username", username)
    .maybeSingle<Omit<Profile, "profile_logo_url" | "instagram_url">>();

  return {
    data: minimalQuery.data
      ? {
          ...minimalQuery.data,
          profile_logo_url: null,
          instagram_url: null,
        }
      : null,
    error: minimalQuery.error,
  };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createSupabaseServerClient();
  const cleanUsername = username.toLowerCase().trim();
  const { data: profile } = await getProfileByUsername(supabase, cleanUsername);

  if (!profile) {
    return {
      title: "Profile Not Found | Isopedia",
      robots: { index: false, follow: false },
    };
  }

  const name = publicProfileName(profile);
  const canonical = absoluteIsopediaUrl(`/profile/${profile.username || cleanUsername}`);
  const title = `${name}'s Isopedia Profile | Isopedia`;
  const description =
    profile.bio ||
    `View ${name}'s public Isopedia profile, badges, collection, and IsoTokens.`;
  const image =
    profile.profile_logo_url || absoluteIsopediaUrl("/isopedia-social-preview.jpg");

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "profile",
      images: [{ url: image, alt: `${name} Isopedia profile` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cleanUsername = username.toLowerCase().trim();
  const { data: profile, error } = await getProfileByUsername(
    supabase,
    cleanUsername
  );

  if (error || !profile) notFound();

  const isOwner = user?.id === profile.id;
  const usernameForLinks = profile.username || cleanUsername;
  const publicName = publicProfileName(profile);
  const websiteUrl = cleanUrl(profile.website_url);
  const facebookUrl = cleanUrl(profile.facebook_url);
  const profileInstagramUrl = instagramUrl(profile.instagram_url);

  const [
    submittedSpecies,
    verifiedSpecies,
    suggestedEdits,
    verifiedEdits,
    imageEdits,
    discussionPosts,
    badgeAssignments,
    collectionResult,
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
      .from("isopedia_discussions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("status", "active"),
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
    getCollectionPreview(supabase, profile.id, isOwner),
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
  const discussionPostsCount = discussionPosts.count || 0;
  const isoTokens =
    submittedSpeciesCount +
    verifiedSpeciesCount +
    suggestedEditsCount +
    verifiedEditsCount +
    discussionPostsCount;
  const trustLevel = getTrustLevel(isoTokens);
  const collectionItems = collectionResult.data || [];
  const ownedCount = collectionItems.filter((item) => item.status === "owned").length;
  const wishlistCount = collectionItems.filter((item) => item.status === "wishlist").length;

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <IsopediaNav active="profile" />

        <div className="grid gap-5 lg:grid-cols-[170px_1fr] lg:items-start">
          <aside className="lg:sticky lg:top-6">
            <div className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#102016] p-2 shadow-xl shadow-black/20 lg:grid lg:gap-2">
              <ProfileQrButton title={publicName} username={usernameForLinks} />

              <Link
                href={`/collection/${usernameForLinks}`}
                className="shrink-0 rounded-xl bg-emerald-400 px-3 py-2 text-center text-xs font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Collection
              </Link>

              {isOwner && (
                <Link
                  href="/account"
                  className="shrink-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center text-xs font-black text-white transition hover:bg-black/30"
                >
                  Edit Profile
                </Link>
              )}
            </div>
          </aside>

          <div className="space-y-5">
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#102016] shadow-2xl shadow-black/30">
              <div className="bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_38%),linear-gradient(135deg,rgba(6,78,59,0.55),rgba(7,19,12,0.95))] p-5 sm:p-7">
                <div className="grid gap-5 text-center md:grid-cols-[104px_1fr_auto] md:items-center md:text-left">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#07130c] text-4xl font-black uppercase text-emerald-300 shadow-xl shadow-black/20 md:mx-0">
                    {profile.profile_logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.profile_logo_url}
                        alt={`${publicName} profile logo`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      publicName.charAt(0)
                    )}
                  </div>

                  <div>
                    <h1 className="break-words text-3xl font-black tracking-tight text-white sm:text-5xl">
                      {publicName}
                    </h1>
                  </div>

                  <div className="mx-auto grid w-full max-w-56 grid-cols-2 gap-2 md:mx-0 md:w-56">
                    <MiniMetric label="IsoTokens" value={isoTokens} />
                    <MiniMetric label="Images" value={imageEditsCount} />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200">
                    {trustLevel}
                  </span>
                  {assignedBadges.map((badge) => (
                    <BadgeChip key={badge.id} badge={badge} />
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1fr_300px]">
              <div className="rounded-2xl border border-white/10 bg-[#102016] p-5 text-center shadow-xl shadow-black/20 sm:p-6 xl:text-left">
                <h2 className="text-xl font-black text-white">About</h2>
                {profile.bio ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-emerald-50/75 sm:text-base">
                    {profile.bio}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-emerald-50/50">
                    This contributor has not added a bio yet.
                  </p>
                )}
              </div>

              <aside className="rounded-2xl border border-white/10 bg-[#102016] p-5 shadow-xl shadow-black/20">
                <h2 className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">
                  Links
                </h2>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {facebookUrl && (
                    <SocialButton href={facebookUrl} label="Facebook" kind="facebook" />
                  )}
                  {profileInstagramUrl && (
                    <SocialButton href={profileInstagramUrl} label="Instagram" kind="instagram" />
                  )}
                  {websiteUrl && (
                    <SocialButton href={websiteUrl} label="My Website" kind="website" />
                  )}
                </div>
                {!facebookUrl && !profileInstagramUrl && !websiteUrl && (
                  <p className="mt-3 text-sm leading-6 text-emerald-50/45">
                    No public links yet.
                  </p>
                )}
              </aside>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#102016] p-5 shadow-xl shadow-black/20 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-white">Collection</h2>
                  <p className="mt-1 text-sm text-emerald-50/55">
                    {ownedCount} owned · {wishlistCount} wishlist
                  </p>
                </div>
                <Link
                  href={`/collection/${usernameForLinks}`}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-black text-emerald-200 transition hover:bg-black/30"
                >
                  View All
                </Link>
              </div>

              {collectionItems.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {collectionItems.slice(0, 6).map((item) => {
                    const species = item.isopedia_species;
                    if (!species) return null;

                    return (
                      <Link
                        key={item.id}
                        href={`/${species.slug}`}
                        className="grid grid-cols-[64px_1fr] gap-3 rounded-xl border border-white/10 bg-[#07130c]/70 p-2 transition hover:border-emerald-400/50"
                      >
                        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-black/20">
                          {species.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={species.image_url}
                              alt={species.common_name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-emerald-50/35">
                              No image
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">
                            {species.common_name}
                          </p>
                          {species.scientific_name && (
                            <p className="truncate text-xs italic text-emerald-50/55">
                              {species.scientific_name}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-200">
                              {item.status}
                            </span>
                            {item.is_favorite && (
                              <span className="rounded-full bg-rose-400/10 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-200">
                                Favorite
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-white/10 bg-[#07130c]/70 p-4 text-sm text-emerald-50/50">
                  {isOwner
                    ? "Your public collection preview is empty. Add species from Isopedia pages."
                    : "This contributor has not made collection items public yet."}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#102016] p-4 shadow-xl shadow-black/20 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-black text-white">Contributor Stats</h2>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200">
                  {isoTokens} IsoTokens
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <TinyStat label="Submitted" value={submittedSpeciesCount} />
                <TinyStat label="Verified" value={verifiedSpeciesCount} />
                <TinyStat label="Edits" value={suggestedEditsCount} />
                <TinyStat label="Edits Verified" value={verifiedEditsCount} />
                <TinyStat label="Images" value={imageEditsCount} />
                <TinyStat label="Discussions" value={discussionPostsCount} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

async function getCollectionPreview(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profileId: string,
  isOwner: boolean
) {
  let query = supabase
    .from("isopedia_user_species")
    .select(
      `
      id,
      status,
      is_public,
      is_favorite,
      is_most_wanted,
      isopedia_species:species_id (
        id,
        common_name,
        scientific_name,
        slug,
        image_url,
        difficulty
      )
    `
    )
    .eq("user_id", profileId)
    .order("is_favorite", { ascending: false })
    .order("is_most_wanted", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(12);

  if (!isOwner) {
    query = query.eq("is_public", true);
  }

  return query.returns<CollectionItem[]>();
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

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100/45">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function TinyStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#07130c]/70 p-2.5">
      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100/40">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function SocialButton({
  href,
  label,
  kind,
}: {
  href: string;
  label: string;
  kind: "facebook" | "instagram" | "website";
}) {
  const className =
    kind === "facebook"
      ? "flex h-14 items-center justify-center rounded-xl border border-[#1877f2]/40 bg-[#1877f2] text-3xl font-black leading-none text-white shadow-lg shadow-[#1877f2]/15 transition hover:bg-[#166fe5]"
      : "flex h-14 items-center justify-center rounded-xl border border-white/10 bg-[#07130c]/70 text-xs font-black text-emerald-200 transition hover:border-emerald-400/50 hover:bg-emerald-400/10";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={className}
    >
      {kind === "facebook" && <span className="-mb-1 font-sans">f</span>}
      {kind === "instagram" && <span>IG</span>}
      {kind === "website" && (
        <span className="grid text-center text-[11px] uppercase leading-3 tracking-wide">
          <span>My</span>
          <span>Website</span>
        </span>
      )}
    </a>
  );
}
