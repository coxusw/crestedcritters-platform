import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";

type Expo = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  venue: string | null;
  starts_at: string;
  ends_at: string | null;
  description: string | null;
  flyer_image_url: string | null;
};

type PageProps = {
  searchParams?: Promise<{
    submitted?: string;
    view?: string;
    q?: string;
    state?: string;
  }>;
};

const STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addYears(date: Date, years: number) {
  const copy = new Date(date);
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupByMonth(expos: Expo[]) {
  const groups = new Map<string, Expo[]>();

  for (const expo of expos) {
    const date = new Date(expo.starts_at);
    const key = date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
    });

    groups.set(key, [...(groups.get(key) || []), expo]);
  }

  return Array.from(groups.entries());
}

function getViewCopy(view: "upcoming" | "future" | "archive") {
  if (view === "future") {
    return {
      emptyTitle: "No future approved expos found",
      emptyText:
        "Approved expos up to 5 years out will appear here. Try clearing filters if you searched by state or keyword.",
    };
  }

  if (view === "archive") {
    return {
      emptyTitle: "No archived expos found",
      emptyText:
        "Past approved expos from the last two years will appear here. Try clearing filters if you searched by state or keyword.",
    };
  }

  return {
    emptyTitle: "No upcoming approved expos found in the next 3 weeks",
    emptyText:
      "Use All Future to see farther-out approved expos, or clear filters if you searched by state or keyword.",
  };
}

function buildViewHref(view: "upcoming" | "future" | "archive") {
  if (view === "future") return "/isopedia/expos?view=future";
  if (view === "archive") return "/isopedia/expos?view=archive";
  return "/isopedia/expos";
}

