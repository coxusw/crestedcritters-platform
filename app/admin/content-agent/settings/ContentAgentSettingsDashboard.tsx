import {
  applyDailyMemeSchedule,
  createContentAgentPage,
  updateContentAgentPageSettings,
} from "./actions";

type ContentAgentPageRow = {
  id: string;
  page_key: string;
  page_name: string;
  active: boolean;
  auto_publish_enabled: boolean;
  auto_approve_generated: boolean;
  meta_page_id: string | null;
  token_env_key: string | null;
  target_buffer_days: number;
  schedule_slots: Array<{ time: string; postType: string }> | null;
  content_cycle: string[] | null;
  default_hashtags: string | null;
  brand_rules: string | null;
  text_style: string | null;
  meme_style: string | null;
  website_url: string | null;
  updated_at: string | null;
};

type LogRow = {
  id: number;
  created_at: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  result: string | null;
  details: string | null;
};

const POST_TYPE_HINTS = [
  "Educational",
  "Meme",
  "Informational",
  "Networking Tip",
  "Real Finance Tip",
  "Satire Humor",
  "Broke Roast",
  "Broke Meme",
  "Growth Post",
  "Species Spotlight",
  "Community Stats",
  "Weekly Expo Roundup",
  "Verified Species Announcement",
];

