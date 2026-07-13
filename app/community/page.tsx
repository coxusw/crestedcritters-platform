import type { Metadata } from "next";
import Link from "next/link";
import { absoluteIsopediaUrl } from "@/lib/isopedia-site";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  getCommunityCategories,
  getCommunityDiscussions,
  getInlineBadgesForProfiles,
  getMarketplaceDetailsByDiscussionIds,
  marketplaceEffectiveStatus,
  type MarketplaceDetails,
} from "@/lib/community";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import { DiscussionCard } from "@/app/community/CommunityCards";

export const metadata: Metadata = {
  title: "Community",
  description: "Join Isopedia community discussions, guides, journals, marketplace connections, and species help.",
  alternates: {
    canonical: absoluteIsopediaUrl("/community"),
  },
  openGraph: {
    title: "Community | Isopedia",
    description: "Join Isopedia community discussions, guides, journals, marketplace connections, and species help.",
    url: absoluteIsopediaUrl("/community"),
    siteName: "Isopedia",
    type: "website",
    images: [
      {
        url: absoluteIsopediaUrl("/isopedia-social-preview.jpg"),
        width: 1200,
        height: 630,
        alt: "Isopedia community",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Community | Isopedia",
    description: "Join Isopedia community discussions, guides, journals, marketplace connections, and species help.",
    images: [absoluteIsopediaUrl("/isopedia-social-preview.jpg")],
  },
};

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; species?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    categories,
    speciesResult,
    recent,
    pinned,
    trending,
    unanswered,
    guides,
    journals,
    showcase,
    marketplace,
  ] = await Promise.all([
    getCommunityCategories(supabase),
    supabase
      .from("isopedia_species")
      .select("id, common_name, scientific_name")
      .order("common_name", { ascending: true })
      .returns<Array<{ id: number; common_name: string; scientific_name: string | null }>>(),
    getCommunityDiscussions(supabase, {
      search: params.q,
      sort: params.sort,
      speciesId: params.species,
      limit: 12,
    }),
    getCommunityDiscussions(supabase, {
      pinnedOnly: true,
      limit: 4,
    }),
    getCommunityDiscussions(supabase, {
      sort: "trending",
      limit: 4,
    }),
    getCommunityDiscussions(supabase, {
      unansweredOnly: true,
      limit: 4,
    }),
    getCommunityDiscussions(supabase, {
      categorySlug: "guides",
      limit: 4,
    }),
    getCommunityDiscussions(supabase, {
      categorySlug: "colony-journals",
      limit: 4,
    }),
    getCommunityDiscussions(supabase, {
      categorySlug: "show-off-your-collection",
      limit: 4,
    }),
    getCommunityDiscussions(supabase, {
      categorySlug: "marketplace-connections",
      marketplaceStatus: "available",
      limit: 4,
    }),
  ]);

  const badgesByProfile = await getInlineBadgesForProfiles(
    supabase,
    recent.map((discussion) => discussion.author_id || "").filter(Boolean)
  );
  const marketplaceDetailsByDiscussion = await getMarketplaceDetailsByDiscussionIds(
    supabase,
    marketplace.map((discussion) => discussion.id)
  );

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <IsopediaNav active="community" />

        <section className="rounded-lg border border-white/10 bg-[#102016] p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
                Isopedia Community
              </p>
              <h1 className="mt-3 text-4xl font-black text-white">Community</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/70">
                Ask questions, publish guides, keep colony journals, share photos,
                connect around expos, and discuss the bioactive hobby with other keepers.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/community/new"
                className="rounded-lg bg-emerald-400 px-5 py-3 font-black text-slate-950 hover:bg-emerald-300"
              >
                Start a Discussion
              </Link>
              {!user && (
                <Link
                  href="/login?next=/community/new"
                  className="rounded-lg border border-white/10 px-5 py-3 font-black text-white hover:bg-white/10"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>

          <form className="mt-6 grid gap-3 lg:grid-cols-[1fr_minmax(220px,300px)_auto_auto]" action="/community">
            <input
              name="q"
              defaultValue={params.q || ""}
              placeholder="Search discussions, tags, or species..."
              className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
            />
            <select
              name="species"
              defaultValue={params.species || ""}
              className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
            >
              <option value="">All species</option>
              {(speciesResult.data || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.common_name}
                  {item.scientific_name ? ` - ${item.scientific_name}` : ""}
                </option>
              ))}
            </select>
            <select
              name="sort"
              defaultValue={params.sort || "active"}
              className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
            >
              <option value="active">Recently active</option>
              <option value="trending">Trending</option>
              <option value="newest">Newest</option>
              <option value="replies">Most replies</option>
              <option value="views">Most viewed</option>
              <option value="saved">Most saved</option>
            </select>
            <button className="rounded-lg border border-emerald-400/30 px-5 py-3 font-black text-emerald-100 hover:bg-emerald-400/10">
              Search
            </button>
          </form>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/community/category/${category.slug}`}
              className="rounded-lg border border-white/10 bg-white/[0.05] p-4 transition hover:-translate-y-0.5 hover:border-emerald-300/50"
            >
              <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                {category.icon || "Community"}
              </div>
              <h2 className="mt-2 text-lg font-black text-white">{category.name}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-5 text-emerald-50/60">
                {category.description}
              </p>
            </Link>
          ))}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-white">Recent Discussions</h2>
              <Link href="/community/new" className="text-sm font-bold text-emerald-300">
                Start one
              </Link>
            </div>
            {recent.length ? (
              recent.map((discussion) => (
                <DiscussionCard
                  key={discussion.id}
                  discussion={discussion}
                  badges={badgesByProfile.get(discussion.author_id || "") || []}
                />
              ))
            ) : (
              <EmptyState text="There are no discussions matching these filters." href="/community/new" action="Start the first one" />
            )}
          </section>

          <aside className="space-y-4">
            {pinned.length > 0 && (
              <Panel title="Pinned Announcements" href="/community">
                {pinned.map((discussion) => (
                  <MiniDiscussion key={discussion.id} discussion={discussion} />
                ))}
              </Panel>
            )}
            <Panel title="Trending Discussions" href="/community?sort=trending">
              {trending.length ? trending.map((discussion) => (
                <MiniDiscussion key={discussion.id} discussion={discussion} />
              )) : <p className="text-sm text-emerald-50/55">No trending discussions yet.</p>}
            </Panel>
            <Panel title="Unanswered Questions" href="/community/category/help-questions?filter=unanswered">
              {unanswered.length ? unanswered.map((discussion) => (
                <MiniDiscussion key={discussion.id} discussion={discussion} />
              )) : <p className="text-sm text-emerald-50/55">No unanswered questions right now.</p>}
            </Panel>
            <Panel title="Featured Guides" href="/community/category/guides">
              {guides.length ? guides.map((discussion) => (
                <MiniDiscussion key={discussion.id} discussion={discussion} />
              )) : <p className="text-sm text-emerald-50/55">No guides have been published yet.</p>}
            </Panel>
            <Panel title="Colony Journals" href="/community/category/colony-journals">
              {journals.length ? journals.map((discussion) => (
                <MiniDiscussion key={discussion.id} discussion={discussion} />
              )) : <p className="text-sm text-emerald-50/55">No colony journals have started yet.</p>}
            </Panel>
            <Panel title="Show Off Your Stuff" href="/community/category/show-off-your-collection">
              {showcase.length ? showcase.map((discussion) => (
                <MiniDiscussion key={discussion.id} discussion={discussion} />
              )) : <p className="text-sm text-emerald-50/55">No showcase posts yet.</p>}
            </Panel>
            <Panel title="Marketplace Connections" href="/community/category/marketplace-connections">
              <p className="mb-3 text-xs leading-5 text-yellow-50/65">
                Isopedia connects members only and does not process payments or guarantee transactions.
              </p>
              {marketplace.length ? marketplace.map((discussion) => (
                <MiniDiscussion
                  key={discussion.id}
                  discussion={discussion}
                  marketplaceDetails={marketplaceDetailsByDiscussion.get(discussion.id) || null}
                />
              )) : <p className="text-sm text-emerald-50/55">No marketplace posts are active.</p>}
            </Panel>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Panel({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-black text-white">{title}</h2>
        <Link href={href} className="text-xs font-bold text-emerald-300">
          View all
        </Link>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function MiniDiscussion({
  discussion,
  marketplaceDetails = null,
}: {
  discussion: { slug: string; title: string; reply_count: number };
  marketplaceDetails?: MarketplaceDetails | null;
}) {
  const marketplaceStatus = marketplaceDetails
    ? marketplaceEffectiveStatus(marketplaceDetails)
    : null;

  return (
    <Link
      href={`/community/discussion/${discussion.slug}`}
      className="rounded-md border border-white/10 bg-black/20 p-3 hover:bg-white/5"
    >
      <p className="line-clamp-2 text-sm font-bold text-white">{discussion.title}</p>
      <p className="mt-1 text-xs text-emerald-50/45">
        {discussion.reply_count} replies
        {marketplaceStatus ? ` | ${marketplaceLabel(marketplaceStatus)}` : ""}
      </p>
    </Link>
  );
}

function marketplaceLabel(value: string | null) {
  if (!value) return "Not listed";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function EmptyState({ text, href, action }: { text: string; href: string; action: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
      <p className="text-emerald-50/60">{text}</p>
      <Link
        href={href}
        className="mt-4 inline-flex rounded-lg bg-emerald-400 px-4 py-2 font-black text-slate-950"
      >
        {action}
      </Link>
    </div>
  );
}
