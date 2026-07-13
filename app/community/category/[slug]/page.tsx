import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  getCommunityCategoryBySlug,
  getCommunityDiscussions,
  getInlineBadgesForProfiles,
} from "@/lib/community";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import { DiscussionCard } from "@/app/community/CommunityCards";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const category = await getCommunityCategoryBySlug(supabase, slug);
  return {
    title: category ? `${category.name} | Isopedia Community` : "Community Category | Isopedia",
    description: category?.description || "Isopedia community category.",
  };
}

export default async function CommunityCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; sort?: string; filter?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const supabase = await createSupabaseServerClient();
  const category = await getCommunityCategoryBySlug(supabase, slug);
  if (!category) notFound();

  const discussions = await getCommunityDiscussions(supabase, {
    categorySlug: category.slug,
    search: query.q,
    sort: query.sort,
    unansweredOnly: query.filter === "unanswered",
    limit: 40,
  });
  const badgesByProfile = await getInlineBadgesForProfiles(
    supabase,
    discussions.map((discussion) => discussion.author_id || "").filter(Boolean)
  );

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <IsopediaNav active="community" />

        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          <Link href="/community" className="text-emerald-300 underline">
            Back to Community
          </Link>
          <Link
            href={`/community/new?category=${category.slug}`}
            className="text-emerald-300 underline"
          >
            Start in {category.name}
          </Link>
        </div>

        <header className="rounded-lg border border-white/10 bg-[#102016] p-5 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
            {category.icon || "Community Category"}
          </p>
          <h1 className="mt-3 text-4xl font-black text-white">{category.name}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/70">
            {category.description}
          </p>
          {category.marketplace_rules && (
            <p className="mt-4 rounded-lg border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm leading-6 text-yellow-50/80">
              Isopedia only provides a space for community members to connect.
              Isopedia does not process payments, verify transactions, guarantee
              products, or participate in sales. Users are responsible for all
              laws, permits, shipping restrictions, and private transaction terms.
            </p>
          )}
        </header>

        <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]" action={`/community/category/${category.slug}`}>
          <input
            name="q"
            defaultValue={query.q || ""}
            placeholder={`Search ${category.name}...`}
            className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
          />
          <select
            name="sort"
            defaultValue={query.sort || "active"}
            className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
          >
            <option value="active">Recently active</option>
            <option value="newest">Newest</option>
            <option value="replies">Most replies</option>
            <option value="views">Most viewed</option>
            <option value="saved">Most saved</option>
          </select>
          <button className="rounded-lg border border-emerald-400/30 px-5 py-3 font-black text-emerald-100 hover:bg-emerald-400/10">
            Filter
          </button>
        </form>

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
            <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
              <h2 className="text-xl font-black text-white">
                Be the first to start a discussion in this category.
              </h2>
              <Link
                href={`/community/new?category=${category.slug}`}
                className="mt-4 inline-flex rounded-lg bg-emerald-400 px-4 py-2 font-black text-slate-950"
              >
                Start a Discussion
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
