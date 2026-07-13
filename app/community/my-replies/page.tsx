import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  getCommunityDiscussions,
  getInlineBadgesForProfiles,
  getMarketplaceDetailsByDiscussionIds,
} from "@/lib/community";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import { DiscussionCard } from "@/app/community/CommunityCards";

export const metadata = { title: "My Replies" };

export default async function MyRepliesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/community/my-replies");

  const { data: replyRows } = await supabase
    .from("community_replies")
    .select("discussion_id")
    .eq("author_id", user.id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<Array<{ discussion_id: string }>>();

  const discussionIds = [...new Set((replyRows || []).map((row) => row.discussion_id))];
  const discussions = discussionIds.length
    ? await getCommunityDiscussions(supabase, {
        discussionIds,
        limit: 80,
      })
    : [];

  const [badges, marketplaceDetailsByDiscussion] = await Promise.all([
    getInlineBadgesForProfiles(
      supabase,
      discussions.map((discussion) => discussion.author_id || "").filter(Boolean)
    ),
    getMarketplaceDetailsByDiscussionIds(
      supabase,
      discussions
        .filter((discussion) => discussion.content_type === "marketplace")
        .map((discussion) => discussion.id)
    ),
  ]);

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <IsopediaNav active="community" />
        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          <Link href="/community" className="text-emerald-300 underline">Community</Link>
          <Link href="/community/my-discussions" className="text-emerald-300 underline">My Discussions</Link>
          <Link href="/community/saved" className="text-emerald-300 underline">Saved</Link>
        </div>
        <h1 className="text-3xl font-black text-white">My Replies</h1>
        <p className="mt-2 text-sm leading-6 text-emerald-50/65">
          Discussions where you have joined the conversation.
        </p>

        <section className="mt-6 space-y-4">
          {discussions.length ? (
            discussions.map((discussion) => (
              <DiscussionCard
                key={discussion.id}
                discussion={discussion}
                badges={badges.get(discussion.author_id || "") || []}
                marketplaceDetails={marketplaceDetailsByDiscussion.get(discussion.id) || null}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-emerald-50/60">
              You have not replied to any discussions yet.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
