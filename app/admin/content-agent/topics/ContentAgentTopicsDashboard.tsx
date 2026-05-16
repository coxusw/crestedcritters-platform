import Link from "next/link";
import {
  createContentAgentTopic,
  deleteContentAgentTopic,
  setContentAgentTopicActive,
  updateContentAgentTopic,
} from "./actions";

type PageRow = {
  page_key: string;
  page_name: string;
  schedule_slots: Array<{ time: string; postType: string }> | null;
  content_cycle: string[] | null;
};

type TopicRow = {
  id: string;
  page_key: string;
  topic: string;
  post_type: string;
  notes: string | null;
  active: boolean;
  last_used_at: string | null;
  use_count: number;
  created_at: string;
  updated_at: string;
};

export default function ContentAgentTopicsDashboard({
  pages,
  topics,
  activePageFilter,
  searchQuery,
  notice,
  error,
}: {
  pages: PageRow[];
  topics: TopicRow[];
  activePageFilter: string;
  searchQuery: string;
  notice?: string;
  error?: string;
}) {
  const activeCount = topics.filter((topic) => topic.active).length;
  const inactiveCount = topics.length - activeCount;

  const pageMap = new Map(pages.map((page) => [page.page_key, page.page_name]));

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
            Content Agent
          </p>
          <h1 className="mt-3 text-3xl font-bold">TopicBank Editor</h1>
          <p className="mt-3 max-w-3xl text-slate-300">
            Add, edit, deactivate, and rotate content topics. The generator only
            sends one selected topic to OpenAI at a time, so you can safely build
            a large topic bank.
          </p>
        </header>

        {notice && (
          <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-100">
            <div className="font-semibold">Saved</div>
            <pre className="mt-2 whitespace-pre-wrap text-sm">{notice}</pre>
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-4 text-red-100">
            <div className="font-semibold">Error</div>
            <pre className="mt-2 whitespace-pre-wrap text-sm">{error}</pre>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard label="Shown Topics" value={topics.length} />
          <StatCard label="Active" value={activeCount} />
          <StatCard label="Inactive" value={inactiveCount} alert={inactiveCount > 0} />
          <StatCard label="Pages" value={pages.length} />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap gap-3">
            <FilterLink href="/admin/content-agent/topics" active={activePageFilter === "all"}>
              All Pages
            </FilterLink>
            {pages.map((page) => (
              <FilterLink
                key={page.page_key}
                href={`/admin/content-agent/topics?page=${encodeURIComponent(page.page_key)}`}
                active={activePageFilter === page.page_key}
              >
                {page.page_name}
              </FilterLink>
            ))}
          </div>

          <form className="mt-4 flex flex-col gap-3 sm:flex-row" action="/admin/content-agent/topics">
            {activePageFilter !== "all" && (
              <input type="hidden" name="page" value={activePageFilter} />
            )}
            <input
              name="q"
              defaultValue={searchQuery}
              placeholder="Search topics, post types, or notes..."
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-emerald-300"
            />
            <button className="rounded-2xl bg-emerald-400 px-5 py-2 font-bold text-slate-950">
              Search
            </button>
          </form>
        </section>

        <AddTopicCard pages={pages} activePageFilter={activePageFilter} />

        <section className="grid gap-5">
          {topics.length ? (
            topics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                pages={pages}
                pageName={pageMap.get(topic.page_key) || topic.page_key}
              />
            ))
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
              No topics found for this filter.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function AddTopicCard({
  pages,
  activePageFilter,
}: {
  pages: PageRow[];
  activePageFilter: string;
}) {
  const defaultPage =
    activePageFilter && activePageFilter !== "all"
      ? activePageFilter
      : pages[0]?.page_key || "";

  const selectedPage = pages.find((page) => page.page_key === defaultPage);
  const postTypeHints = getPostTypeHints(selectedPage);

  return (
    <form action={createContentAgentTopic} className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-5">
      <h2 className="text-xl font-bold text-emerald-100">Add New Topic</h2>
      <p className="mt-1 text-sm text-emerald-100/80">
        Add more ideas for the generator to rotate through.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[220px_1fr_260px]">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-emerald-100/70">Page</span>
          <select
            name="page_key"
            defaultValue={defaultPage}
            className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-2 text-slate-100"
          >
            {pages.map((page) => (
              <option key={page.page_key} value={page.page_key}>
                {page.page_name}
              </option>
            ))}
          </select>
        </label>

        <TextField name="topic" label="Topic" placeholder="Example: Moisture gradient troubleshooting" />
        <TextField name="post_type" label="Post Type" placeholder={postTypeHints[0] || "Educational"} />
      </div>

      <div className="mt-4">
        <TextareaField name="notes" label="Notes / Prompt Direction" placeholder="Tell the generator what angle this topic should cover." />
      </div>

      {postTypeHints.length > 0 && (
        <p className="mt-3 text-xs text-emerald-100/70">
          Current page post type hints: {postTypeHints.join(", ")}
        </p>
      )}

      <button className="mt-5 rounded-2xl bg-emerald-400 px-5 py-2 font-bold text-slate-950 hover:bg-emerald-300">
        Add Topic
      </button>
    </form>
  );
}

function TopicCard({
  topic,
  pages,
  pageName,
}: {
  topic: TopicRow;
  pages: PageRow[];
  pageName: string;
}) {
  return (
    <article className={`rounded-3xl border p-5 ${topic.active ? "border-white/10 bg-white/5" : "border-white/5 bg-slate-900/60 opacity-75"}`}>
      <form action={updateContentAgentTopic}>
        <input type="hidden" name="topic_id" value={topic.id} />
        <input type="hidden" name="page_key" value={topic.page_key} />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
              {pageName}
            </p>
            <h2 className="mt-1 text-xl font-bold">{topic.topic}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {topic.post_type} · Used {topic.use_count || 0} time{topic.use_count === 1 ? "" : "s"}
              {topic.last_used_at ? ` · Last used ${new Date(topic.last_used_at).toLocaleString()}` : " · Never used"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950">
              Save
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_220px_160px]">
          <TextField name="topic" label="Topic" defaultValue={topic.topic} />
          <TextField name="post_type" label="Post Type" defaultValue={topic.post_type} />
          <label className="flex items-center gap-3 rounded-2xl bg-slate-950/70 p-4">
            <input
              type="checkbox"
              name="active"
              defaultChecked={topic.active}
              className="h-5 w-5"
            />
            <span className="font-semibold">Active</span>
          </label>
        </div>

        <div className="mt-4">
          <TextareaField name="notes" label="Notes" defaultValue={topic.notes || ""} />
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-3">
        {topic.active ? (
          <form action={setContentAgentTopicActive.bind(null, topic.id, topic.page_key, false)}>
            <button className="rounded-2xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950">
              Deactivate
            </button>
          </form>
        ) : (
          <form action={setContentAgentTopicActive.bind(null, topic.id, topic.page_key, true)}>
            <button className="rounded-2xl bg-sky-400 px-4 py-2 text-sm font-bold text-slate-950">
              Reactivate
            </button>
          </form>
        )}

        <form action={deleteContentAgentTopic.bind(null, topic.id, topic.page_key)}>
          <button className="rounded-2xl bg-red-500 px-4 py-2 text-sm font-bold text-white">
            Delete
          </button>
        </form>
      </div>
    </article>
  );
}

function getPostTypeHints(page?: PageRow) {
  if (!page) return [];

  const hints = new Set<string>();

  if (Array.isArray(page.schedule_slots)) {
    page.schedule_slots.forEach((slot) => {
      if (slot?.postType) hints.add(String(slot.postType));
    });
  }

  if (Array.isArray(page.content_cycle)) {
    page.content_cycle.forEach((item) => {
      if (item) hints.add(String(item));
    });
  }

  return Array.from(hints);
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
      className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
        active
          ? "bg-emerald-400 text-slate-950"
          : "border border-white/10 bg-slate-950/70 text-slate-200 hover:border-emerald-300/50"
      }`}
    >
      {children}
    </Link>
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

function TextField({
  name,
  label,
  defaultValue = "",
  placeholder = "",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-emerald-300"
      />
    </label>
  );
}

function TextareaField({
  name,
  label,
  defaultValue = "",
  placeholder = "",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={4}
        className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-emerald-300"
      />
    </label>
  );
}
