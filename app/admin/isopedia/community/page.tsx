import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import {
  generateWeeklyPrompt,
  moderateCommunityDiscussion,
  resolveCommunityReport,
  saveCommunityCategory,
  saveRecurringPrompt,
} from "@/app/admin/isopedia/community/actions";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  display_order: number;
  is_active: boolean;
  requires_approval: boolean;
  marketplace_rules: boolean;
  species_tagging_enabled: boolean;
  images_enabled: boolean;
  staff_only_posting: boolean;
  posting_guidelines: string | null;
  minimum_account_age_days: number;
};

type Discussion = {
  id: string;
  title: string;
  slug: string;
  status: string;
  moderation_status: string;
  content_type: string;
  pinned: boolean;
  featured: boolean;
  locked: boolean;
  report_count: number;
  created_at: string;
  author: ProfileSummary | null;
  category: { name: string | null; slug: string | null } | null;
};

type ProfileSummary = {
  username: string | null;
  display_name: string | null;
  business_name: string | null;
};

type Report = {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  moderator_notes: string | null;
  action_taken: string | null;
  created_at: string;
  reporter: ProfileSummary | null;
  discussion: {
    id: string;
    title: string | null;
    slug: string | null;
    status: string | null;
    locked: boolean | null;
    author: ProfileSummary | null;
  } | null;
  reply: {
    id: string;
    body: string | null;
    status: string | null;
    author: ProfileSummary | null;
    discussion: {
      id: string;
      title: string | null;
      slug: string | null;
      status: string | null;
      locked: boolean | null;
    } | null;
  } | null;
};

type ModerationHistory = {
  id: string;
  action: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  moderator: ProfileSummary | null;
  discussion: {
    id: string;
    title: string | null;
    slug: string | null;
    status: string | null;
  } | null;
  reply: {
    id: string;
    body: string | null;
    status: string | null;
    discussion: {
      id: string;
      title: string | null;
      slug: string | null;
    } | null;
  } | null;
};

type Prompt = {
  id: string;
  title: string;
  description: string | null;
  weekday: number;
  enabled: boolean;
  category_id: string | null;
  pin_for_days: number;
};

const inputClass =
  "rounded-md border border-white/10 bg-[#07130c] p-2 text-sm text-white";

const weekdayOptions = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ data: profile }, { data: adminProfile }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: string | null }>(),
    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
  ]);

  if (!adminProfile && profile?.role !== "admin" && profile?.role !== "moderator") {
    redirect("/admin/login");
  }
}