export default async function ExposPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const view =
    params?.view === "future"
      ? "future"
      : params?.view === "archive"
        ? "archive"
        : "upcoming";

  const searchQuery = String(params?.q || "").trim();
  const selectedState = String(params?.state || "").trim().toUpperCase();
  const stateFilter = STATES.includes(selectedState) ? selectedState : "";

  const copy = getViewCopy(view);

  const supabase = await createSupabaseServerClient();

  const now = new Date();
  const threeWeeksFuture = addDays(now, 21);
  const fiveYearsFuture = addYears(now, 5);
  const twoYearsPast = addYears(now, -2);

  let query = supabase
    .from("isopedia_expos")
    .select(
      `
      id,
      name,
      slug,
      city,
      state,
      venue,
      starts_at,
      ends_at,
      description,
      flyer_image_url
    `
    )
    .eq("status", "approved");

  if (view === "archive") {
    query = query
      .gte("starts_at", twoYearsPast.toISOString())
      .lt("starts_at", now.toISOString());
  } else if (view === "future") {
    query = query
      .gte("starts_at", now.toISOString())
      .lte("starts_at", fiveYearsFuture.toISOString());
  } else {
    query = query
      .gte("starts_at", now.toISOString())
      .lte("starts_at", threeWeeksFuture.toISOString());
  }

  if (stateFilter) {
    query = query.eq("state", stateFilter);
  }

  if (searchQuery) {
    query = query.or(
      `name.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%,venue.ilike.%${searchQuery}%`
    );
  }

  const { data: expos, error } = await query
    .order("starts_at", { ascending: view !== "archive" })
    .returns<Expo[]>();

  if (error) {
    throw new Error(error.message);
  }

  const allExpos = expos || [];
  const grouped = groupByMonth(allExpos);
  const hasFilters = Boolean(searchQuery || stateFilter);

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <IsopediaNav active="expos" />

        {params?.submitted === "true" && (
          <div className="mx-auto mb-5 max-w-5xl rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200 sm:mb-6">
            Expo submitted for review.
          </div>
        )}

        <section className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#102016] shadow-2xl shadow-black/30">
          <div className="bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_36%),linear-gradient(135deg,rgba(6,78,59,0.48),rgba(7,19,12,0.95))] px-4 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-300 sm:text-xs sm:tracking-[0.35em]">
                Isopedia Community
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Expo Calendar
              </h1>

              <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-emerald-50/80 sm:text-base lg:text-lg">
                Discover USA expos, see who is attending or vending, and join
                expo-specific discussions after approval.
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <ViewButton
                  href={buildViewHref("upcoming")}
                  active={view === "upcoming"}
                >
                  Upcoming
                </ViewButton>

                <ViewButton
                  href={buildViewHref("future")}
                  active={view === "future"}
                >
                  All Future
                </ViewButton>

                <ViewButton
                  href={buildViewHref("archive")}
                  active={view === "archive"}
                >
                  Archive
                </ViewButton>

                <Link
                  href="/isopedia/expos/submit"
                  className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
                >
                  Submit Expo
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-5 max-w-5xl rounded-3xl border border-white/10 bg-[#102016] p-4 shadow-xl shadow-black/20 sm:mt-6 sm:p-5">
          <form
            className="grid gap-4 lg:grid-cols-[1fr_180px_auto]"
            action="/isopedia/expos"
          >
            {view !== "upcoming" && (
              <input type="hidden" name="view" value={view} />
            )}

            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-100/45 sm:text-xs">
                Search
              </span>

              <input
                name="q"
                defaultValue={searchQuery}
                placeholder="Search expo name, city, or venue..."
                className="min-h-12 rounded-2xl border border-white/10 bg-[#07130c] px-4 py-3 text-base text-white outline-none transition placeholder:text-emerald-50/30 focus:border-emerald-400/40"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-100/45 sm:text-xs">
                State
              </span>

              <select
                name="state"
                defaultValue={stateFilter}
                className="min-h-12 rounded-2xl border border-white/10 bg-[#07130c] px-4 py-3 text-base text-white outline-none transition focus:border-emerald-400/40"
              >
                <option value="">All States</option>

                {STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-end">
              <button
                type="submit"
                className="min-h-12 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Filter
              </button>

              {hasFilters && (
                <Link
                  href={buildViewHref(view)}
                  className="flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-[#07130c] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#102016]"
                >
                  Clear
                </Link>
              )}
            </div>
          </form>

          {hasFilters && (
            <p className="mt-4 text-sm leading-6 text-emerald-50/55">
              Showing {allExpos.length} result{allExpos.length === 1 ? "" : "s"}
              {stateFilter ? ` in ${stateFilter}` : ""}
              {searchQuery ? ` matching “${searchQuery}”` : ""}.
            </p>
          )}
        </section>

        <section className="mx-auto mt-6 grid max-w-5xl gap-5 sm:mt-8 sm:gap-6">
          {grouped.length > 0 ? (
            grouped.map(([month, monthExpos]) => (
              <div
                key={month}
                className="rounded-3xl border border-white/10 bg-[#102016] p-4 shadow-xl shadow-black/20 sm:p-5"
              >
                <h2 className="text-xl font-black text-white sm:text-2xl">
                  {month}
                </h2>

                <div className="mt-4 grid gap-4 sm:mt-5">
                  {monthExpos.map((expo) => (
                    <Link
                      key={expo.id}
                      href={`/isopedia/expos/${expo.slug}`}
                      className="grid gap-4 rounded-2xl border border-white/10 bg-[#07130c]/70 p-4 transition hover:border-emerald-400/40 hover:bg-[#102016] sm:p-5 md:grid-cols-[120px_180px_1fr_auto] md:items-center"
                    >
                      <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#102016] sm:h-36 md:h-24 md:w-28">
                        {expo.flyer_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={expo.flyer_image_url}
                            alt={`${expo.name} flyer`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="px-2 text-center text-xs text-emerald-50/35">
                            No flyer
                          </span>
                        )}
                      </div>

                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-emerald-300 sm:text-sm">
                          {formatDate(expo.starts_at)}
                        </p>

                        <p className="mt-1 text-sm text-emerald-50/60">
                          {formatTime(expo.starts_at)}
                        </p>
                      </div>

                      <div>
                        <h3 className="text-xl font-black text-white sm:text-2xl">
                          {expo.name}
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-emerald-50/65">
                          {expo.city}, {expo.state}
                          {expo.venue ? ` · ${expo.venue}` : ""}
                        </p>

                        {expo.description && (
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-emerald-50/50 sm:line-clamp-2">
                            {expo.description}
                          </p>
                        )}
                      </div>

                      <span className="text-sm font-black text-emerald-300 md:text-right">
                        View →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-white/10 bg-[#102016] p-6 text-center shadow-xl shadow-black/20 sm:p-8">
              <h2 className="text-xl font-black text-white sm:text-2xl">
                {copy.emptyTitle}
              </h2>

              <p className="mt-3 text-sm leading-6 text-emerald-50/60 sm:text-base">
                {copy.emptyText}
              </p>

              <div className="mt-6 flex justify-center">
                {hasFilters ? (
                  <Link
                    href={buildViewHref(view)}
                    className="inline-flex min-h-12 items-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-6 py-3 text-sm font-black text-emerald-200 transition hover:bg-emerald-400/20"
                  >
                    Clear Filters
                  </Link>
                ) : view === "upcoming" ? (
                  <Link
                    href="/isopedia/expos?view=future"
                    className="inline-flex min-h-12 items-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-6 py-3 text-sm font-black text-emerald-200 transition hover:bg-emerald-400/20"
                  >
                    View All Future Expos
                  </Link>
                ) : (
                  <Link
                    href="/isopedia/expos/submit"
                    className="inline-flex min-h-12 items-center rounded-2xl bg-emerald-400 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
                  >
                    Submit Expo
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ViewButton({
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
      className={`rounded-xl border px-4 py-2 text-sm font-black transition ${
        active
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          : "border-white/10 bg-[#07130c] text-white hover:bg-[#102016]"
      }`}
    >
      {children}
    </Link>
  );
}