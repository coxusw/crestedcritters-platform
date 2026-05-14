import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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
  }>;
};

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
      title: "All Future Expos",
      statLabel: "Future Expos",
      emptyTitle: "No future approved expos yet",
      emptyText: "Approved expos up to 5 years out will appear here.",
      helperText: "Showing all approved future expos up to 5 years out.",
    };
  }

  if (view === "archive") {
    return {
      title: "Expo Archive",
      statLabel: "Archived Expos",
      emptyTitle: "No archived expos yet",
      emptyText: "Past approved expos from the last two years will appear here.",
      helperText: "Showing approved past expos from the last 2 years.",
    };
  }

  return {
    title: "Upcoming Expos",
    statLabel: "Upcoming Expos",
    emptyTitle: "No upcoming approved expos in the next 3 weeks",
    emptyText:
      "Use All Future to see farther-out approved expos, or submit an expo to help build the calendar.",
    helperText: "Showing approved expos happening within the next 3 weeks.",
  };
}

export default async function ExposPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const view =
    params?.view === "future"
      ? "future"
      : params?.view === "archive"
        ? "archive"
        : "upcoming";

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

  const { data: expos, error } = await query
    .order("starts_at", { ascending: view !== "archive" })
    .returns<Expo[]>();

  if (error) {
    throw new Error(error.message);
  }

  const allExpos = expos || [];
  const grouped = groupByMonth(allExpos);

  return (
    <main className="min-h-screen bg-[#0c1710] px-4 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/isopedia"
            className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
          >
            ← Back to Isopedia
          </Link>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/isopedia/expos/submit"
              className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Submit Expo
            </Link>

            <ViewButton href="/isopedia/expos" active={view === "upcoming"}>
              Upcoming
            </ViewButton>

            <ViewButton
              href="/isopedia/expos?view=future"
              active={view === "future"}
            >
              All Future
            </ViewButton>

            <ViewButton
              href="/isopedia/expos?view=archive"
              active={view === "archive"}
            >
              Archive
            </ViewButton>
          </div>
        </div>

        {params?.submitted === "true" && (
          <div className="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200">
            Expo submitted for review.
          </div>
        )}

        <section className="rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-2xl shadow-black/30 sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
            Isopedia Community
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Expo Calendar
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/65">
            Discover USA expos, see who is attending or vending, and join
            expo-specific discussions after approval.
          </p>

          <div className="mt-6 max-w-sm">
            <MiniStat label={copy.statLabel} value={allExpos.length} />
          </div>

          <p className="mt-4 text-sm text-emerald-50/50">{copy.helperText}</p>
        </section>

        <section className="mt-8 grid gap-6">
          {grouped.length > 0 ? (
            grouped.map(([month, monthExpos]) => (
              <div
                key={month}
                className="rounded-3xl border border-white/10 bg-[#142318] p-5 shadow-xl shadow-black/20"
              >
                <h2 className="text-2xl font-black text-white">{month}</h2>

                <div className="mt-5 grid gap-4">
                  {monthExpos.map((expo) => (
                    <Link
                      key={expo.id}
                      href={`/isopedia/expos/${expo.slug}`}
                      className="grid gap-4 rounded-2xl border border-white/10 bg-[#0b140d] p-5 transition hover:border-emerald-400/40 hover:bg-[#102016] md:grid-cols-[120px_180px_1fr_auto] md:items-center"
                    >
                      <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#142318] md:w-28">
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
                        <p className="text-sm font-black uppercase tracking-widest text-emerald-300">
                          {formatDate(expo.starts_at)}
                        </p>

                        <p className="mt-1 text-sm text-emerald-50/60">
                          {formatTime(expo.starts_at)}
                        </p>
                      </div>

                      <div>
                        <h3 className="text-2xl font-black text-white">
                          {expo.name}
                        </h3>

                        <p className="mt-1 text-sm text-emerald-50/65">
                          {expo.city}, {expo.state}
                          {expo.venue ? ` · ${expo.venue}` : ""}
                        </p>

                        {expo.description && (
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-emerald-50/50">
                            {expo.description}
                          </p>
                        )}
                      </div>

                      <span className="text-sm font-black text-emerald-300">
                        View →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-white/10 bg-[#142318] p-8 text-center shadow-xl shadow-black/20">
              <h2 className="text-2xl font-black text-white">
                {copy.emptyTitle}
              </h2>

              <p className="mt-3 text-emerald-50/60">{copy.emptyText}</p>

              {view !== "archive" && (
                <Link
                  href="/isopedia/expos/submit"
                  className="mt-5 inline-flex rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
                >
                  Submit Expo
                </Link>
              )}

              {view === "upcoming" && (
                <Link
                  href="/isopedia/expos?view=future"
                  className="ml-0 mt-3 inline-flex rounded-2xl border border-white/10 bg-[#0b140d] px-5 py-3 text-sm font-bold text-emerald-200 transition hover:bg-[#18291d] sm:ml-3"
                >
                  View All Future Expos
                </Link>
              )}
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
      className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
        active
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          : "border-white/10 bg-[#142318] text-white hover:bg-[#18291d]"
      }`}
    >
      {children}
    </Link>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b140d] p-4">
      <p className="text-xs font-black uppercase tracking-widest text-emerald-100/40">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}