export default async function AdminCommunityPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    reports?: string;
    discussions?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = createSupabaseAdminClient();
  const reportFilter = params.reports || "open";
  const discussionFilter = params.discussions || "attention";

  let discussionQuery = supabase
    .from("community_discussions")
    .select(
      `
      id,
      title,
      slug,
      status,
      moderation_status,
      content_type,
      pinned,
      featured,
      locked,
      report_count,
      created_at,
      author:author_id (
        username,
        display_name,
        business_name
      ),
      category:category_id (
        name,
        slug
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (discussionFilter === "attention") {
    discussionQuery = discussionQuery.or(
      "status.eq.pending,moderation_status.eq.flagged,report_count.gt.0"
    );
  } else if (discussionFilter === "pending") {
    discussionQuery = discussionQuery.eq("status", "pending");
  } else if (discussionFilter === "reported") {
    discussionQuery = discussionQuery.gt("report_count", 0);
  } else if (discussionFilter === "hidden") {
    discussionQuery = discussionQuery.in("status", ["hidden", "removed"]);
  } else if (discussionFilter === "archived") {
    discussionQuery = discussionQuery.eq("status", "archived");
  } else if (discussionFilter === "locked") {
    discussionQuery = discussionQuery.eq("locked", true);
  } else if (discussionFilter === "marketplace") {
    discussionQuery = discussionQuery.eq("content_type", "marketplace");
  }

  let reportQuery = supabase
    .from("community_reports")
    .select(
      `
      id,
      reason,
      details,
      status,
      moderator_notes,
      action_taken,
      created_at,
      reporter:reporter_id (
        username,
        display_name,
        business_name
      ),
      discussion:discussion_id (
        id,
        title,
        slug,
        status,
        locked,
        author:author_id (
          username,
          display_name,
          business_name
        )
      ),
      reply:reply_id (
        id,
        body,
        status,
        author:author_id (
          username,
          display_name,
          business_name
        ),
        discussion:discussion_id (
          id,
          title,
          slug,
          status,
          locked
        )
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (reportFilter !== "all") {
    reportQuery = reportQuery.eq("status", reportFilter);
  }

  const [categories, discussions, reports, prompts, history] = await Promise.all([
    supabase
      .from("community_categories")
      .select("*")
      .order("display_order", { ascending: true })
      .returns<Category[]>(),
    discussionQuery.returns<Discussion[]>(),
    reportQuery.returns<Report[]>(),
    supabase
      .from("community_recurring_prompts")
      .select("id, title, description, weekday, enabled, category_id, pin_for_days")
      .order("weekday", { ascending: true })
      .returns<Prompt[]>(),
    supabase
      .from("community_moderation_history")
      .select(
        `
        id,
        action,
        notes,
        metadata,
        created_at,
        moderator:moderator_id (
          username,
          display_name,
          business_name
        ),
        discussion:discussion_id (
          id,
          title,
          slug,
          status
        ),
        reply:reply_id (
          id,
          body,
          status,
          discussion:discussion_id (
            id,
            title,
            slug
          )
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<ModerationHistory[]>(),
  ]);
  const openReportCount = (reports.data || []).filter((report) => report.status === "open").length;
  const attentionDiscussionCount = (discussions.data || []).filter(
    (discussion) =>
      discussion.status === "pending" ||
      discussion.moderation_status === "flagged" ||
      discussion.report_count > 0
  ).length;

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/admin/isopedia" className="text-emerald-300 underline">
            Back to Isopedia Admin
          </Link>
          <Link href="/community" className="text-emerald-300 underline">
            View Community
          </Link>
        </div>

        <header className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
            Community Admin
          </p>
          <h1 className="mt-2 text-3xl font-black">Community Controls</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Manage categories, moderation, reports, and weekly recurring prompts.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <AdminStat label="Open Reports" value={openReportCount} />
            <AdminStat label="Needs Review" value={attentionDiscussionCount} />
            <AdminStat label="Recent Actions" value={(history.data || []).length} />
          </div>
        </header>

        {params.saved && (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-100">
            {adminCommunitySavedMessage(params.saved)}
          </div>
        )}
        {params.error && (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-red-100">
            {adminCommunityErrorMessage(params.error)}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
            <h2 className="text-xl font-black">Categories</h2>
            <div className="mt-5 grid gap-4">
              {(categories.data || []).map((category) => (
                <CategoryForm key={category.id} category={category} />
              ))}
              <CategoryForm category={null} />
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Report Queue</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Review reported posts and replies, then resolve or action them.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <FilterLink href="/admin/isopedia/community?reports=open" active={reportFilter === "open"} label="Open" />
                  <FilterLink href="/admin/isopedia/community?reports=reviewing" active={reportFilter === "reviewing"} label="Reviewing" />
                  <FilterLink href="/admin/isopedia/community?reports=all" active={reportFilter === "all"} label="All" />
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {(reports.data || []).length ? (
                  (reports.data || []).map((report) => (
                    <ReportCard key={report.id} report={report} />
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No reports match this filter.</p>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
              <h2 className="text-xl font-black">Weekly Prompts</h2>
              <div className="mt-4 grid gap-3">
                {(prompts.data || []).map((prompt) => (
                  <div key={prompt.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <form action={saveRecurringPrompt} className="grid gap-3">
                      <input type="hidden" name="prompt_id" value={prompt.id} />
                      <label className="grid gap-1 text-sm">
                        <span className="font-bold text-slate-300">Title</span>
                        <input name="title" defaultValue={prompt.title} className={inputClass} />
                      </label>
                      <label className="grid gap-1 text-sm">
                        <span className="font-bold text-slate-300">Description</span>
                        <textarea name="description" defaultValue={prompt.description || ""} rows={3} className={inputClass} />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="grid gap-1 text-sm">
                          <span className="font-bold text-slate-300">Weekday</span>
                          <select name="weekday" defaultValue={prompt.weekday} className={inputClass}>
                            {weekdayOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="font-bold text-slate-300">Category</span>
                          <select name="category_id" defaultValue={prompt.category_id || ""} className={inputClass}>
                            {(categories.data || []).map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="font-bold text-slate-300">Pin Days</span>
                          <input name="pin_for_days" type="number" min={0} defaultValue={prompt.pin_for_days} className={inputClass} />
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-300">
                          <input name="enabled" type="checkbox" defaultChecked={prompt.enabled} className="h-4 w-4 accent-emerald-400" />
                          Enabled
                        </label>
                        <button className="rounded-md border border-emerald-400/25 px-3 py-2 text-sm font-black text-emerald-100 hover:bg-emerald-400/10">
                          Save Prompt
                        </button>
                      </div>
                    </form>
                    <form action={generateWeeklyPrompt} className="mt-3">
                      <input type="hidden" name="prompt_id" value={prompt.id} />
                      <button
                        disabled={!prompt.enabled}
                        className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                      >
                        Generate This Week
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Discussion Moderation</h2>
              <p className="mt-1 text-sm text-slate-400">
                Filter by posts that need review, or manage marketplace and locked threads.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterLink href="/admin/isopedia/community?discussions=attention" active={discussionFilter === "attention"} label="Needs Review" />
              <FilterLink href="/admin/isopedia/community?discussions=pending" active={discussionFilter === "pending"} label="Pending" />
              <FilterLink href="/admin/isopedia/community?discussions=reported" active={discussionFilter === "reported"} label="Reported" />
              <FilterLink href="/admin/isopedia/community?discussions=hidden" active={discussionFilter === "hidden"} label="Hidden" />
              <FilterLink href="/admin/isopedia/community?discussions=archived" active={discussionFilter === "archived"} label="Archived" />
              <FilterLink href="/admin/isopedia/community?discussions=locked" active={discussionFilter === "locked"} label="Locked" />
              <FilterLink href="/admin/isopedia/community?discussions=marketplace" active={discussionFilter === "marketplace"} label="Marketplace" />
              <FilterLink href="/admin/isopedia/community?discussions=all" active={discussionFilter === "all"} label="All" />
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {(discussions.data || []).length ? (
              (discussions.data || []).map((discussion) => (
              <div key={discussion.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link href={`/community/discussion/${discussion.slug}`} className="font-black text-white hover:text-emerald-200">
                      {discussion.title}
                    </Link>
                    <p className="mt-1 text-xs text-slate-400">
                      {discussion.content_type} / {discussion.status} / {discussion.moderation_status}
                      {discussion.report_count ? ` / ${discussion.report_count} reports` : ""}
                      {discussion.locked ? " / locked" : ""}
                      {discussion.pinned ? " / pinned" : ""}
                      {discussion.featured ? " / featured" : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      By {profileName(discussion.author)}
                      {discussion.category?.name ? ` / ${discussion.category.name}` : ""}
                      {" / "}
                      {formatDate(discussion.created_at)}
                    </p>
                  </div>
                  <form action={moderateCommunityDiscussion} className="flex flex-wrap gap-2">
                    <input type="hidden" name="discussion_id" value={discussion.id} />
                    <input type="hidden" name="discussion_slug" value={discussion.slug} />
                    {discussion.status === "pending" && <ModButton action="approve" label="Approve" />}
                    <ModButton action={discussion.locked ? "unlock" : "lock"} label={discussion.locked ? "Unlock" : "Lock"} />
                    <ModButton action={discussion.pinned ? "unpin" : "pin"} label={discussion.pinned ? "Unpin" : "Pin"} />
                    <ModButton action={discussion.featured ? "unfeature" : "feature"} label={discussion.featured ? "Unfeature" : "Feature"} />
                    <ModButton action={discussion.moderation_status === "flagged" ? "clear" : "flag"} label={discussion.moderation_status === "flagged" ? "Clear" : "Flag"} />
                    <ModButton action={["hidden", "removed", "archived"].includes(discussion.status) ? "restore" : "hide"} label={["hidden", "removed", "archived"].includes(discussion.status) ? "Restore" : "Hide"} />
                    {discussion.status !== "archived" && discussion.status !== "removed" && <ModButton action="archive" label="Archive" />}
                    {discussion.status !== "removed" && <ModButton action="remove" label="Remove" />}
                  </form>
                </div>
              </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No discussions match this filter.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Recent Moderation History</h2>
              <p className="mt-1 text-sm text-slate-400">
                Latest report resolutions, status changes, locks, removals, and staff actions.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {(history.data || []).length ? (
              (history.data || []).map((item) => (
                <ModerationHistoryCard key={item.id} item={item} />
              ))
            ) : (
              <p className="text-sm text-slate-400">No moderation actions have been recorded yet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function adminCommunitySavedMessage(value: string) {
  if (value === "category") return "Community category saved.";
  if (value === "report") return "Report queue item updated.";
  if (value === "moderation") return "Moderation action applied.";
  if (value === "prompt") return "Weekly prompt generated.";
  if (value === "prompt-settings") return "Weekly prompt settings saved.";
  if (value === "prompt-exists") return "This week's prompt already exists.";
  return "Community settings saved.";
}

function adminCommunityErrorMessage(value: string) {
  if (value === "category-name-required") return "Category name is required.";
  if (value === "missing-report") return "Report could not be found.";
  if (value === "prompt-not-found") return "Prompt could not be found.";
  if (value === "prompt-disabled") return "Enable this weekly prompt before generating it.";
  return value;
}

function AdminStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </div>
    </div>
  );
}

function CategoryForm({ category }: { category: Category | null }) {
  return (
    <form action={saveCommunityCategory} className="rounded-lg border border-white/10 bg-black/20 p-4">
      {category && <input type="hidden" name="category_id" value={category.id} />}
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="name" label="Name" defaultValue={category?.name || ""} />
        <Field name="slug" label="Slug" defaultValue={category?.slug || ""} />
        <Field name="icon" label="Icon" defaultValue={category?.icon || ""} />
        <Field name="color" label="Color" defaultValue={category?.color || ""} />
        <Field name="display_order" label="Order" defaultValue={String(category?.display_order ?? 100)} />
        <Field name="minimum_account_age_days" label="Min Account Age Days" defaultValue={String(category?.minimum_account_age_days ?? 0)} />
      </div>
      <label className="mt-3 grid gap-1">
        <span className="text-xs font-bold text-slate-300">Description</span>
        <textarea name="description" defaultValue={category?.description || ""} rows={2} className="rounded-md border border-white/10 bg-[#07130c] p-2 text-sm text-white" />
      </label>
      <label className="mt-3 grid gap-1">
        <span className="text-xs font-bold text-slate-300">Guidelines</span>
        <textarea name="posting_guidelines" defaultValue={category?.posting_guidelines || ""} rows={2} className="rounded-md border border-white/10 bg-[#07130c] p-2 text-sm text-white" />
      </label>
      <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-slate-200">
        <Check name="is_active" label="Active" checked={category?.is_active ?? true} />
        <Check name="requires_approval" label="Requires approval" checked={category?.requires_approval ?? false} />
        <Check name="marketplace_rules" label="Marketplace rules" checked={category?.marketplace_rules ?? false} />
        <Check name="species_tagging_enabled" label="Species tagging" checked={category?.species_tagging_enabled ?? true} />
        <Check name="images_enabled" label="Images enabled" checked={category?.images_enabled ?? true} />
        <Check name="staff_only_posting" label="Staff only" checked={category?.staff_only_posting ?? false} />
      </div>
      <button className="mt-4 rounded-md bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950">
        {category ? "Save Category" : "Create Category"}
      </button>
    </form>
  );
}

function ReportCard({ report }: { report: Report }) {
  const targetDiscussion = report.discussion || report.reply?.discussion || null;
  const isReplyReport = Boolean(report.reply);
  const targetStatus = report.reply?.status || report.discussion?.status || "unknown";
  const targetAuthor = report.reply?.author || report.discussion?.author || null;
  const preview = isReplyReport
    ? plainText(report.reply?.body || "")
    : report.discussion?.title || "Reported discussion";

  return (
    <form action={resolveCommunityReport} className="rounded-lg border border-white/10 bg-black/20 p-4">
      <input type="hidden" name="report_id" value={report.id} />
      {targetDiscussion?.id && <input type="hidden" name="discussion_id" value={targetDiscussion.id} />}
      {targetDiscussion?.slug && <input type="hidden" name="discussion_slug" value={targetDiscussion.slug} />}
      {report.reply?.id && <input type="hidden" name="reply_id" value={report.reply.id} />}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Badge tone="red" label={report.reason} />
            <Badge tone="slate" label={report.status} />
            <Badge tone="emerald" label={isReplyReport ? "Reply" : "Discussion"} />
            <Badge tone="slate" label={targetStatus} />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-200">{report.details || "No details provided."}</p>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{preview}</p>
          <p className="mt-2 text-xs text-slate-500">
            Reported by {profileName(report.reporter)} / Target author {profileName(targetAuthor)} / {formatDate(report.created_at)}
          </p>
          {targetDiscussion?.slug && (
            <Link
              className="mt-2 inline-block text-sm font-bold text-emerald-300 underline"
              href={`/community/discussion/${targetDiscussion.slug}`}
            >
              Open discussion
            </Link>
          )}
        </div>
      </div>

      <label className="mt-3 grid gap-1">
        <span className="text-xs font-bold text-slate-300">Moderator notes</span>
        <textarea
          name="moderator_notes"
          rows={2}
          defaultValue={report.moderator_notes || ""}
          className="rounded-md border border-white/10 bg-[#07130c] p-2 text-sm text-white"
          placeholder="What did you find or do?"
        />
      </label>

      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
        <select
          name="moderation_action"
          defaultValue=""
          className="rounded-md border border-white/10 bg-[#07130c] p-2 text-sm text-white"
        >
          <option value="">No content action</option>
          {isReplyReport ? (
            <>
              <option value="hide_reply">Hide reply</option>
              <option value="remove_reply">Remove reply</option>
              <option value="restore_reply">Restore reply</option>
            </>
          ) : (
            <>
              <option value="hide_discussion">Hide discussion</option>
              <option value="remove_discussion">Remove discussion</option>
              <option value="restore_discussion">Restore discussion</option>
              <option value="lock_discussion">Lock discussion</option>
              <option value="unlock_discussion">Unlock discussion</option>
            </>
          )}
        </select>

        <div className="flex flex-wrap gap-2">
          <button name="status" value="reviewing" className="rounded-md border border-sky-300/20 px-3 py-2 text-sm font-black text-sky-100 hover:bg-sky-400/10">
            Reviewing
          </button>
          <button name="status" value="resolved" className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-black text-slate-950">
            Resolve
          </button>
          <button name="status" value="ignored" className="rounded-md border border-white/10 px-3 py-2 text-sm font-black text-white hover:bg-white/10">
            Ignore
          </button>
        </div>
      </div>
    </form>
  );
}

function ModerationHistoryCard({ item }: { item: ModerationHistory }) {
  const targetDiscussion = item.discussion || item.reply?.discussion || null;
  const targetTitle = item.reply
    ? plainText(item.reply.body || "Moderated reply")
    : item.discussion?.title || "Moderated discussion";
  const targetStatus = item.reply?.status || item.discussion?.status || "unknown";

  return (
    <article className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Badge tone="emerald" label={item.action} />
            <Badge tone="slate" label={item.reply ? "Reply" : "Discussion"} />
            <Badge tone="slate" label={targetStatus} />
          </div>
          <h3 className="mt-3 line-clamp-2 font-black text-white">{targetTitle}</h3>
          <p className="mt-2 text-xs text-slate-500">
            By {profileName(item.moderator)} / {formatDate(item.created_at)}
          </p>
          {item.notes && (
            <p className="mt-2 text-sm leading-6 text-slate-300">{item.notes}</p>
          )}
          {formatHistoryMetadata(item.metadata) && (
            <p className="mt-2 text-xs text-slate-500">
              {formatHistoryMetadata(item.metadata)}
            </p>
          )}
        </div>
        {targetDiscussion?.slug && (
          <Link
            href={`/community/discussion/${targetDiscussion.slug}${item.reply ? `#reply-${item.reply.id}` : ""}`}
            className="rounded-md border border-emerald-400/20 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-400/10"
          >
            Open
          </Link>
        )}
      </div>
    </article>
  );
}

function FilterLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md border px-3 py-2 text-xs font-black ${
        active
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
          : "border-white/10 text-white hover:bg-white/10"
      }`}
    >
      {label}
    </Link>
  );
}

function Badge({ tone, label }: { tone: "red" | "emerald" | "slate"; label: string }) {
  const classes = {
    red: "border-red-300/20 bg-red-400/10 text-red-100",
    emerald: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
    slate: "border-white/10 bg-white/5 text-slate-200",
  };

  return (
    <span className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-wide ${classes[tone]}`}>
      {label}
    </span>
  );
}

function profileName(profile: ProfileSummary | null) {
  return profile?.display_name || profile?.business_name || profile?.username || "Unknown";
}

function plainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatHistoryMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata) return "";
  const reportId = typeof metadata.report_id === "string" ? metadata.report_id : "";
  const toCategorySlug =
    typeof metadata.to_category_slug === "string" ? metadata.to_category_slug : "";
  const status = typeof metadata.status === "string" ? metadata.status : "";
  return [
    reportId ? `Report ${reportId.slice(0, 8)}` : "",
    toCategorySlug ? `Moved to ${toCategorySlug}` : "",
    status ? `Status ${status}` : "",
  ]
    .filter(Boolean)
    .join(" / ");
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function Field({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold text-slate-300">{label}</span>
      <input name={name} defaultValue={defaultValue} className="rounded-md border border-white/10 bg-[#07130c] p-2 text-sm text-white" />
    </label>
  );
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" name={name} defaultChecked={checked} />
      {label}
    </label>
  );
}

function ModButton({ action, label }: { action: string; label: string }) {
  return (
    <button name="action" value={action} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/10">
      {label}
    </button>
  );
}
