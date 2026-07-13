import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  type CommunityDiscussion,
  type CommunityImage,
  type CommunityReply,
  type CommunitySpecies,
  type MarketplaceDetails,
  communityProfileName,
  getInlineBadgesForProfiles,
} from "@/lib/community";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import { InlineBadges } from "@/app/community/CommunityCards";
import LinkifiedText from "@/app/community/LinkifiedText";
import {
  createCommunityReply,
  reportCommunityContent,
  softDeleteCommunityDiscussion,
  toggleCommunityFollow,
  toggleCommunitySave,
} from "@/app/community/actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("community_discussions")
    .select("title, excerpt, body, slug, status")
    .eq("slug", slug)
    .maybeSingle<{ title: string; excerpt: string | null; body: string; slug: string; status: string }>();

  return {
    title: data ? `${data.title} | Isopedia Community` : "Community Discussion | Isopedia",
    description: data?.excerpt || "Isopedia community discussion.",
    robots: data?.status === "published" ? undefined : { index: false, follow: false },
  };
}

export default async function CommunityDiscussionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: discussion, error } = await supabase
    .from("community_discussions")
    .select(
      `
      id,
      category_id,
      author_id,
      slug,
      title,
      body,
      excerpt,
      content_type,
      status,
      pinned,
      pinned_until,
      featured,
      locked,
      answered,
      accepted_reply_id,
      reply_count,
      view_count,
      save_count,
      follow_count,
      report_count,
      last_activity_at,
      created_at,
      updated_at,
      edited_at,
      author:author_id (
        id,
        username,
        display_name,
        business_name
      ),
      category:category_id (
        id,
        name,
        slug,
        description,
        icon,
        color,
        display_order,
        is_active,
        requires_approval,
        marketplace_rules,
        species_tagging_enabled,
        images_enabled,
        staff_only_posting,
        posting_guidelines,
        minimum_account_age_days
      )
    `
    )
    .eq("slug", slug)
    .maybeSingle<CommunityDiscussion>();

  if (error || !discussion || !["published", "expired"].includes(discussion.status)) {
    notFound();
  }

  await supabase.from("community_views").insert({
    discussion_id: discussion.id,
    profile_id: user?.id || null,
  });
  await supabase.rpc("community_recount_discussion_stats", {
    target_discussion_id: discussion.id,
  });

  const [repliesResult, speciesResult, marketplaceResult, savedResult, followedResult] =
    await Promise.all([
      supabase
        .from("community_replies")
        .select(
          `
          id,
          discussion_id,
          author_id,
          reply_to_author_id,
          body,
          status,
          helpful_count,
          is_accepted_answer,
          created_at,
          updated_at,
          edited_at,
          author:author_id (
            id,
            username,
            display_name,
            business_name
          )
        `
        )
        .eq("discussion_id", discussion.id)
        .eq("status", "published")
        .order("created_at", { ascending: true })
        .returns<CommunityReply[]>(),
      supabase
        .from("community_discussion_species")
        .select(
          `
          species:species_id (
            id,
            common_name,
            scientific_name,
            slug
          )
        `
        )
        .eq("discussion_id", discussion.id)
        .returns<Array<{ species: CommunitySpecies | null }>>(),
      supabase
        .from("marketplace_listing_details")
        .select("*")
        .eq("discussion_id", discussion.id)
        .maybeSingle<MarketplaceDetails>(),
      user
        ? supabase
            .from("community_saves")
            .select("discussion_id")
            .eq("discussion_id", discussion.id)
            .eq("profile_id", user.id)
            .maybeSingle<{ discussion_id: string }>()
        : Promise.resolve({ data: null }),
      user
        ? supabase
            .from("community_follows")
            .select("discussion_id")
            .eq("discussion_id", discussion.id)
            .eq("profile_id", user.id)
            .maybeSingle<{ discussion_id: string }>()
        : Promise.resolve({ data: null }),
    ]);

  const replyIds = (repliesResult.data || []).map((reply) => reply.id);
  const imageFilter = replyIds.length
    ? `discussion_id.eq.${discussion.id},reply_id.in.(${replyIds.join(",")})`
    : `discussion_id.eq.${discussion.id}`;
  const { data: images } = await supabase
    .from("community_images")
    .select("id, discussion_id, reply_id, owner_id, image_url, storage_path, alt_text, caption, position, created_at")
    .eq("status", "active")
    .or(imageFilter)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<CommunityImage[]>();

  const discussionImages = (images || []).filter((image) => image.discussion_id === discussion.id);
  const imagesByReply = new Map<string, CommunityImage[]>();
  for (const image of images || []) {
    if (!image.reply_id) continue;
    imagesByReply.set(image.reply_id, [...(imagesByReply.get(image.reply_id) || []), image]);
  }

  const allProfileIds = [
    discussion.author_id,
    ...(repliesResult.data || []).map((reply) => reply.author_id),
  ].filter((id): id is string => Boolean(id));
  const badgesByProfile = await getInlineBadgesForProfiles(supabase, allProfileIds);
  const canEdit = Boolean(user && user.id === discussion.author_id);
  const returnPath = `/community/discussion/${discussion.slug}`;

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <IsopediaNav active="community" />
        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          <Link href="/community" className="text-emerald-300 underline">
            Back to Community
          </Link>
          {discussion.category && (
            <Link
              href={`/community/category/${discussion.category.slug}`}
              className="text-emerald-300 underline"
            >
              {discussion.category.name}
            </Link>
          )}
        </div>

        <article className="rounded-lg border border-white/10 bg-[#102016] p-5 sm:p-7">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-xs font-black uppercase tracking-wide text-emerald-100">
              {discussion.content_type}
            </span>
            {discussion.locked && (
              <span className="rounded-md border border-red-300/20 bg-red-400/10 px-2 py-1 text-xs font-black uppercase tracking-wide text-red-100">
                Locked
              </span>
            )}
            {discussion.answered && (
              <span className="rounded-md border border-lime-300/20 bg-lime-400/10 px-2 py-1 text-xs font-black uppercase tracking-wide text-lime-100">
                Answered
              </span>
            )}
          </div>

          <h1 className="mt-4 text-3xl font-black text-white sm:text-5xl">
            {discussion.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-emerald-50/50">
            <span>By</span>
            {discussion.author?.username ? (
              <Link
                href={`/profile/${discussion.author.username}`}
                className="font-bold text-emerald-300 hover:text-emerald-200"
              >
                @{discussion.author.username}
              </Link>
            ) : (
              <span className="font-bold text-emerald-100">
                {communityProfileName(discussion.author)}
              </span>
            )}
            <InlineBadges badges={badgesByProfile.get(discussion.author_id || "") || []} />
            <span>•</span>
            <span>{new Date(discussion.created_at).toLocaleString()}</span>
            {discussion.edited_at && <span>Edited</span>}
          </div>

          <div className="mt-6 whitespace-pre-wrap text-base leading-8 text-emerald-50/85">
            <LinkifiedText text={discussion.body} />
          </div>

          <CommunityImageGrid images={discussionImages} className="mt-6" />

          {speciesResult.data && speciesResult.data.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {speciesResult.data.map((row) =>
                row.species ? (
                  <Link
                    key={row.species.id}
                    href={`/${row.species.slug}`}
                    className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-100"
                  >
                    {row.species.common_name}
                  </Link>
                ) : null
              )}
            </div>
          )}

          {marketplaceResult.data && (
            <MarketplaceDetailsPanel details={marketplaceResult.data} />
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {user ? (
              <>
                <form action={toggleCommunitySave}>
                  <input type="hidden" name="discussion_id" value={discussion.id} />
                  <input type="hidden" name="return_path" value={returnPath} />
                  <button className="rounded-lg border border-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/10">
                    {savedResult.data ? "Saved" : "Save"} ({discussion.save_count})
                  </button>
                </form>
                <form action={toggleCommunityFollow}>
                  <input type="hidden" name="discussion_id" value={discussion.id} />
                  <input type="hidden" name="return_path" value={returnPath} />
                  <button className="rounded-lg border border-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/10">
                    {followedResult.data ? "Following" : "Follow"} ({discussion.follow_count})
                  </button>
                </form>
                {canEdit && (
                  <Link
                    href={`/community/discussion/${discussion.slug}/edit`}
                    className="rounded-lg border border-sky-300/20 px-4 py-2 text-sm font-black text-sky-100 hover:bg-sky-300/10"
                  >
                    Edit
                  </Link>
                )}
              </>
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent(returnPath)}`}
                className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950"
              >
                Sign in to save or reply
              </Link>
            )}
          </div>
        </article>

        <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <h2 className="text-2xl font-black text-white">
            Replies ({repliesResult.data?.length || 0})
          </h2>

          <div className="mt-5 grid gap-4">
            {(repliesResult.data || []).map((reply) => (
              <article
                id={`reply-${reply.id}`}
                key={reply.id}
                className="rounded-lg border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm text-emerald-50/50">
                  {reply.author?.username ? (
                    <Link href={`/profile/${reply.author.username}`} className="font-bold text-emerald-300">
                      @{reply.author.username}
                    </Link>
                  ) : (
                    <span className="font-bold">{communityProfileName(reply.author)}</span>
                  )}
                  <InlineBadges badges={badgesByProfile.get(reply.author_id || "") || []} />
                  <span>•</span>
                  <span>{new Date(reply.created_at).toLocaleString()}</span>
                  {reply.is_accepted_answer && (
                    <span className="rounded-full bg-lime-300/15 px-2 py-0.5 text-xs font-black text-lime-100">
                      Accepted answer
                    </span>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-emerald-50/80">
                  <LinkifiedText text={reply.body} />
                </p>
                <CommunityImageGrid
                  images={imagesByReply.get(reply.id) || []}
                  className="mt-4"
                  compact
                />
              </article>
            ))}
          </div>

          {user && !discussion.locked ? (
            <form action={createCommunityReply} className="mt-6 grid gap-3" encType="multipart/form-data">
              <input type="hidden" name="discussion_id" value={discussion.id} />
              <label className="grid gap-2">
                <span className="text-sm font-black text-emerald-50/80">Reply</span>
                <textarea
                  name="body"
                  required
                  minLength={2}
                  rows={5}
                  className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                />
              </label>
              {discussion.category?.images_enabled && (
                <label className="grid gap-2">
                  <span className="text-sm font-black text-emerald-50/80">Images</span>
                  <input
                    name="image_files"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-sm text-emerald-50/80 outline-none file:mr-4 file:rounded-md file:border-0 file:bg-emerald-400 file:px-4 file:py-2 file:font-black file:text-slate-950 hover:file:bg-emerald-300"
                  />
                  <span className="text-xs text-emerald-50/45">
                    Add up to 4 JPG, PNG, WEBP, or GIF images. Each image must be under 5MB.
                  </span>
                </label>
              )}
              <button className="w-fit rounded-lg bg-emerald-400 px-5 py-3 font-black text-slate-950 hover:bg-emerald-300">
                Post Reply
              </button>
            </form>
          ) : discussion.locked ? (
            <p className="mt-6 rounded-lg border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-100">
              This discussion is locked.
            </p>
          ) : null}

          {user && (
            <details className="mt-6 rounded-lg border border-white/10 bg-black/20 p-4">
              <summary className="cursor-pointer text-sm font-black text-emerald-200">
                Report this discussion
              </summary>
              <form action={reportCommunityContent} className="mt-4 grid gap-3">
                <input type="hidden" name="discussion_id" value={discussion.id} />
                <input type="hidden" name="return_path" value={returnPath} />
                <select name="reason" className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-white">
                  <option>Spam</option>
                  <option>Harassment</option>
                  <option>Scam concern</option>
                  <option>Permit concern</option>
                  <option>Incorrect category</option>
                  <option>Other</option>
                </select>
                <textarea name="details" rows={3} className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-white" />
                <button className="w-fit rounded-lg border border-red-300/20 px-4 py-2 text-sm font-black text-red-100">
                  Submit Report
                </button>
              </form>
            </details>
          )}

          {canEdit && (
            <form action={softDeleteCommunityDiscussion} className="mt-6">
              <input type="hidden" name="discussion_id" value={discussion.id} />
              <button className="text-sm font-bold text-red-300 underline">
                Delete discussion
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function CommunityImageGrid({
  images,
  className = "",
  compact = false,
}: {
  images: CommunityImage[];
  className?: string;
  compact?: boolean;
}) {
  if (!images.length) return null;

  return (
    <div className={`${className} grid gap-3 ${compact ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      {images.map((image) => (
        <figure
          key={image.id}
          className="overflow-hidden rounded-lg border border-white/10 bg-black/20"
        >
          <a href={image.image_url} target="_blank" rel="noopener noreferrer">
            <Image
              src={image.image_url}
              alt={image.alt_text || image.caption || "Community image"}
              width={1200}
              height={900}
              className={`${compact ? "max-h-56" : "max-h-96"} w-full object-cover`}
            />
          </a>
          {image.caption && (
            <figcaption className="px-3 py-2 text-xs leading-5 text-emerald-50/60">
              {image.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

function MarketplaceDetailsPanel({ details }: { details: MarketplaceDetails }) {
  return (
    <section className="mt-6 rounded-lg border border-yellow-300/20 bg-yellow-300/10 p-4">
      <h2 className="font-black text-yellow-50">Marketplace Connection</h2>
      <p className="mt-2 text-sm leading-6 text-yellow-50/75">
        Isopedia only provides a space for community members to connect. Users
        are responsible for laws, permits, shipping restrictions, and transaction terms.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MarketplaceField label="Type" value={details.listing_type} />
        <MarketplaceField label="Status" value={details.listing_status} />
        <MarketplaceField label="Species/Product" value={details.species_or_product} />
        <MarketplaceField label="Quantity" value={details.quantity} />
        <MarketplaceField label="Price" value={details.price} />
        <MarketplaceField label="Location" value={[details.location, details.state].filter(Boolean).join(", ")} />
        <MarketplaceField label="Shipping" value={details.shipping_available ? "Available" : "Not listed"} />
        <MarketplaceField label="Local Pickup" value={details.local_pickup_available ? "Available" : "Not listed"} />
      </div>
    </section>
  );
}

function MarketplaceField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-md border border-yellow-100/10 bg-[#07130c]/70 p-3">
      <div className="text-xs font-black uppercase tracking-wide text-yellow-50/50">{label}</div>
      <div className="mt-1 text-sm text-yellow-50/85">{value || "Not listed"}</div>
    </div>
  );
}
