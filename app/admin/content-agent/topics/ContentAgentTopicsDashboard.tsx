import Link from "next/link";
import {
  createContentAgentTopic,
  deleteContentAgentTopic,
  seedRequestedTopicPack,
  setContentAgentTopicActive,
  updateContentAgentTopic,
} from "./actions";
import { areSimilarTopics } from "@/lib/content-agent/topic-normalization";
import { requestedTopicSeedCounts, requestedTopicSeedTypeCounts } from "@/lib/content-agent/topic-seeds";

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
  const duplicateTopicIds = findDuplicateTopicIds(topics);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-[96rem] space-y-6">
        <header className="rounded-lg border border-white/10 bg-white/5 p-5 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
            Content Agent
          </p>
          <h1 className="mt-2 text-3xl font-bold">TopicBank Editor</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
            Dense table view for large topic banks. Filter by page, search by
            topic/type/notes, edit inline, and watch for possible duplicate
            topics before the generator starts repeating itself.
          </p>
        </header>

        {notice && (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-100">
            <div className="font-semibold">Saved</div>
            <pre className="mt-2 whitespace-pre-wrap text-sm">{notice}</pre>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-red-100">
            <div className="font-semibold">Error</div>
            <pre className="mt-2 whitespace-pre-wrap text-sm">{error}</pre>
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-5">
          <StatCard label="Shown Topics" value={topics.length} />
          <StatCard label="Active" value={activeCount} />
          <StatCard label="Inactive" value={inactiveCount} alert={inactiveCount > 0} />
          <StatCard label="Possible Dupes" value={duplicateTopicIds.size} alert={duplicateTopicIds.size > 0} />
          <StatCard label="Pages" value={pages.length} />
        </section>

        <section className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap gap-2">
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
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-emerald-300"
            />
            <button className="rounded-md bg-emerald-400 px-5 py-2 font-bold text-slate-950">
              Search
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-sky-400/30 bg-sky-400/10 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-sky-100">
                Huge Topic Pack
              </h2>
              <p className="mt-1 max-w-4xl text-sm leading-6 text-sky-100/80">
                Adds up to {requestedTopicSeedCounts["poverty-finance"]} Poverty
                Finance, {requestedTopicSeedCounts["tap-deck"]} Tap-Deck, and{" "}
                {requestedTopicSeedCounts["crested-critters"]} Crested Critters
                topics. Existing duplicate or similar topics are skipped.
              </p>
              <p className="mt-2 text-xs leading-5 text-sky-100/70">
                Seed balance: Poverty Finance has {requestedTopicSeedTypeCounts["poverty-finance"]["Broke Meme"] || 0} Broke Meme,
                {requestedTopicSeedTypeCounts["poverty-finance"]["Satire Humor"] || 0} Satire Humor, and{" "}
                {requestedTopicSeedTypeCounts["poverty-finance"]["Real Finance Tip"] || 0} Real Finance Tip topics.
                Crested Critters has {requestedTopicSeedTypeCounts["crested-critters"]["Meme"] || 0} Meme topics.
              </p>
            </div>
            <form action={seedRequestedTopicPack}>
              <button className="rounded-md bg-sky-300 px-5 py-2 font-bold text-slate-950 hover:bg-sky-200">
                Add Requested Topics
              </button>
            </form>
          </div>
        </section>

        <AddTopicCard pages={pages} activePageFilter={activePageFilter} />

        <section className="rounded-lg border border-white/10 bg-white/5">
          <div className="border-b border-white/10 p-4">
            <h2 className="text-lg font-bold">Topic Table</h2>
            <p className="mt-1 text-sm text-slate-400">
              Each row saves independently. Yellow rows may be duplicates or
              very close angles within the current filtered view.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Page</th>
                  <th className="px-3 py-2">Topic</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2">Use</th>
                  <th className="px-3 py-2">Active</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {topics.map((topic) => (
                  <TopicTableRow
                    key={topic.id}
                    topic={topic}
                    pageName={pageMap.get(topic.page_key) || topic.page_key}
                    isPossibleDuplicate={duplicateTopicIds.has(topic.id)}
                  />
                ))}
                {topics.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-slate-400">
                      No topics found for this filter.
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
    <form action={createContentAgentTopic} className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <label className="block lg:w-56">
          <span className="text-xs uppercase tracking-wide text-emerald-100/70">Page</span>
          <select
            name="page_key"
            defaultValue={defaultPage}
            className="mt-1 w-full rounded-md border border-white/10 bg-slate-950/90 px-3 py-2 text-slate-100"
          >
            {pages.map((page) => (
              <option key={page.page_key} value={page.page_key}>
                {page.page_name}
              </option>
            ))}
          </select>
        </label>

        <div className="min-w-0 flex-1">
          <TextField name="topic" label="New Topic" placeholder="Example: Moisture gradient troubleshooting" />
        </div>

        <div className="lg:w-64">
          <TextField name="post_type" label="Post Type" placeholder={postTypeHints[0] || "Educational"} />
        </div>
      </div>

      <div className="mt-3">
        <TextareaField name="notes" label="Notes / Prompt Direction" placeholder="Tell the generator what angle this topic should cover." rows={3} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-emerald-100/70">
          {postTypeHints.length > 0
            ? `Current page post type hints: ${postTypeHints.join(", ")}`
            : "Add a topic manually or use the big seed pack above."}
        </p>
        <button className="rounded-md bg-emerald-400 px-5 py-2 font-bold text-slate-950 hover:bg-emerald-300">
          Add Topic
        </button>
      </div>
    </form>
  );
}

function TopicTableRow({
  topic,
  pageName,
  isPossibleDuplicate,
}: {
  topic: TopicRow;
  pageName: string;
  isPossibleDuplicate: boolean;
}) {
  return (
    <tr className={`border-b border-white/5 align-top ${isPossibleDuplicate ? "bg-amber-400/10" : ""}`}>
      <td className="w-44 px-3 py-3">
        <div className="font-semibold text-slate-100">{pageName}</div>
        <div className="mt-1 text-xs text-slate-500">{topic.page_key}</div>
        {isPossibleDuplicate && (
          <div className="mt-2 rounded-md bg-amber-300 px-2 py-1 text-xs font-bold text-slate-950">
            similar
          </div>
        )}
      </td>
      <td className="w-[28rem] px-3 py-3">
        <form id={`topic-form-${topic.id}`} action={updateContentAgentTopic}>
          <input type="hidden" name="topic_id" value={topic.id} />
          <input type="hidden" name="page_key" value={topic.page_key} />
          <TextInput name="topic" defaultValue={topic.topic} />
        </form>
      </td>
      <td className="w-48 px-3 py-3">
        <TextInput form={`topic-form-${topic.id}`} name="post_type" defaultValue={topic.post_type} />
      </td>
      <td className="min-w-[26rem] px-3 py-3">
        <textarea
          form={`topic-form-${topic.id}`}
          name="notes"
          defaultValue={topic.notes || ""}
          rows={3}
          className="w-full rounded-md border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-300"
        />
      </td>
      <td className="w-40 px-3 py-3 text-xs text-slate-400">
        <div>Used {topic.use_count || 0}</div>
        <div className="mt-1">
          {topic.last_used_at
            ? new Date(topic.last_used_at).toLocaleDateString()
            : "Never used"}
        </div>
      </td>
      <td className="w-28 px-3 py-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            form={`topic-form-${topic.id}`}
            type="checkbox"
            name="active"
            defaultChecked={topic.active}
            className="h-4 w-4"
          />
          Active
        </label>
      </td>
      <td className="w-44 space-y-2 px-3 py-3">
        <button
          form={`topic-form-${topic.id}`}
          className="w-full rounded-md bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950"
        >
          Save
        </button>
        {topic.active ? (
          <form action={setContentAgentTopicActive.bind(null, topic.id, topic.page_key, false)}>
            <button className="w-full rounded-md bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950">
              Deactivate
            </button>
          </form>
        ) : (
          <form action={setContentAgentTopicActive.bind(null, topic.id, topic.page_key, true)}>
            <button className="w-full rounded-md bg-sky-400 px-3 py-2 text-xs font-bold text-slate-950">
              Reactivate
            </button>
          </form>
        )}
        <form action={deleteContentAgentTopic.bind(null, topic.id, topic.page_key)}>
          <button className="w-full rounded-md bg-red-500 px-3 py-2 text-xs font-bold text-white">
            Delete
          </button>
        </form>
      </td>
    </tr>
  );
}

function findDuplicateTopicIds(topics: TopicRow[]) {
  const duplicateIds = new Set<string>();

  for (let i = 0; i < topics.length; i += 1) {
    for (let j = i + 1; j < topics.length; j += 1) {
      const a = topics[i];
      const b = topics[j];

      if (a.page_key !== b.page_key) continue;

      if (areSimilarTopics(a.topic, b.topic)) {
        duplicateIds.add(a.id);
        duplicateIds.add(b.id);
      }
    }
  }

  return duplicateIds;
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
      className={`rounded-md px-3 py-2 text-sm font-semibold ${
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
    <div className={`rounded-lg border p-4 ${alert ? "border-amber-400/40 bg-amber-400/10" : "border-white/10 bg-white/5"}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

function TextInput({
  name,
  defaultValue,
  form,
}: {
  name: string;
  defaultValue: string;
  form?: string;
}) {
  return (
    <input
      form={form}
      name={name}
      defaultValue={defaultValue}
      className="w-full rounded-md border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-300"
    />
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
        className="mt-1 w-full rounded-md border border-white/10 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-emerald-300"
      />
    </label>
  );
}

function TextareaField({
  name,
  label,
  defaultValue = "",
  placeholder = "",
  rows = 4,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={rows}
        className="mt-1 w-full rounded-md border border-white/10 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-emerald-300"
      />
    </label>
  );
}
