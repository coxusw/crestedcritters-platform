import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type AnalyticsEvent = {
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  path: string | null;
  referrer_domain: string | null;
  traffic_source: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const filterLabels: Record<string, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  current_month: "Current month",
  previous_month: "Previous month",
  all: "All time",
};

function getStartDate(filter: string) {
  const now = new Date();
  const start = new Date(now);

  if (filter === "today") {
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (filter === "7d") {
    start.setDate(start.getDate() - 7);
    return start;
  }

  if (filter === "30d") {
    start.setDate(start.getDate() - 30);
    return start;
  }

  if (filter === "current_month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  if (filter === "previous_month") {
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  }

  return null;
}

function getEndDate(filter: string) {
  const now = new Date();

  if (filter === "previous_month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return null;
}

function topCounts(
  events: AnalyticsEvent[],
  getKey: (event: AnalyticsEvent) => string | null
) {
  const counts = new Map<string, number>();

  for (const event of events) {
    const key = getKey(event);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const [{ data: adminProfile }, { data: roleProfile }] = await Promise.all([
    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle(),
  ]);

  if (
    !adminProfile &&
    roleProfile?.role !== "admin" &&
    roleProfile?.role !== "moderator"
  ) {
    redirect("/admin/login");
  }

  return supabase;
}

export default async function IsopediaAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = params.range && filterLabels[params.range] ? params.range : "30d";
  const supabase = await requireAdmin();
  const startDate = getStartDate(range);
  const endDate = getEndDate(range);

  let query = supabase
    .from("isopedia_analytics_events")
    .select(
      "event_type, entity_type, entity_id, path, referrer_domain, traffic_source, metadata, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (startDate) query = query.gte("created_at", startDate.toISOString());
  if (endDate) query = query.lt("created_at", endDate.toISOString());

  const { data: events, error } = await query.returns<AnalyticsEvent[]>();

  const rows = error ? [] : events || [];
  const trafficSources = topCounts(rows, (event) => event.traffic_source || "unknown");
  const topPages = topCounts(rows, (event) => event.path);
  const profileEvents = rows.filter((event) => event.entity_type === "profile");
  const searchEvents = rows.filter((event) => event.event_type.includes("search"));
  const noResultSearches = searchEvents.filter(
    (event) => event.event_type === "internal_search_no_results"
  );

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
              Isopedia Tools
            </p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">
              Analytics
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Privacy-conscious event reporting for traffic sources, top pages,
              profiles, and search/discovery.
            </p>
          </div>

          <Link
            href="/admin/isopedia"
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
          >
            Back to Isopedia
          </Link>
        </header>

        <nav className="flex gap-2 overflow-x-auto rounded-md border border-white/10 bg-white/[0.04] p-2">
          {Object.entries(filterLabels).map(([key, label]) => (
            <Link
              key={key}
              href={`/admin/isopedia/analytics?range=${key}`}
              className={`shrink-0 rounded-md px-3 py-2 text-sm font-bold ${
                key === range
                  ? "bg-emerald-400 text-slate-950"
                  : "text-slate-200 hover:bg-white/10"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <section className="grid gap-4 md:grid-cols-5">
          <Stat label="Events" value={rows.length} />
          <Stat label="Profile events" value={profileEvents.length} />
          <Stat label="Search events" value={searchEvents.length} />
          <Stat label="No-result searches" value={noResultSearches.length} />
          <Stat label="Range" value={filterLabels[range]} />
        </section>

        {error && (
          <section className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
            Analytics tables are not available yet. Run the new Supabase
            migration, then refresh this page.
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-2">
          <CountList title="Traffic Sources" rows={trafficSources} />
          <CountList title="Top Pages" rows={topPages} />
          <CountList
            title="Top Profile Actions"
            rows={topCounts(profileEvents, (event) => event.event_type)}
          />
          <CountList
            title="Search / Discovery"
            rows={topCounts(searchEvents, (event) => event.event_type)}
          />
          <CountList
            title="Top Search Terms"
            rows={topCounts(searchEvents, (event) =>
              typeof event.metadata?.query === "string"
                ? event.metadata.query
                : null
            )}
          />
          <CountList
            title="No-Result Search Terms"
            rows={topCounts(noResultSearches, (event) =>
              typeof event.metadata?.query === "string"
                ? event.metadata.query
                : null
            )}
          />
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
    </div>
  );
}

function CountList({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, number]>;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
      <h2 className="text-xl font-black text-white">{title}</h2>
      <div className="mt-4 grid gap-2">
        {rows.length > 0 ? (
          rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-black/20 px-3 py-2"
            >
              <span className="truncate text-sm text-slate-200">{label}</span>
              <span className="text-sm font-black text-emerald-200">{value}</span>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
            No analytics events have been recorded for this range yet.
          </p>
        )}
      </div>
    </div>
  );
}