export default function ContentAgentSettingsDashboard({
  pages,
  logs,
  notice,
  error,
}: {
  pages: ContentAgentPageRow[];
  logs: LogRow[];
  notice?: string;
  error?: string;
}) {
  const autoPublishCount = pages.filter((page) => page.auto_publish_enabled).length;
  const autoApproveCount = pages.filter((page) => page.auto_approve_generated).length;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
            Content Agent
          </p>
          <h1 className="mt-3 text-3xl font-bold">Settings & Schedule Editor</h1>
          <p className="mt-3 max-w-3xl text-slate-300">
            Edit page schedules, automation toggles, brand rules, hashtags, and buffer settings without opening Supabase.
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
          <StatCard label="Pages" value={pages.length} />
          <StatCard label="Auto Approve" value={autoApproveCount} alert={autoApproveCount > 0} />
          <StatCard label="Auto Publish" value={autoPublishCount} alert={autoPublishCount > 0} />
          <StatCard label="Recent Logs" value={logs.length} />
        </section>

        <section className="rounded-3xl border border-amber-400/30 bg-amber-400/10 p-5 text-amber-100">
          <h2 className="text-lg font-bold">Automation Safety</h2>
          <p className="mt-2 text-sm">
            Full automation needs both <strong>Auto Approve</strong> and <strong>Auto Publish</strong> turned on for a page.
            Turn on one page at a time. Start with Tap-Deck, then Isopedia, then Crested, then Poverty Finance.
          </p>
          <p className="mt-2 text-sm">
            Page tokens still belong in Vercel environment variables. The token env key is shown on each page card.
          </p>
        </section>

        <section className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-5 text-emerald-100">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Daily Meme Image Schedule</h2>
              <p className="mt-2 max-w-3xl text-sm">
                Adds one daily image meme slot for Crested Critters and one daily image meme slot for Poverty Finance.
                Existing slots stay in place; the content cycle override is cleared on those two pages so the schedule can rotate by slot type.
              </p>
            </div>
            <form action={applyDailyMemeSchedule}>
              <button className="rounded-2xl bg-emerald-400 px-5 py-2 font-bold text-slate-950 hover:bg-emerald-300">
                Apply Daily Meme Slots
              </button>
            </form>
          </div>
        </section>

        <section className="grid gap-6">
          {pages.map((page) => (
            <PageSettingsCard key={page.id} page={page} />
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <CreatePageCard />
          <RecentLogs logs={logs} />
        </section>
      </div>
    </main>
  );
}

function PageSettingsCard({ page }: { page: ContentAgentPageRow }) {
  const slots = normalizeSlots(page.schedule_slots);
  const paddedSlots = [...slots];

  while (paddedSlots.length < 6) {
    paddedSlots.push({ time: "", postType: "" });
  }

  const contentCycle = Array.isArray(page.content_cycle)
    ? page.content_cycle.join(", ")
    : "";

  return (
    <form
      action={updateContentAgentPageSettings}
      className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl"
    >
      <input type="hidden" name="page_key" value={page.page_key} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
            {page.page_key}
          </p>
          <h2 className="mt-1 text-2xl font-bold">{page.page_name}</h2>
          <p className="mt-1 text-sm text-slate-400">
            Token env: <code>{page.token_env_key || "Not set"}</code>
          </p>
        </div>

        <button className="rounded-2xl bg-emerald-400 px-5 py-2 font-bold text-slate-950 hover:bg-emerald-300">
          Save Page
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <CheckboxField name="active" label="Active" defaultChecked={page.active} />
        <CheckboxField
          name="auto_approve_generated"
          label="Auto Approve"
          defaultChecked={page.auto_approve_generated}
        />
        <CheckboxField
          name="auto_publish_enabled"
          label="Auto Publish"
          defaultChecked={page.auto_publish_enabled}
        />
        <NumberField
          name="target_buffer_days"
          label="Buffer Days"
          defaultValue={String(page.target_buffer_days || 30)}
        />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <TextField
          name="meta_page_id"
          label="Facebook Page ID"
          defaultValue={page.meta_page_id || ""}
          placeholder="Numeric Facebook Page ID"
        />
        <TextField
          name="website_url"
          label="Website URL"
          defaultValue={page.website_url || ""}
          placeholder="https://..."
        />
      </div>

      <div className="mt-5">
        <TextField
          name="default_hashtags"
          label="Default Hashtags"
          defaultValue={page.default_hashtags || ""}
          placeholder="#Example #Hashtags"
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <TextareaField
          name="brand_rules"
          label="Brand Rules"
          defaultValue={page.brand_rules || ""}
        />
        <TextareaField
          name="text_style"
          label="Text Style"
          defaultValue={page.text_style || ""}
        />
        <TextareaField
          name="meme_style"
          label="Meme/Image Style"
          defaultValue={page.meme_style || ""}
        />
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">Schedule Slots</h3>
            <p className="mt-1 text-sm text-slate-400">
              Use 24-hour time. Example: 09:00, 14:00, 20:30.
            </p>
          </div>
          <div className="max-w-xl text-xs text-slate-500">
            Post type examples: {POST_TYPE_HINTS.join(", ")}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {paddedSlots.map((slot, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <TextField
                name={`slot_time_${index}`}
                label={`Time ${index + 1}`}
                defaultValue={slot.time}
                placeholder="09:00"
              />
              <TextField
                name={`slot_type_${index}`}
                label={`Post Type ${index + 1}`}
                defaultValue={slot.postType}
                placeholder="Educational"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <TextareaField
          name="content_cycle"
          label="Content Cycle Override"
          defaultValue={contentCycle}
          help="Optional comma-separated cycle. Example: Real Finance Tip, Satire Humor, Satire Humor, Broke Meme. Leave blank to use the post type listed in each schedule slot."
        />
      </div>
    </form>
  );
}

function CreatePageCard() {
  return (
    <form action={createContentAgentPage} className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-xl font-bold">Add New Page</h2>
      <p className="mt-2 text-sm text-slate-400">
        This creates the database page row. You still need to add the matching Page token env var in Vercel.
      </p>

      <div className="mt-5 grid gap-4">
        <TextField name="page_name" label="Page Name" placeholder="Example Page" />
        <TextField name="page_key" label="Page Key" placeholder="examplepage" />
        <TextField name="meta_page_id" label="Facebook Page ID" placeholder="1234567890" />
        <TextField name="token_env_key" label="Token Env Key" placeholder="META_PAGE_TOKEN_EXAMPLEPAGE" />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField name="first_time" label="First Schedule Time" defaultValue="09:00" />
          <TextField name="first_post_type" label="First Post Type" defaultValue="Informational" />
        </div>
      </div>

      <button className="mt-5 rounded-2xl bg-sky-400 px-5 py-2 font-bold text-slate-950 hover:bg-sky-300">
        Create Page
      </button>
    </form>
  );
}

function RecentLogs({ logs }: { logs: LogRow[] }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-xl font-bold">Recent Content Agent Logs</h2>

      <div className="mt-4 space-y-3">
        {logs.length ? (
          logs.map((log) => (
            <div key={log.id} className="rounded-2xl bg-slate-950/70 p-3">
              <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                <span>{new Date(log.created_at).toLocaleString()}</span>
                <span>{log.result || "—"}</span>
              </div>
              <div className="mt-1 font-semibold text-slate-200">{log.action}</div>
              {log.details && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-400">{log.details}</p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-400">No logs yet.</p>
        )}
      </div>
    </section>
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

function CheckboxField({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl bg-slate-950/70 p-4">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-5 w-5"
      />
      <span className="font-semibold">{label}</span>
    </label>
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

function NumberField({
  name,
  label,
  defaultValue = "",
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <label className="block rounded-2xl bg-slate-950/70 p-3">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type="number"
        min="1"
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-emerald-300"
      />
    </label>
  );
}

function TextareaField({
  name,
  label,
  defaultValue = "",
  help,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  help?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={5}
        className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-emerald-300"
      />
      {help && <span className="mt-1 block text-xs text-slate-500">{help}</span>}
    </label>
  );
}

function normalizeSlots(slots: Array<{ time: string; postType: string }> | null) {
  if (!Array.isArray(slots)) return [];

  return slots
    .map((slot) => ({
      time: String(slot.time || ""),
      postType: String(slot.postType || ""),
    }))
    .filter((slot) => slot.time || slot.postType);
}
