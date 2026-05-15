import {
  approveContentPost,
  createExpoRoundupPostAction,
  createIsopediaStatsPostAction,
  createLatestSpeciesAnnouncementAction,
  generateNextContentAction,
  generateNextImageAction,
  postDueAction,
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
                Newest scheduled rows from content_agent_posts.
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
                    <td className="max-w-xl px-3 py-3">
                      <div className="font-semibold text-slate-100">{post.topic || "Untitled"}</div>
                      <div className="mt-1 line-clamp-3 text-slate-400">{post.caption || ""}</div>
                      {post.error && (
                        <div className="mt-2 rounded-xl bg-red-500/10 p-2 text-red-200">
                          {post.error}
                        </div>
                      )}
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
                      {post.status !== "Approved" && post.status !== "Posted" && (
                        <form action={approveContentPost.bind(null, post.id)}>
                          <button className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950">
                            Approve
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
