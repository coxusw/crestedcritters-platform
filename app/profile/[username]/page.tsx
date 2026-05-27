import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { absoluteIsopediaUrl } from "@/lib/isopedia-site";
import { getProfileFeatureAccess } from "@/lib/isopedia-feature-flags";
import { publicSpeciesSlug } from "@/lib/isopedia-slugs";
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

type ProfileVisibilitySettings = {
  recent_discussions_public: boolean;
  expo_status_public: boolean;
};

type RecentDiscussion = {
  id: string;
  entity_type: "species" | "expo" | "guide";
  entity_id: string;
  body: string;
  created_at: string;
};

type ExpoStatus = {
  id: string;
  status: "attending" | "vending";
  isopedia_expos: {
    id: string;
    name: string;
    slug: string;
    city: string;
    state: string;
    venue: string | null;
    starts_at: string;
    ends_at: string | null;
    status: string;
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
  const title = `${name}'s Isopedia Profile`;
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

async function updateProfileActivityVisibility(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be logged in.");
  }

  const username = String(formData.get("username") || "").trim();
  const section = String(formData.get("section") || "");
  const isPublic = String(formData.get("is_public") || "") === "true";
  const allowedColumns: Record<string, keyof ProfileVisibilitySettings> = {
    recent_discussions: "recent_discussions_public",
    expo_status: "expo_status_public",
  };
  const column = allowedColumns[section];

  if (!column) {
    throw new Error("Invalid profile visibility section.");
  }

  const { error } = await supabase.from("profile_visibility_settings").upsert(
    {
      profile_id: user.id,
      [column]: isPublic,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" }
  );

  if (error) {
    throw new Error(error.message);
  }

  if (username) {
    revalidatePath(`/profile/${username}`);
  }
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
  const discussionLikesReceivedCount = await getDiscussionLikesReceivedCount(
    supabase,
    profile.id
  );
  const spentIsoTokens = await getSpentIsoTokens(supabase, profile.id);
  const isoTokens = Math.max(
    0,
    submittedSpeciesCount +
      verifiedSpeciesCount +
      suggestedEditsCount +
      verifiedEditsCount +
      discussionPostsCount +
      discussionLikesReceivedCount -
      spentIsoTokens
  );
  const trustLevel = getTrustLevel(isoTokens);
  const collectionItems = collectionResult.data || [];
  const ownedCount = collectionItems.filter((item) => item.status === "owned").length;
  const wishlistCount = collectionItems.filter((item) => item.status === "wishlist").length;
  const visibility = await getProfileVisibility(supabase, profile.id);
  const featureAccess = await getProfileFeatureAccess(supabase, profile.id, [
    "expo_status_display_profiles",
    "recent_discussions_profiles",
    "public_collection_preview_profiles",
    "social_site_buttons_profiles",
  ]);
  const canUseRecentDiscussions =
    featureAccess.recent_discussions_profiles ?? true;
  const canUseExpoStatus = featureAccess.expo_status_display_profiles ?? true;
  const canUseCollectionPreview =
    featureAccess.public_collection_preview_profiles ?? true;
  const canUseSocialButtons = featureAccess.social_site_buttons_profiles ?? true;
  const recentDiscussions =
    canUseRecentDiscussions && (isOwner || visibility.recent_discussions_public)
      ? await getRecentProfileDiscussions(supabase, profile.id)
      : [];
  const expoStatuses =
    canUseExpoStatus && (isOwner || visibility.expo_status_public)
      ? await getProfileExpoStatuses(supabase, profile.id)
      : [];

  const profileJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": absoluteIsopediaUrl(`/profile/${usernameForLinks}#profile`),
        url: absoluteIsopediaUrl(`/profile/${usernameForLinks}`),
        name: `${publicName}'s Isopedia Profile`,
        about: {
          "@type": "Person",
          "@id": absoluteIsopediaUrl(`/profile/${usernameForLinks}#person`),
          name: publicName,
          description: profile.bio || undefined,
          image: profile.profile_logo_url || undefined,
          url: absoluteIsopediaUrl(`/profile/${usernameForLinks}`),
          sameAs: [
            websiteUrl,
            facebookUrl,
            profileInstagramUrl,
          ].filter(Boolean),
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(profileJsonLd).replace(/</g, "\\u003c"),
        }}
      />
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
                      <Image
                        src={profile.profile_logo_url}
                        alt={`${publicName} profile logo`}
                        width={96}
                        height={96}
                        sizes="96px"
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

                  <div className="mx-auto w-full max-w-32 md:mx-0">
                    <MiniMetric label="IsoTokens" value={isoTokens} />
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

              {canUseSocialButtons && (
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
              )}
            </section>

            {canUseCollectionPreview && (
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
                        href={`/${publicSpeciesSlug(species.slug)}`}
                        className="grid grid-cols-[64px_1fr] gap-3 rounded-xl border border-white/10 bg-[#07130c]/70 p-2 transition hover:border-emerald-400/50"
                      >
                        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-black/20">
                          {species.image_url ? (
                            <Image
                              src={species.image_url}
                              alt={species.common_name}
                              width={64}
                              height={64}
                              sizes="64px"
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
            )}

            {((canUseRecentDiscussions || canUseExpoStatus) &&
              (isOwner ||
              recentDiscussions.length > 0 ||
              expoStatuses.length > 0)) && (
              <section className="grid gap-5 xl:grid-cols-2">
                {canUseRecentDiscussions &&
                  (isOwner || visibility.recent_discussions_public) && (
                  <ProfileActivityCard
                    title="Recent Discussions"
                    isOwner={isOwner}
                    section="recent_discussions"
                    username={usernameForLinks}
                    isPublic={visibility.recent_discussions_public}
                    emptyText={
                      isOwner
                        ? "Your recent public discussion posts will show here."
                        : "No recent public discussion activity yet."
                    }
                  >
                    {recentDiscussions.map((discussion) => (
                      <Link
                        key={discussion.id}
                        href={discussion.href}
                        className="block rounded-xl border border-white/10 bg-[#07130c]/70 p-3 transition hover:border-emerald-400/50"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-black text-white">
                            {discussion.title}
                          </p>
                          <p className="text-[11px] font-bold text-emerald-100/40">
                            {new Date(discussion.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-emerald-50/55">
                          {discussion.body}
                        </p>
                      </Link>
                    ))}
                  </ProfileActivityCard>
                )}

                {canUseExpoStatus &&
                  (isOwner || visibility.expo_status_public) && (
                  <ProfileActivityCard
                    title="Expo Status"
                    isOwner={isOwner}
                    section="expo_status"
                    username={usernameForLinks}
                    isPublic={visibility.expo_status_public}
                    emptyText={
                      isOwner
                        ? "Mark yourself attending or vending on expo pages to show them here."
                        : "No public expo status yet."
                    }
                  >
                    {expoStatuses.map((status) => {
                      const expo = status.isopedia_expos;
                      if (!expo) return null;

                      return (
                        <Link
                          key={status.id}
                          href={`/expos/${expo.slug}`}
                          className="block rounded-xl border border-white/10 bg-[#07130c]/70 p-3 transition hover:border-emerald-400/50"
                        >
                          <p className="text-sm font-black text-white">
                            {status.status === "vending"
                              ? `Vending at ${expo.name}`
                              : `Attending ${expo.name}`}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-emerald-50/55">
                            {[expo.venue, expo.city, expo.state]
                              .filter(Boolean)
                              .join(" - ")}
                          </p>
                          <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-emerald-200/70">
                            {new Date(expo.starts_at).toLocaleDateString()}
                            {expo.ends_at
                              ? ` - ${new Date(
                                  expo.ends_at
                                ).toLocaleDateString()}`
                              : ""}
                          </p>
                        </Link>
                      );
                    })}
                  </ProfileActivityCard>
                )}
              </section>
            )}

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
                <TinyStat label="Likes Earned" value={discussionLikesReceivedCount} />
                <TinyStat label="Spent" value={spentIsoTokens} />
              </div>
            </section>
          </div>
        </div>
      </div>
      </main>
    </>
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

async function getProfileVisibility(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profileId: string
): Promise<ProfileVisibilitySettings> {
  const defaults = {
    recent_discussions_public: true,
    expo_status_public: true,
  };

  const { data, error } = await supabase
    .from("profile_visibility_settings")
    .select("recent_discussions_public, expo_status_public")
    .eq("profile_id", profileId)
    .maybeSingle<ProfileVisibilitySettings>();

  if (error || !data) return defaults;

  return {
    ...defaults,
    ...data,
  };
}

async function getDiscussionLikesReceivedCount(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profileId: string
) {
  const { count, error } = await supabase
    .from("isopedia_discussion_likes")
    .select("id, isopedia_discussions!inner(user_id)", {
      count: "exact",
      head: true,
    })
    .eq("isopedia_discussions.user_id", profileId);

  if (error) return 0;
  return count || 0;
}

async function getSpentIsoTokens(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profileId: string
) {
  const { data, error } = await supabase
    .from("isotoken_purchases")
    .select("price_paid")
    .eq("profile_id", profileId)
    .eq("status", "completed")
    .returns<Array<{ price_paid: number }>>();

  if (error) return 0;

  return (data || []).reduce((total, purchase) => total + purchase.price_paid, 0);
}

async function getRecentProfileDiscussions(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profileId: string
) {
  const { data, error } = await supabase
    .from("isopedia_discussions")
    .select("id, entity_type, entity_id, body, created_at")
    .eq("user_id", profileId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(3)
    .returns<RecentDiscussion[]>();

  if (error || !data) return [];

  const speciesIds = data
    .filter((item) => item.entity_type === "species")
    .map((item) => Number(item.entity_id))
    .filter(Number.isFinite);
  const expoIds = data
    .filter((item) => item.entity_type === "expo")
    .map((item) => item.entity_id);

  const [{ data: speciesRows }, { data: expoRows }] = await Promise.all([
    speciesIds.length
      ? supabase
          .from("isopedia_species")
          .select("id, common_name, slug")
          .in("id", speciesIds)
          .returns<Array<{ id: number; common_name: string; slug: string }>>()
      : Promise.resolve({ data: [] }),
    expoIds.length
      ? supabase
          .from("isopedia_expos")
          .select("id, name, slug")
          .in("id", expoIds)
          .returns<Array<{ id: string; name: string; slug: string }>>()
      : Promise.resolve({ data: [] }),
  ]);

  const speciesMap = new Map(
    (speciesRows || []).map((item) => [
      String(item.id),
      {
        title: item.common_name,
        href: `/${publicSpeciesSlug(item.slug)}`,
      },
    ])
  );
  const expoMap = new Map(
    (expoRows || []).map((item) => [
      item.id,
      {
        title: item.name,
        href: `/expos/${item.slug}`,
      },
    ])
  );

  return data.map((item) => {
    const target =
      item.entity_type === "species"
        ? speciesMap.get(item.entity_id)
        : item.entity_type === "expo"
          ? expoMap.get(item.entity_id)
          : null;

    return {
      ...item,
      title: target?.title || "Discussion",
      href: target?.href || "/",
    };
  });
}

async function getProfileExpoStatuses(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profileId: string
) {
  const { data, error } = await supabase
    .from("isopedia_expo_rsvps")
    .select(
      `
      id,
      status,
      isopedia_expos:expo_id (
        id,
        name,
        slug,
        city,
        state,
        venue,
        starts_at,
        ends_at,
        status
      )
    `
    )
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(3)
    .returns<ExpoStatus[]>();

  if (error || !data) return [];

  return data.filter((item) => item.isopedia_expos?.status === "approved");
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

function ProfileActivityCard({
  title,
  isOwner,
  section,
  username,
  isPublic,
  emptyText,
  children,
}: {
  title: string;
  isOwner: boolean;
  section: "recent_discussions" | "expo_status";
  username: string;
  isPublic: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children)
    ? children.some(Boolean)
    : Boolean(children);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#102016] p-5 shadow-xl shadow-black/20 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white">{title}</h2>
          {isOwner && (
            <p className="mt-1 text-xs text-emerald-50/45">
              Currently {isPublic ? "public" : "private"} on your profile.
            </p>
          )}
        </div>

        {isOwner && (
          <form action={updateProfileActivityVisibility}>
            <input type="hidden" name="username" value={username} />
            <input type="hidden" name="section" value={section} />
            <input
              type="hidden"
              name="is_public"
              value={isPublic ? "false" : "true"}
            />
            <button
              type="submit"
              className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                isPublic
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15"
                  : "border-white/10 bg-black/20 text-emerald-50/70 hover:bg-black/30"
              }`}
            >
              {isPublic ? "Make Private" : "Make Public"}
            </button>
          </form>
        )}
      </div>

      <div className="mt-4 grid gap-3">
        {hasChildren ? (
          children
        ) : (
          <p className="rounded-xl border border-white/10 bg-[#07130c]/70 p-4 text-sm text-emerald-50/50">
            {emptyText}
          </p>
        )}
      </div>
    </section>
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
