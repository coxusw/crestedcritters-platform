import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { RandomizerSpin, RandomizerWinner } from "@/lib/randomizer";
import { absoluteRandomizerUrl } from "@/lib/randomizer-site";
import WheelReplay from "../../WheelReplay";
import CopyResultUrlButton from "./CopyResultUrlButton";

type RandomizerRow = {
  public_code: string;
  created_at: string;
  title: string;
  description: string | null;
  rules: string | null;
  mode: string;
  entries: string[];
  shuffle_history: Array<{
    step: number;
    total: number;
    entries: string[];
    numberedEntries: string[];
  }> | null;
  spin_history: RandomizerSpin[];
  winners: RandomizerWinner[];
  logo_data_url: string | null;
};

function resultRetentionCutoff() {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  return cutoff;
}

function formatCentralTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cleanCode = code.toUpperCase();
  const url = absoluteRandomizerUrl(`/results/${cleanCode}`);

  return {
    title: { absolute: `Randomizer Result ${cleanCode}` },
    description: "Official Crested Critters randomizer result verification page.",
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `Randomizer Result ${cleanCode}`,
      description: "Official Crested Critters randomizer result verification page.",
      url,
      images: [absoluteRandomizerUrl("/randomizer-preview.svg")],
      siteName: "Randomizer",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Randomizer Result ${cleanCode}`,
      description: "Official Crested Critters randomizer result verification page.",
      images: [absoluteRandomizerUrl("/randomizer-preview.svg")],
    },
  };
}

export default async function RandomizerResultPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("randomizer_results")
    .select(
      "public_code, created_at, title, description, rules, mode, entries, shuffle_history, spin_history, winners, logo_data_url"
    )
    .eq("public_code", code.toUpperCase())
    .gte("created_at", resultRetentionCutoff().toISOString())
    .maybeSingle<RandomizerRow>();

  if (!data) notFound();

  const shuffleHistory = Array.isArray(data.shuffle_history)
    ? data.shuffle_history
    : [];

  return (
    <main className="min-h-screen bg-[#07130c] px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-300">
                Official Result
              </p>
              <h1 className="mt-2 text-4xl font-black">{data.title}</h1>
              <p className="mt-3 text-emerald-50/70">
                Code <span className="font-black text-emerald-200">{data.public_code}</span> ·{" "}
                {formatCentralTime(data.created_at)}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  className="mt-4 inline-flex rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-sm font-black text-emerald-100 hover:bg-emerald-300/15"
                  href={`/verify?code=${encodeURIComponent(data.public_code)}`}
                >
                  Verify this code
                </Link>
                <CopyResultUrlButton />
              </div>
            </div>

            {data.logo_data_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.logo_data_url}
                alt=""
                className="h-24 w-24 rounded-2xl border border-white/10 bg-black/20 object-contain"
              />
            )}
          </div>

          {(data.description || data.rules) && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {data.description && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <h2 className="font-black text-emerald-100">Description</h2>
                  <p className="mt-2 whitespace-pre-wrap leading-7 text-emerald-50/70">{data.description}</p>
                </div>
              )}

              {data.rules && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <h2 className="font-black text-emerald-100">Rules</h2>
                  <p className="mt-2 whitespace-pre-wrap leading-7 text-emerald-50/70">{data.rules}</p>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="mt-5">
          <WheelReplay
            mode={data.mode}
            entries={data.entries}
            spinHistory={data.spin_history}
            winners={data.winners}
          />
        </div>

        <section className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-6">
          <h2 className="text-2xl font-black">Winner{data.winners.length === 1 ? "" : "s"}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data.winners.map((winner, index) => (
              <div key={`${winner.entryIndex}-${winner.spinNumber}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xl font-black text-emerald-100">{winner.name}</p>
                <p className="mt-1 text-sm text-emerald-50/70">
                  Spin {winner.spinNumber}
                  {winner.prize ? ` · ${winner.prize}` : ""}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
            <h2 className="text-2xl font-black">Spin History</h2>
            <div className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[#102016] text-emerald-100">
                  <tr>
                    <th className="px-3 py-2">Spin</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {data.spin_history.map((spin) => (
                    <tr key={`${spin.spinNumber}-${spin.entryIndex}`} className="border-t border-white/10">
                      <td className="px-3 py-2">{spin.spinNumber}</td>
                      <td className="px-3 py-2">{spin.name}</td>
                      <td className="px-3 py-2">{spin.isWinner ? spin.prize || "Winner" : "Removed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
            <h2 className="text-2xl font-black">Original Entry List</h2>
            <div className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-white/10 bg-black/20 p-4">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-emerald-50/80">
                {data.entries.map((entry, index) => (
                  <li key={`${entry}-${index}`}>{entry}</li>
                ))}
              </ol>
            </div>
          </section>
        </div>

        {shuffleHistory.length > 0 && (
          <section className="mt-5 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Shuffle History</h2>
                <p className="mt-1 text-xs leading-5 text-emerald-50/65">
                  Recorded name-list order after each shuffle before the official wheel result.
                </p>
              </div>
              <div className="rounded-full border border-yellow-200/30 bg-black/20 px-3 py-1 text-xs font-black text-yellow-100">
                {shuffleHistory.length} step{shuffleHistory.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shuffleHistory.map((shuffle, index) => {
                const entries = shuffle.numberedEntries?.length
                  ? shuffle.numberedEntries
                  : shuffle.entries;

                return (
                  <article
                    key={`${shuffle.step}-${index}`}
                    className="rounded-xl border border-white/10 bg-black/20 p-3"
                  >
                    <h3 className="text-xs font-black uppercase tracking-wide text-yellow-100">
                      Shuffle {shuffle.step} of {shuffle.total}
                    </h3>
                    <div className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/20 p-2 font-mono text-[11px] leading-5 text-emerald-50/80">
                      {entries.map((entry, entryIndex) => (
                        <div key={`${entry}-${entryIndex}`}>{entry}</div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-xl bg-emerald-300 px-5 py-3 font-black text-slate-950 hover:bg-emerald-200" href="/randomizer">
            Back to Randomizer
          </Link>
        </div>
      </div>
    </main>
  );
}
