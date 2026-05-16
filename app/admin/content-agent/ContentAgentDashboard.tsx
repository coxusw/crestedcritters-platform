import Link from "next/link";
import {
  approveContentPost,
  createExpoRoundupPostAction,
  createIsopediaStatsPostAction,
  createLatestSpeciesAnnouncementAction,
  generateNextContentAction,
  generateNextImageAction,
  postDueAction,
  publishContentPostNow,
  rejectContentPost,
} from "./actions";
import type { ContentAgentPost } from "@/lib/content-agent/types";

type Counts = {
  draft: number;
  approved: number;
  posted: number;
  error: number;
  pages: number;
  topics: number;
  pendingImages: number;
};

export default function ContentAgentDashboard({
  counts,
  posts,
  notice,
  error,
}: {
  counts: Counts;
  posts: ContentAgentPost[];
  notice?: string;
  error?: string;
}) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
            Crested Critters Platform
          </p>
          <h1 className="mt-3 text-3xl font-bold">Facebook Content Agent</h1>
          <p className="mt-3 max-w-3xl text-slate-300">
            Database-backed replacement for the Google Sheet agent. Generate
            drafts, create missing images, approve posts, and publish due
            approved content.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/admin/content-agent/settings"
              className="rounded-2xl bg-sky-400 px-4 py-2 text-sm font-bold text-slate-950 shadow-lg shadow-sky-950/30 transition hover:bg-sky-300"
            >
              Settings & Schedule
            </Link>
            <Link
              href="/admin/content-agent/topics"
              className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-300"
            >
              TopicBank Editor
            </Link>
            <Link
              href="/admin/isopedia"
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            >
              Isopedia Admin
            </Link>
          </div>
        </header>

        {notice && (
          <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-100">
            <div className="font-semibold">Success</div>
            <pre className="mt-2 whitespace-pre-wrap text-sm">{notice}</pre>
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-4 text-red-100">
            <div className="font-semibold">Action Error</div>
            <pre className="mt-2 whitespace-pre-wrap text-sm">{error}</pre>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
          <StatCard label="Drafts" value={counts.draft} />
          <StatCard label="Approved" value={counts.approved} />
          <StatCard label="Posted" value={counts.posted} />
          <StatCard label="Errors" value={counts.error} alert={counts.error > 0} />
          <StatCard label="Pages" value={counts.pages} />
          <StatCard label="Topics" value={counts.topics} />
          <StatCard label="Need Images" value={counts.pendingImages} alert={counts.pendingImages > 0} />
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Link
            href="/admin/content-agent/settings"
            className="rounded-3xl border border-sky-400/30 bg-sky-400/10 p-5 transition hover:-translate-y-0.5 hover:border-sky-300"
          >
            <p className="text-sm uppercase tracking-[0.25em] text-sky-300">
              Control Center
            </p>
            <h2 className="mt-2 text-xl font-bold">Settings & Schedule</h2>
            <p className="mt-2 text-sm text-slate-300">
              Edit auto approve, auto publish, buffer days, schedules, hashtags,
              brand rules, and page settings.
            </p>
          </Link>

          <Link
            href="/admin/content-agent/topics"
            className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-5 transition hover:-translate-y-0.5 hover:border-emerald-300"
          >
            <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">
              Content Ideas
            </p>
            <h2 className="mt-2 text-xl font-bold">TopicBank Editor</h2>
            <p className="mt-2 text-sm text-slate-300">
              Add, edit, deactivate, and rotate topics for each Facebook page.
            </p>
          </Link>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-xl font-semibold">Main Actions</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <ActionButton action={generateNextContentAction} label="Generate Next Posts" />
              <ActionButton action={generateNextImageAction} label="Generate Next Image" />
              <ActionButton action={postDueAction} label="Post Approved Due" />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-xl font-semibold">Isopedia Smart Posts</h2>
            <p className="mt-1 text-sm text-slate-400">
              These create Draft rows from real Isopedia data.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <ActionButton action={createLatestSpeciesAnnouncementAction} label="Latest Species Post" />
              <ActionButton action={createIsopediaStatsPostAction} label="Stats Recap" />
              <ActionButton action={createExpoRoundupPostAction} label="Expo Roundup" />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Recent Queue</h2>
              <p className="text-sm text-slate-400">
                Newest scheduled rows from content_agent_posts. Tap “View full post” to expand long captions.
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Scheduled</th>
                  <th className="px-3 py-2">Page</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Topic / Caption</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Image</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-b border-white/5 align-top">
                    <td className="whitespace-nowrap px-3 py-3 text-slate-300">
                      {new Date(post.scheduled_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-3">{post.page_key}</td>
                    <td className="px-3 py-3">{post.post_type}</td>
                    <td className="min-w-[280px] max-w-2xl px-3 py-3">
                      <div className="font-semibold text-slate-100">
                        {post.topic || "Untitled"}
                      </div>

                      <p className="mt-1 line-clamp-3 text-slate-400">
                        {post.caption || "No caption yet."}
                      </p>

                      <details className="mt-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                        <summary className="cursor-pointer select-none text-sm font-semibold text-emerald-300">
                          View full post
                        </summary>

                        <div className="mt-3 space-y-4 text-slate-300">
                          <DetailBlock label="Topic" value={post.topic} />
                          <DetailBlock label="Caption" value={post.caption} preserve />
                          <DetailBlock label="Hashtags" value={post.hashtags} preserve />

                          {(post.meme_top_text || post.meme_bottom_text) && (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <DetailBlock label="Meme Top Text" value={post.meme_top_text} />
                              <DetailBlock label="Meme Bottom Text" value={post.meme_bottom_text} />
                            </div>
                          )}

                          <DetailBlock label="Image Prompt" value={post.image_prompt} preserve />
                          <DetailBlock label="Source Type" value={post.source_type} />
                          <DetailBlock label="Source Ref ID" value={post.source_ref_id} />

                          {post.facebook_post_url && (
                            <div>
                              <div className="text-xs uppercase tracking-wide text-slate-500">
                                Facebook Post
                              </div>
                              <a
                                className="mt-1 inline-block text-emerald-300 underline"
                                href={post.facebook_post_url}
                                target="_blank"
                              >
                                Open Facebook post
                              </a>
                            </div>
                          )}

                          {post.error && (
                            <div className="rounded-xl bg-red-500/10 p-3 text-red-200">
                              <div className="text-xs uppercase tracking-wide text-red-300">
                                Error
                              </div>
                              <pre className="mt-1 whitespace-pre-wrap text-sm">{post.error}</pre>
                            </div>
                          )}
                        </div>
                      </details>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-xs">
                        {post.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {post.image_url ? (
                        <a className="text-emerald-300 underline" href={post.image_url} target="_blank">
                          Image
                        </a>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="space-y-2 px-3 py-3">
                      <Link
                        href={`/admin/content-agent/edit/${post.id}`}
                        className="inline-block rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
                      >
                        Edit
                      </Link>

                      {post.status !== "Approved" && post.status !== "Posted" && (
                        <form action={approveContentPost.bind(null, post.id)}>
                          <button className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950">
                            Approve
                          </button>
                        </form>
                      )}

                      {post.status !== "Rejected" && post.status !== "Posted" && (
                        <form action={publishContentPostNow.bind(null, post.id)}>
                          <button className="rounded-xl bg-sky-400 px-3 py-1.5 text-xs font-semibold text-slate-950">
                            Publish Now
                          </button>
                        </form>
                      )}

                      {post.status !== "Rejected" && post.status !== "Posted" && (
                        <form action={rejectContentPost.bind(null, post.id)}>
                          <button className="rounded-xl bg-red-500/90 px-3 py-1.5 text-xs font-semibold text-white">
                            Reject
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {posts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                      No content agent posts yet. Run Generate Next Posts.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function DetailBlock({
  label,
  value,
  preserve = false,
}: {
  label: string;
  value?: string | null;
  preserve?: boolean;
}) {
  if (!value) return null;

  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-1 rounded-xl bg-slate-900/80 p-3 text-sm text-slate-200 ${preserve ? "whitespace-pre-wrap" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function StatCard({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className={`rounded-3xl border p-4 ${alert ? "border-amber-400/40 bg-amber-400/10" : "border-white/10 bg-white/5"}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

function ActionButton({
  action,
  label,
}: {
  action: () => Promise<void>;
  label: string;
}) {
  return (
    <form action={action}>
      <button className="w-full rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-300">
        {label}
      </button>
    </form>
  );
}
