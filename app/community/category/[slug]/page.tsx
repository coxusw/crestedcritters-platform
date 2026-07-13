import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  getCommunityCategoryBySlug,
  getCommunityDiscussions,
  getInlineBadgesForProfiles,
  type MarketplaceDetails,
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
  searchParams: Promise<{
    q?: string;
    sort?: string;
    filter?: string;
    listing_type?: string;
    listing_status?: string;
    has_images?: string;
    species?: string;
  }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const supabase = await createSupabaseServerClient();
  const category = await getCommunityCategoryBySlug(supabase, slug);
  if (!category) notFound();
  const supportsAnsweredFilter =
    category.slug === "help-questions" ||
    category.slug === "species-help" ||
    category.slug === "identification-help";

  const [speciesResult, discussions] = await Promise.all([
    supabase
      .from("isopedia_species")
      .select("id, common_name, scientific_name")
      .order("common_name", { ascending: true })
      .returns<Array<{ id: number; common_name: string; scientific_name: string | null }>>(),
    getCommunityDiscussions(supabase, {
      categorySlug: category.slug,
      search: query.q,
      sort: query.sort,
      speciesId: query.species,
      unansweredOnly: supportsAnsweredFilter && query.filter === "unanswered",
      answeredOnly: supportsAnsweredFilter && query.filter === "answered",
      hasImages: query.has_images === "true",
      marketplaceListingType: category.marketplace_rules ? query.listing_type : undefined,
      marketplaceStatus: category.marketplace_rules ? query.listing_status : undefined,
      limit: 40,
    }),
  ]);
  const badgesByProfile = await getInlineBadgesForProfiles(
    supabase,
    discussions.map((discussion) => discussion.author_id || "").filter(Boolean)
  );
  const marketplaceDetailsByDiscussion = category.marketplace_rules
    ? await getMarketplaceDetailsByDiscussion(supabase, discussions.map((discussion) => discussion.id))
    : new Map<string, MarketplaceDetails>();

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

        <form className="mt-5 grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4" action={`/community/category/${category.slug}`}>
          <input
            name="q"
            defaultValue={query.q || ""}
            placeholder={`Search ${category.name}...`}
            className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect label="Sort" name="sort" value={query.sort || "active"}>
              <option value="active">Recently active</option>
              <option value="newest">Newest</option>
              <option value="replies">Most replies</option>
              <option value="views">Most viewed</option>
              <option value="saved">Most saved</option>
            </FilterSelect>

            <FilterSelect label="Species" name="species" value={query.species || ""}>
              <option value="">All species</option>
              {(speciesResult.data || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.common_name}
                  {item.scientific_name ? ` - ${item.scientific_name}` : ""}
                </option>
              ))}
            </FilterSelect>

            {supportsAnsweredFilter && (
              <FilterSelect label="Answered" name="filter" value={query.filter || ""}>
                <option value="">All discussions</option>
                <option value="unanswered">Unanswered questions</option>
                <option value="answered">Answered questions</option>
              </FilterSelect>
            )}

            <FilterSelect label="Images" name="has_images" value={query.has_images || ""}>
              <option value="">With or without images</option>
              <option value="true">Has images</option>
            </FilterSelect>

            {category.marketplace_rules && (
              <>
                <FilterSelect label="Listing Type" name="listing_type" value={query.listing_type || ""}>
                  <option value="">All listing types</option>
                  <option value="available">Available</option>
                  <option value="wanted">Wanted</option>
                  <option value="trade">Trade</option>
                  <option value="local_pickup">Local pickup</option>
                  <option value="expo_availability">Expo availability</option>
                  <option value="supplies">Supplies</option>
                  <option value="plants">Plants or bioactive materials</option>
                  <option value="enclosures">Enclosures</option>
                  <option value="cultures">Cultures</option>
                  <option value="cleanup_crew">Cleanup crew</option>
                  <option value="other">Other</option>
                </FilterSelect>

                <FilterSelect label="Listing Status" name="listing_status" value={query.listing_status || ""}>
                  <option value="">All listing statuses</option>
                  <option value="available">Available</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="expired">Expired</option>
                  <option value="withdrawn">Withdrawn</option>
                </FilterSelect>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="rounded-lg border border-emerald-400/30 px-5 py-3 font-black text-emerald-100 hover:bg-emerald-400/10">
              Filter
            </button>
            <Link
              href={`/community/category/${category.slug}`}
              className="rounded-lg border border-white/10 px-5 py-3 font-black text-white hover:bg-white/10"
            >
              Reset
            </Link>
          </div>
        </form>

        <section className="mt-6 space-y-4">
          {discussions.length ? (
            discussions.map((discussion) => (
              <DiscussionCard
                key={discussion.id}
                discussion={discussion}
                badges={badgesByProfile.get(discussion.author_id || "") || []}
                marketplaceDetails={marketplaceDetailsByDiscussion.get(discussion.id) || null}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
              <h2 className="text-xl font-black text-white">
                {hasActiveFilters(query)
                  ? "There are no discussions matching these filters."
                  : "Be the first to start a discussion in this category."}
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

async function getMarketplaceDetailsByDiscussion(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  discussionIds: string[]
) {
  if (!discussionIds.length) return new Map<string, MarketplaceDetails>();

  const { data } = await supabase
    .from("marketplace_listing_details")
    .select(
      "discussion_id, listing_type, listing_status, species_or_product, quantity, price, location, state, shipping_available, local_pickup_available, expo_name, expiration_date, preferred_contact_method, permit_notes"
    )
    .in("discussion_id", discussionIds)
    .returns<MarketplaceDetails[]>();

  return new Map((data || []).map((details) => [details.discussion_id, details]));
}

function FilterSelect({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-wide text-emerald-50/55">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
      >
        {children}
      </select>
    </label>
  );
}

function hasActiveFilters(query: {
  q?: string;
  filter?: string;
  listing_type?: string;
  listing_status?: string;
  has_images?: string;
}) {
  return Boolean(
    query.q ||
      query.filter ||
      query.listing_type ||
      query.listing_status ||
      query.has_images === "true"
  );
}
