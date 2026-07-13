import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  type CommunityCategory,
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
import CommunityFormShell from "@/app/community/CommunityFormShell";
import LinkifiedText from "@/app/community/LinkifiedText";
import {
  createCommunityReply,
  moderateCommunityDiscussionFromThread,
  reportCommunityContent,
  softDeleteCommunityReply,
  softDeleteCommunityDiscussion,
  toggleCommunityFollow,
  toggleCommunitySave,
  updateMarketplaceListingStatus,
  updateCommunityReply,
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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reported?: string; image_error?: string; form_error?: string }>;
}) {
  const { slug } = await params;
  const pageParams = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: viewerProfile }, { data: viewerAdminProfile }] = user
    ? await Promise.all([
        supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle<{ role: string | null }>(),
        supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const canModerate =
    Boolean(viewerAdminProfile) ||
    viewerProfile?.role === "admin" ||
    viewerProfile?.role === "moderator";
  const contentSupabase = canModerate ? createSupabaseAdminClient() : supabase;

  const { data: discussion, error } = await contentSupabase
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

  if (
    error ||
    !discussion ||
    (!["published", "expired"].includes(discussion.status) && !canModerate)
  ) {
    notFound();
  }

  await supabase.from("community_views").insert({
    discussion_id: discussion.id,
    profile_id: user?.id || null,
  });
  await supabase.rpc("community_recount_discussion_stats", {
      target_discussion_id: discussion.id,
  });

  const [repliesResult, speciesResult, marketplaceResult, savedResult, followedResult, categoriesResult] =
    await Promise.all([
      contentSupabase
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
      contentSupabase
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
      contentSupabase
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
      canModerate
        ? contentSupabase
            .from("community_categories")
            .select(
              "id, name, slug, description, icon, color, display_order, is_active, requires_approval, marketplace_rules, species_tagging_enabled, images_enabled, staff_only_posting, posting_guidelines, minimum_account_age_days"
            )
            .order("display_order", { ascending: true })
            .returns<CommunityCategory[]>()
        : Promise.resolve({ data: [] as CommunityCategory[] }),
    ]);

  const replyIds = (repliesResult.data || []).map((reply) => reply.id);
  const imageFilter = replyIds.length
    ? `discussion_id.eq.${discussion.id},reply_id.in.(${replyIds.join(",")})`
    : `discussion_id.eq.${discussion.id}`;
  const { data: images } = await contentSupabase
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
            {discussion.pinned && (
              <span className="rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-xs font-black uppercase tracking-wide text-amber-100">
                Pinned
              </span>
            )}
            {discussion.status !== "published" && (
              <span className="rounded-md border border-sky-300/20 bg-sky-300/10 px-2 py-1 text-xs font-black uppercase tracking-wide text-sky-100">
                {discussion.status}
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
            <MarketplaceDetailsPanel
              details={marketplaceResult.data}
              canManage={Boolean(user && (discussion.author_id === user.id || canModerate))}
              returnPath={returnPath}
            />
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

        {pageParams.reported === "1" && (
          <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">
            Report received. A moderator will review it.
          </div>
        )}
        {pageParams.image_error === "1" && (
          <div className="mt-4 rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm font-bold text-amber-50">
            Your post was saved, but one or more images could not be attached. Try editing the post and uploading the images again.
          </div>
        )}
        {pageParams.form_error && (
          <div className="mt-4 rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm font-bold text-amber-50">
            {pageParams.form_error}
          </div>
        )}

        {canModerate && (
          <StaffDiscussionControls
            discussion={discussion}
            categories={categoriesResult.data || []}
          />
        )}

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
                {user && (reply.author_id === user.id || canModerate) && (
                  <ReplyControls reply={reply} returnPath={returnPath} />
                )}
                {user && reply.author_id !== user.id && (
                  <ReplyReportForm replyId={reply.id} returnPath={returnPath} />
                )}
              </article>
            ))}
          </div>

          {user && !discussion.locked ? (
            <CommunityFormShell action={createCommunityReply} className="mt-6 grid gap-3">
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
                    Add up to 5 JPG, PNG, WEBP, or GIF images. Each image must be under 10MB.
                  </span>
                </label>
              )}
              <button
                data-submitting-label="Submitting..."
                className="w-fit rounded-lg bg-emerald-400 px-5 py-3 font-black text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Post Reply
              </button>
            </CommunityFormShell>
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

function StaffDiscussionControls({
  discussion,
  categories,
}: {
  discussion: CommunityDiscussion;
  categories: CommunityCategory[];
}) {
  return (
    <section className="mt-6 rounded-lg border border-sky-300/20 bg-sky-300/10 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-200">
            Staff Controls
          </p>
          <h2 className="mt-2 text-xl font-black text-white">Discussion Moderation</h2>
        </div>
        <Link href="/admin/isopedia/community" className="text-sm font-bold text-sky-200 underline">
          Community Admin
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ModerationButton
          discussionId={discussion.id}
          action={discussion.locked ? "unlock" : "lock"}
          label={discussion.locked ? "Unlock" : "Lock"}
        />
        <ModerationButton
          discussionId={discussion.id}
          action={discussion.pinned ? "unpin" : "pin"}
          label={discussion.pinned ? "Unpin" : "Pin"}
        />
        <ModerationButton
          discussionId={discussion.id}
          action={discussion.featured ? "unfeature" : "feature"}
          label={discussion.featured ? "Unfeature" : "Feature"}
        />
        <ModerationButton
          discussionId={discussion.id}
          action={discussion.answered ? "unanswered" : "answered"}
          label={discussion.answered ? "Mark Unanswered" : "Mark Answered"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <form action={moderateCommunityDiscussionFromThread} className="rounded-lg border border-white/10 bg-[#07130c] p-4">
          <input type="hidden" name="discussion_id" value={discussion.id} />
          <input type="hidden" name="action" value="move" />
          <label className="grid gap-2">
            <span className="text-sm font-black text-sky-100">Move Category</span>
            <select
              name="category_id"
              defaultValue={discussion.category_id}
              className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-white outline-none ring-sky-300/30 focus:ring-4"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <textarea
            name="moderator_notes"
            rows={2}
            placeholder="Optional moderator note"
            className="mt-3 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none ring-sky-300/30 focus:ring-4"
          />
          <button className="mt-3 rounded-lg bg-sky-300 px-4 py-2 text-sm font-black text-slate-950 hover:bg-sky-200">
            Move Discussion
          </button>
        </form>

        <form action={moderateCommunityDiscussionFromThread} className="rounded-lg border border-white/10 bg-[#07130c] p-4">
          <input type="hidden" name="discussion_id" value={discussion.id} />
          <input type="hidden" name="action" value="status" />
          <label className="grid gap-2">
            <span className="text-sm font-black text-sky-100">Visibility Status</span>
            <select
              name="status"
              defaultValue={discussion.status}
              className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-white outline-none ring-sky-300/30 focus:ring-4"
            >
              <option value="published">Published</option>
              <option value="hidden">Hidden</option>
              <option value="archived">Archived</option>
              <option value="removed">Removed</option>
            </select>
          </label>
          <textarea
            name="moderator_notes"
            rows={2}
            placeholder="Optional moderator note"
            className="mt-3 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none ring-sky-300/30 focus:ring-4"
          />
          <button className="mt-3 rounded-lg bg-sky-300 px-4 py-2 text-sm font-black text-slate-950 hover:bg-sky-200">
            Update Status
          </button>
        </form>
      </div>
    </section>
  );
}

function ModerationButton({
  discussionId,
  action,
  label,
}: {
  discussionId: string;
  action: string;
  label: string;
}) {
  return (
    <form action={moderateCommunityDiscussionFromThread}>
      <input type="hidden" name="discussion_id" value={discussionId} />
      <button
        name="action"
        value={action}
        className="rounded-lg border border-sky-300/20 px-4 py-2 text-sm font-black text-sky-100 hover:bg-sky-300/10"
      >
        {label}
      </button>
    </form>
  );
}

function ReplyControls({
  reply,
  returnPath,
}: {
  reply: CommunityReply;
  returnPath: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-white/10 pt-4">
      <details className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#07130c] p-3">
        <summary className="cursor-pointer text-sm font-black text-sky-100">
          Edit reply
        </summary>
        <form action={updateCommunityReply} className="mt-3 grid gap-3">
          <input type="hidden" name="reply_id" value={reply.id} />
          <input type="hidden" name="return_path" value={returnPath} />
          <textarea
            name="body"
            defaultValue={reply.body}
            required
            minLength={2}
            rows={5}
            className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none ring-emerald-400/30 focus:ring-4"
          />
          <button className="w-fit rounded-lg border border-sky-300/20 px-4 py-2 text-sm font-black text-sky-100 hover:bg-sky-300/10">
            Save Reply
          </button>
        </form>
      </details>

      <form action={softDeleteCommunityReply}>
        <input type="hidden" name="reply_id" value={reply.id} />
        <input type="hidden" name="return_path" value={returnPath} />
        <button className="rounded-lg border border-red-300/20 px-4 py-2 text-sm font-black text-red-100 hover:bg-red-400/10">
          Delete reply
        </button>
      </form>
    </div>
  );
}

function ReplyReportForm({
  replyId,
  returnPath,
}: {
  replyId: string;
  returnPath: string;
}) {
  return (
    <details className="mt-4 rounded-lg border border-white/10 bg-[#07130c] p-3">
      <summary className="cursor-pointer text-sm font-black text-red-100">
        Report reply
      </summary>
      <form action={reportCommunityContent} className="mt-3 grid gap-3">
        <input type="hidden" name="reply_id" value={replyId} />
        <input type="hidden" name="return_path" value={returnPath} />
        <select name="reason" className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
          <option>Spam</option>
          <option>Harassment</option>
          <option>Scam concern</option>
          <option>Permit concern</option>
          <option>Incorrect category</option>
          <option>Other</option>
        </select>
        <textarea
          name="details"
          rows={3}
          className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
          placeholder="Optional details"
        />
        <button className="w-fit rounded-lg border border-red-300/20 px-4 py-2 text-sm font-black text-red-100 hover:bg-red-400/10">
          Submit Report
        </button>
      </form>
    </details>
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

function MarketplaceDetailsPanel({
  details,
  canManage,
  returnPath,
}: {
  details: MarketplaceDetails;
  canManage: boolean;
  returnPath: string;
}) {
  const expiredByDate = isMarketplaceExpired(details);
  const effectiveStatus =
    expiredByDate && ["available", "pending"].includes(details.listing_status)
      ? "expired"
      : details.listing_status;

  return (
    <section className="mt-6 rounded-lg border border-yellow-300/20 bg-yellow-300/10 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-100/70">
            Marketplace Connection
          </p>
          <h2 className="mt-1 text-xl font-black text-yellow-50">
            {formatMarketplaceValue(details.species_or_product) || "Listing Details"}
          </h2>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${marketplaceStatusClass(effectiveStatus)}`}>
          {marketplaceLabel(effectiveStatus)}
        </span>
      </div>

      <p className="mt-2 text-sm leading-6 text-yellow-50/75">
        Isopedia only provides a space for community members to connect. Isopedia
        does not process payments, verify transactions, guarantee products, or
        participate in sales. Users are responsible for laws, permits, shipping
        restrictions, weather decisions, payment arrangements, and transaction terms.
      </p>

      {expiredByDate && details.listing_status !== "expired" && (
        <p className="mt-4 rounded-lg border border-red-300/20 bg-red-400/10 p-3 text-sm font-bold text-red-100">
          This listing has passed its expiration date.
        </p>
      )}
      <p className="mt-3 text-sm font-bold text-yellow-50/70">
        {marketplaceStatusDescription(effectiveStatus)}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MarketplaceField label="Listing Type" value={marketplaceLabel(details.listing_type)} />
        <MarketplaceField label="Species/Product" value={details.species_or_product} />
        <MarketplaceField label="Quantity" value={details.quantity} />
        <MarketplaceField label="Price" value={details.price} />
        <MarketplaceField label="Location" value={[details.location, details.state].filter(Boolean).join(", ")} />
        <MarketplaceField label="Shipping" value={details.shipping_available ? "Available" : "Not listed"} />
        <MarketplaceField label="Local Pickup" value={details.local_pickup_available ? "Available" : "Not listed"} />
        <MarketplaceField label="Expo" value={details.expo_name} />
        <MarketplaceField label="Expires" value={formatMarketplaceDate(details.expiration_date)} />
        <MarketplaceField label="Preferred Contact" value={details.preferred_contact_method} />
      </div>

      {details.permit_notes && (
        <div className="mt-3 rounded-md border border-yellow-100/10 bg-[#07130c]/70 p-3">
          <div className="text-xs font-black uppercase tracking-wide text-yellow-50/50">
            Permit or Shipping Notes
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-yellow-50/85">
            {details.permit_notes}
          </p>
        </div>
      )}

      {canManage && (
        <div className="mt-4 rounded-lg border border-yellow-100/10 bg-[#07130c]/70 p-3">
          <div className="flex flex-wrap gap-2">
            <MarketplaceStatusButton
              discussionId={details.discussion_id}
              returnPath={returnPath}
              status="available"
              label={effectiveStatus === "expired" ? "Renew 30 Days" : "Mark Available"}
              currentStatus={effectiveStatus}
            />
            <MarketplaceStatusButton
              discussionId={details.discussion_id}
              returnPath={returnPath}
              status="pending"
              label="Mark Pending"
              currentStatus={effectiveStatus}
            />
            <MarketplaceStatusButton
              discussionId={details.discussion_id}
              returnPath={returnPath}
              status="completed"
              label="Mark Completed"
              currentStatus={effectiveStatus}
            />
            <MarketplaceStatusButton
              discussionId={details.discussion_id}
              returnPath={returnPath}
              status="withdrawn"
              label="Withdraw"
              currentStatus={effectiveStatus}
            />
            <MarketplaceStatusButton
              discussionId={details.discussion_id}
              returnPath={returnPath}
              status="expired"
              label="Expire"
              currentStatus={effectiveStatus}
            />
          </div>

          <form action={updateMarketplaceListingStatus} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="discussion_id" value={details.discussion_id} />
            <input type="hidden" name="return_path" value={returnPath} />
            <label className="grid flex-1 gap-2">
              <span className="text-sm font-black text-yellow-50/85">Listing Status</span>
              <select
                name="listing_status"
                defaultValue={details.listing_status}
                className="rounded-lg border border-yellow-100/10 bg-black/20 px-4 py-3 text-white outline-none ring-yellow-300/30 focus:ring-4"
              >
                <option value="available">Available</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="expired">Expired</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </label>
            <button className="rounded-lg bg-yellow-300 px-4 py-3 text-sm font-black text-slate-950 hover:bg-yellow-200">
              Update Status
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

function MarketplaceStatusButton({
  discussionId,
  returnPath,
  status,
  label,
  currentStatus,
}: {
  discussionId: string;
  returnPath: string;
  status: string;
  label: string;
  currentStatus: string;
}) {
  const disabled = currentStatus === status;

  return (
    <form action={updateMarketplaceListingStatus}>
      <input type="hidden" name="discussion_id" value={discussionId} />
      <input type="hidden" name="return_path" value={returnPath} />
      <input type="hidden" name="listing_status" value={status} />
      <button
        disabled={disabled}
        className="rounded-lg border border-yellow-100/15 px-3 py-2 text-xs font-black text-yellow-50 hover:bg-yellow-300/10 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {label}
      </button>
    </form>
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

function marketplaceLabel(value: string | null) {
  if (!value) return "Not listed";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMarketplaceValue(value: string | null) {
  return value?.trim() || null;
}

function formatMarketplaceDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function isMarketplaceExpired(details: MarketplaceDetails) {
  if (!details.expiration_date) return false;
  const expiration = new Date(`${details.expiration_date}T23:59:59`);
  return expiration.getTime() < Date.now();
}

function marketplaceStatusClass(status: string) {
  if (status === "available") return "border border-lime-300/20 bg-lime-300/15 text-lime-100";
  if (status === "pending") return "border border-amber-300/20 bg-amber-300/15 text-amber-100";
  if (status === "completed") return "border border-sky-300/20 bg-sky-300/15 text-sky-100";
  if (status === "withdrawn") return "border border-slate-300/20 bg-slate-300/15 text-slate-100";
  return "border border-red-300/20 bg-red-300/15 text-red-100";
}

function marketplaceStatusDescription(status: string) {
  if (status === "available") return "This listing is active and open for interested members.";
  if (status === "pending") return "This listing is paused while the owner works through a possible match.";
  if (status === "completed") return "This listing is complete and kept visible for community context.";
  if (status === "withdrawn") return "This listing was withdrawn by the owner or staff.";
  return "This listing is expired and should be renewed before members treat it as active.";
}
