import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCommunityDiscussions, getInlineBadgesForProfiles } from "@/lib/community";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import { DiscussionCard } from "@/app/community/CommunityCards";

export const metadata = { title: "Following | Isopedia Community" };

export default async function FollowingDiscussionsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/community/following");

  const discussions = await getCommunityDiscussions(supabase, {
    followedBy: user.id,
    limit: 80,
  });
  const badges = await getInlineBadgesForProfiles(
    supabase,
    discussions.map((discussion) => discussion.author_id || "").filter(Boolean)
  );

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <IsopediaNav active="community" />
        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          <Link href="/community" className="text-emerald-300 underline">Community</Link>
          <Link href="/community/saved" className="text-emerald-300 underline">Saved</Link>
        </div>
        <h1 className="text-3xl font-black text-white">Following</h1>
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
            <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-emerald-50/60">
              You are not following any discussions yet.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
