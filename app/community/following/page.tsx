import { redirect } from "next/navigation";
import Link from "next/link";
import { type ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCommunityDiscussions, getInlineBadgesForProfiles } from "@/lib/community";
import { publicSpeciesSlug } from "@/lib/isopedia-slugs";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import { DiscussionCard } from "@/app/community/CommunityCards";
import {
  unfollowSpeciesFromCommunity,
  updateSpeciesFollowPreferences,
} from "@/app/community/following/actions";

export const metadata = { title: "Following | Isopedia Community" };

type FollowedSpeciesRow = {
  species_id: number;
  notify_discussions: boolean;
  notify_guides: boolean;
  notify_marketplace: boolean;
  notify_photos: boolean;
  species: {
    id: number;
    common_name: string;
    slug: string;
  } | null;
};

export default async function FollowingDiscussionsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/community/following");

  const [{ data: followedSpecies }, discussions] = await Promise.all([
    supabase
      .from("species_follows")
      .select(
        `
        species_id,
        notify_discussions,
        notify_guides,
        notify_marketplace,
        notify_photos,
        species:species_id (
          id,
          common_name,
          slug
        )
      `
      )
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<FollowedSpeciesRow[]>(),
    getCommunityDiscussions(supabase, {
      followingBy: user.id,
      limit: 80,
    }),
  ]);
  const badges = await getInlineBadgesForProfiles(
    supabase,
    discussions.map((discussion) => discussion.author_id || "").filter(Boolean)
  );
  const speciesFollows = (followedSpecies || []).filter((row) => row.species);

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <IsopediaNav active="community" />
        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          <Link href="/community" className="text-emerald-300 underline">Community</Link>
          <Link href="/community/saved" className="text-emerald-300 underline">Saved</Link>
        </div>
        <header className="rounded-lg border border-white/10 bg-[#102016] p-5">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
            Community
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">Following</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/65">
            Posts from discussions and species you follow show up here.
          </p>

          {speciesFollows.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {speciesFollows.map((follow) => (
                <Link
                  key={follow.species_id}
                  href={`/${publicSpeciesSlug(follow.species?.slug || "")}`}
                  className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-100 hover:bg-emerald-400/20"
                >
                  {follow.species?.common_name}
                </Link>
              ))}
            </div>
          )}
        </header>

        {params.saved === "saved" && (
          <Notice tone="success">
            Species notification settings saved.
          </Notice>
        )}
        {params.saved === "unfollowed" && (
          <Notice tone="success">
            Species unfollowed.
          </Notice>
        )}
        {params.error && (
          <Notice tone="error">
            {params.error}
          </Notice>
        )}

        {speciesFollows.length > 0 && (
          <section className="mt-6 rounded-lg border border-white/10 bg-[#102016] p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">
                  Species Follows
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">
                  Notification Settings
                </h2>
              </div>
              <Link
                href="/isopedia"
                className="rounded-lg border border-white/10 px-3 py-2 text-sm font-black text-white hover:bg-white/10"
              >
                Browse Species
              </Link>
            </div>

            <div className="grid gap-3">
              {speciesFollows.map((follow) => (
                <SpeciesFollowSettings key={follow.species_id} follow={follow} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-6 space-y-4">
          {discussions.length ? (
            discussions.map((discussion) => (
              <DiscussionCard
                key={discussion.id}
                discussion={discussion}
                badges={badges.get(discussion.author_id || "") || []}
              />
            ))
          ) : (
            <EmptyFollowingState hasSpeciesFollows={speciesFollows.length > 0} />
          )}
        </section>
      </div>
    </main>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  const classes =
    tone === "success"
      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-50"
      : "border-red-300/25 bg-red-400/10 text-red-50";

  return (
    <div className={`mt-5 rounded-lg border p-4 text-sm font-bold leading-6 ${classes}`}>
      {children}
    </div>
  );
}

function SpeciesFollowSettings({ follow }: { follow: FollowedSpeciesRow }) {
  if (!follow.species) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-[#07130c] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Link
            href={`/${publicSpeciesSlug(follow.species.slug)}`}
            className="text-lg font-black text-white hover:text-emerald-200"
          >
            {follow.species.common_name}
          </Link>
          <p className="mt-1 text-xs font-black uppercase tracking-wide text-emerald-50/45">
            Species notifications
          </p>
        </div>

        <form
          action={updateSpeciesFollowPreferences}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
        >
          <input type="hidden" name="species_id" value={follow.species_id} />
          <PreferenceToggle
            name="notify_discussions"
            label="Discussions"
            defaultChecked={follow.notify_discussions}
          />
          <PreferenceToggle
            name="notify_guides"
            label="Guides"
            defaultChecked={follow.notify_guides}
          />
          <PreferenceToggle
            name="notify_marketplace"
            label="Marketplace"
            defaultChecked={follow.notify_marketplace}
          />
          <PreferenceToggle
            name="notify_photos"
            label="Photos"
            defaultChecked={follow.notify_photos}
          />
          <button className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-300">
            Save
          </button>
        </form>

        <form action={unfollowSpeciesFromCommunity}>
          <input type="hidden" name="species_id" value={follow.species_id} />
          <button className="rounded-lg border border-red-400/25 px-4 py-2 text-sm font-black text-red-100 hover:bg-red-400/10">
            Unfollow
          </button>
        </form>
      </div>
    </div>
  );
}

function PreferenceToggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-emerald-50/80">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-emerald-400"
      />
      {label}
    </label>
  );
}

function EmptyFollowingState({ hasSpeciesFollows }: { hasSpeciesFollows: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-black/20 p-8 text-center">
      <h2 className="text-xl font-black text-white">
        {hasSpeciesFollows ? "No followed-species posts yet." : "Your following feed is empty."}
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-emerald-50/60">
        {hasSpeciesFollows
          ? "When someone links a Community post to a species you follow, it will appear here."
          : "Follow a species from its Isopedia page or follow a discussion to start building this feed."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          href="/isopedia"
          className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-300"
        >
          Browse Species
        </Link>
        <Link
          href="/community"
          className="rounded-lg border border-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/10"
        >
          Browse Community
        </Link>
      </div>
    </div>
  );
}
