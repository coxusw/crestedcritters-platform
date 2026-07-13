import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCommunityDiscussions, getInlineBadgesForProfiles } from "@/lib/community";
import { publicSpeciesSlug } from "@/lib/isopedia-slugs";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import { DiscussionCard } from "@/app/community/CommunityCards";

export const metadata = { title: "Following | Isopedia Community" };

type FollowedSpeciesRow = {
  species_id: number;
  species: {
    id: number;
    common_name: string;
    slug: string;
  } | null;
};

export default async function FollowingDiscussionsPage() {
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
  const species = (followedSpecies || []).flatMap((row) => (row.species ? [row.species] : []));

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

          {species.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {species.map((item) => (
                <Link
                  key={item.id}
                  href={`/${publicSpeciesSlug(item.slug)}`}
                  className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-100 hover:bg-emerald-400/20"
                >
                  {item.common_name}
                </Link>
              ))}
            </div>
          )}
        </header>

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
            <EmptyFollowingState hasSpeciesFollows={species.length > 0} />
          )}
        </section>
      </div>
    </main>
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
