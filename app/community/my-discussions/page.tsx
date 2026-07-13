import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCommunityDiscussions, getInlineBadgesForProfiles } from "@/lib/community";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import { DiscussionCard } from "@/app/community/CommunityCards";

export const metadata = { title: "My Discussions | Isopedia Community" };

export default async function MyDiscussionsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; image_error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/community/my-discussions");

  const discussions = await getCommunityDiscussions(supabase, {
    authorId: user.id,
    statuses: ["published", "pending", "hidden", "archived", "expired", "rejected"],
    limit: 50,
  });
  const badges = await getInlineBadgesForProfiles(supabase, [user.id]);

  return (
    <CommunityListPage
      title="My Discussions"
      empty="You have not started any discussions yet."
      discussions={discussions}
      badgesByProfile={badges}
      submitted={params.submitted}
      imageError={params.image_error}
    />
  );
}

function CommunityListPage({
  title,
  empty,
  discussions,
  badgesByProfile,
  submitted,
  imageError,
}: {
  title: string;
  empty: string;
  discussions: Awaited<ReturnType<typeof getCommunityDiscussions>>;
  badgesByProfile: Awaited<ReturnType<typeof getInlineBadgesForProfiles>>;
  submitted?: string;
  imageError?: string;
}) {
  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <IsopediaNav active="community" />
        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          <Link href="/community" className="text-emerald-300 underline">Community</Link>
          <Link href="/community/new" className="text-emerald-300 underline">Start a Discussion</Link>
        </div>
        <h1 className="text-3xl font-black text-white">{title}</h1>
        {submitted === "pending" && (
          <div className="mt-5 rounded-lg border border-amber-300/25 bg-amber-300/10 p-4 text-sm font-bold leading-6 text-amber-50">
            Your discussion was submitted and is waiting for review. It will appear
            publicly after staff approve it.
          </div>
        )}
        {imageError === "1" && (
          <div className="mt-5 rounded-lg border border-red-300/25 bg-red-400/10 p-4 text-sm font-bold leading-6 text-red-50">
            Your discussion was saved, but one or more images could not be attached.
            You can edit the discussion and try adding the images again.
          </div>
        )}
        <section className="mt-6 space-y-4">
          {discussions.length ? (
            discussions.map((discussion) => (
              <DiscussionCard
                key={discussion.id}
                discussion={discussion}
                badges={badgesByProfile.get(discussion.author_id || "") || []}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-emerald-50/60">
              {empty}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
