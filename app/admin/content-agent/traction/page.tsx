import Link from "next/link";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { parseTractionMetrics } from "@/lib/content-agent/traction";
import { updateTractionFromTable } from "./actions";

type PageProps = {
  searchParams?: Promise<{
    notice?: string;
    error?: string;
    page?: string;
  }>;
};

type PageRow = {
  page_key: string;
  page_name: string;
};

type PostedContentRow = {
  id: string;
  page_key: string;
  post_type: string;
  topic: string | null;
  caption: string | null;
  facebook_post_url: string | null;
  posted_at: string | null;
  raw_payload: Record<string, unknown> | null;
};

export default async function ContentAgentTractionPage({ searchParams }: PageProps) {
  await requireContentAgentAdmin();

  const params = await searchParams;
  const pageFilter = params?.page || "all";
  const supabase = createSupabaseAdminClient();

  const [{ data: pages, error: pagesError }, postsResult] = await Promise.all([
    supabase
      .from("content_agent_pages")
      .select("page_key, page_name")
      .order("page_name", { ascending: true })
      .returns<PageRow[]>(),
    buildPostedContentQuery(supabase, pageFilter),
  ]);

  if (pagesError) throw new Error(pagesError.message);
  if (postsResult.error) throw new Error(postsResult.error.message);

  const pageMap = new Map((pages || []).map((page) => [page.page_key, page.page_name]));
  const posts = (postsResult.data || []) as PostedContentRow[];
  const scoredPosts = posts
    .map((post) => parseTractionMetrics(post.raw_payload))
    .filter((traction) => traction.score > 0);
  const averageScore = scoredPosts.length
    ? Math.round(scoredPosts.reduce((sum, item) => sum + item.score, 0) / scoredPosts.length)
    : 0;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-[96rem] space-y-6">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link className="text-emerald-300 underline" href="/admin/content-agent">
            Back to Content Agent
          </Link>
          <Link className="text-emerald-300 underline" href="/admin/content-agent/topics">
            TopicBank
          </Link>
          <Link className="text-emerald-300 underline" href="/admin/content-agent/settings">
            Settings
          </Link>
        </div>

        <header className="rounded-lg border border-white/10 bg-white/5 p-5 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-300">
            Feedback Loop
          </p>
          <h1 className="mt-2 text-3xl font-bold">Traction Metrics</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
            Enter reactions, comments, shares, saves, and notes for posted
            content. The generator uses high-scoring posts to steer future
            content toward what is working.
          </p>
        </header>

        {params?.notice && (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-100">
            <div className="font-semibold">Saved</div>
            <pre className="mt-2 whitespace-pre-wrap text-sm">{params.notice}</pre>
          </div>
        )}

        {params?.error && (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-red-100">
            <div className="font-semibold">Error</div>
            <pre className="mt-2 whitespace-pre-wrap text-sm">{params.error}</pre>
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-4">
          <StatCard label="Posted Rows" value={posts.length} />
          <StatCard label="Rows With Metrics" value={scoredPosts.length} />
          <StatCard label="Average Score" value={averageScore} />
          <StatCard
            label="Best Score"
            value={scoredPosts.length ? Math.max(...scoredPosts.map((item) => item.score)) : 0}
          />
        </section>

        <section className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap gap-2">
            <FilterLink href="/admin/content-agent/traction" active={pageFilter === "all"}>
              All Pages
            </FilterLink>
            {(pages || []).map((page) => (
              <FilterLink
                key={page.page_key}
                href={`/admin/content-agent/traction?page=${encodeURIComponent(page.page_key)}`}
                active={pageFilter === page.page_key}
              >
                {page.page_name}
              </FilterLink>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/5">
          <div className="border-b border-white/10 p-4">
            <h2 className="text-lg font-bold">Posted Content</h2>
            <p className="mt-1 text-sm text-slate-400">
              Each row saves independently. Score weighting: reaction 1,
              comment 3, save 4, share 6.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1320px] w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Posted</th>
                  <th className="px-3 py-2">Page</th>
                  <th className="px-3 py-2">Topic</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Reactions</th>
                  <th className="px-3 py-2">Comments</th>
                  <th className="px-3 py-2">Shares</th>
                  <th className="px-3 py-2">Saves</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <TractionRow
                    key={post.id}
                    post={post}
                    pageName={pageMap.get(post.page_key) || post.page_key}
                  />
                ))}
                {posts.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-10 text-center text-slate-400">
                      No posted content found for this filter.
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

function buildPostedContentQuery(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  pageFilter: string
) {
  let query = supabase
    .from("content_agent_posts")
    .select("id, page_key, post_type, topic, caption, facebook_post_url, posted_at, raw_payload")
    .eq("status", "Posted")
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(250);

  if (pageFilter && pageFilter !== "all") {
    query = query.eq("page_key", pageFilter);
  }

  return query;
}

function TractionRow({
  post,
  pageName,
}: {
  post: PostedContentRow;
  pageName: string;
}) {
  const traction = parseTractionMetrics(post.raw_payload);
  const formId = `traction-form-${post.id}`;

  return (
    <tr className="border-b border-white/5 align-top">
      <td className="w-36 px-3 py-3 text-xs text-slate-400">
        {post.posted_at ? new Date(post.posted_at).toLocaleDateString() : "Unknown"}
      </td>
      <td className="w-44 px-3 py-3">
        <div className="font-semibold text-slate-100">{pageName}</div>
        <div className="mt-1 text-xs text-slate-500">{post.page_key}</div>
      </td>
      <td className="w-[24rem] px-3 py-3">
        <div className="font-semibold text-slate-100">{post.topic || "Untitled"}</div>
        <p className="mt-1 line-clamp-2 text-xs text-slate-400">
          {post.caption || "No caption."}
        </p>
        <div className="mt-2 flex gap-3 text-xs">
          <Link className="text-emerald-300 underline" href={`/admin/content-agent/edit/${post.id}`}>
            Edit
          </Link>
          {post.facebook_post_url && (
            <a className="text-emerald-300 underline" href={post.facebook_post_url} target="_blank">
              Facebook
            </a>
          )}
        </div>
      </td>
      <td className="w-40 px-3 py-3 text-slate-300">{post.post_type}</td>
      <td className="w-28 px-3 py-3">
        <NumberInput form={formId} name="reactions" defaultValue={traction.reactions} />
      </td>
      <td className="w-28 px-3 py-3">
        <NumberInput form={formId} name="comments" defaultValue={traction.comments} />
      </td>
      <td className="w-28 px-3 py-3">
        <NumberInput form={formId} name="shares" defaultValue={traction.shares} />
      </td>
      <td className="w-28 px-3 py-3">
        <NumberInput form={formId} name="saves" defaultValue={traction.saves} />
      </td>
      <td className="w-24 px-3 py-3">
        <span className="rounded-md border border-white/10 bg-white/10 px-2 py-1 text-xs font-bold">
          {traction.score}
        </span>
      </td>
      <td className="min-w-[20rem] px-3 py-3">
        <textarea
          form={formId}
          name="traction_notes"
          defaultValue={traction.notes}
          rows={3}
          placeholder="What worked? What should future posts copy stylistically?"
          className="w-full rounded-md border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-300"
        />
      </td>
      <td className="w-32 px-3 py-3">
        <form id={formId} action={updateTractionFromTable}>
          <input type="hidden" name="post_id" value={post.id} />
          <input type="hidden" name="page_key" value={post.page_key} />
          <button className="w-full rounded-md bg-sky-300 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-sky-200">
            Save
          </button>
        </form>
      </td>
    </tr>
  );
}

function NumberInput({
  form,
  name,
  defaultValue,
}: {
  form: string;
  name: string;
  defaultValue: number;
}) {
  return (
    <input
      form={form}
      type="number"
      min="0"
      step="1"
      name={name}
      defaultValue={defaultValue}
      className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-100 outline-none focus:border-sky-300"
    />
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 text-sm font-semibold ${
        active
          ? "bg-sky-300 text-slate-950"
          : "border border-white/10 bg-slate-950/70 text-slate-200 hover:border-sky-300/50"
      }`}
    >
      {children}
    </Link>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}
