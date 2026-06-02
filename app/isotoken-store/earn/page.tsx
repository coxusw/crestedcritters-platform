import type { Metadata } from "next";
import Link from "next/link";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import { absoluteIsopediaUrl } from "@/lib/isopedia-site";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getIsoTokenBalanceForProfile, type IsoTokenLedgerEntry } from "@/lib/isotokens";

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

const earnRules = [
  ["Submit a new species", "10 IsoTokens"],
  ["Submitted species is verified", "Additional 15 IsoTokens"],
  ["Verify a new species submission", "5 IsoTokens"],
  ["Publish a guide", "5 IsoTokens"],
  ["Your guide receives a like", "1 IsoToken per like"],
  ["Submit a species gallery photo", "2 IsoTokens"],
  ["Submitted gallery photo is verified", "Additional 3 IsoTokens"],
  ["Post in a discussion", "1 IsoToken"],
  ["Your discussion post receives a like", "1 IsoToken per like"],
];

export const metadata: Metadata = {
  title: "Earn IsoTokens | Isopedia",
  description:
    "Learn how Isopedia contributors earn IsoTokens from species submissions, guides, gallery photos, discussions, and likes.",
  alternates: {
    canonical: absoluteIsopediaUrl("/isotoken-store/earn"),
  },
};

export default async function EarnIsoTokensPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const activeTab = params.tab === "ledger" ? "ledger" : "faq";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const balance = user ? await getIsoTokenBalanceForProfile(supabase, user.id) : 0;
  const ledger = user ? await getLedger(supabase, user.id) : [];

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <IsopediaNav active="store" />

        <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#102016] p-2">
          <Link
            href="/isotoken-store"
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-black text-emerald-100 transition hover:bg-black/30"
          >
            Store
          </Link>
          <Link
            href="/isotoken-store/earn"
            className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950"
          >
            Earn IsoTokens
          </Link>
        </div>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#102016] shadow-2xl shadow-black/30">
          <div className="bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_40%),linear-gradient(135deg,rgba(6,78,59,0.55),rgba(7,19,12,0.96))] p-6 sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
              Contributor Rewards
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-6xl">
              Earn IsoTokens
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-emerald-50/75 sm:text-lg">
              IsoTokens reward helpful Isopedia contributions: species data,
              reviewed photos, guides, and useful discussion activity.
            </p>
            {user && (
              <div className="mt-5 inline-flex rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm font-black text-emerald-100">
                Current balance: {balance} IsoTokens
              </div>
            )}
          </div>
        </section>

        {user && (
          <div className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#102016] p-2">
            <Link
              href="/isotoken-store/earn"
              className={`rounded-xl px-4 py-2 text-sm font-black ${
                activeTab === "faq"
                  ? "bg-emerald-400 text-slate-950"
                  : "border border-white/10 bg-black/20 text-emerald-100 hover:bg-black/30"
              }`}
            >
              FAQ
            </Link>
            <Link
              href="/isotoken-store/earn?tab=ledger"
              className={`rounded-xl px-4 py-2 text-sm font-black ${
                activeTab === "ledger"
                  ? "bg-emerald-400 text-slate-950"
                  : "border border-white/10 bg-black/20 text-emerald-100 hover:bg-black/30"
              }`}
            >
              Ledger
            </Link>
          </div>
        )}

        {activeTab === "ledger" && user ? (
          <Ledger entries={ledger} />
        ) : (
          <FAQ isLoggedIn={Boolean(user)} />
        )}
      </div>
    </main>
  );
}

function FAQ({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
      <section className="rounded-2xl border border-white/10 bg-[#102016] p-5 shadow-xl shadow-black/20 sm:p-6">
        <h2 className="text-2xl font-black text-white">How To Earn</h2>
        <div className="mt-5 grid gap-3">
          {earnRules.map(([action, reward]) => (
            <div
              key={action}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#07130c]/70 p-4"
            >
              <span className="font-bold text-emerald-50">{action}</span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200">
                {reward}
              </span>
            </div>
          ))}
        </div>
      </section>

      <aside className="grid gap-5">
        <section className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-5 text-sm leading-6 text-amber-50 shadow-xl shadow-black/20">
          <h2 className="text-xl font-black text-amber-100">Abuse Warning</h2>
          <p className="mt-3">
            Manipulating the system to gain IsoTokens without normal community
            intent can result in removal of all IsoTokens and/or an account ban.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#102016] p-5 text-sm leading-6 text-emerald-50/65 shadow-xl shadow-black/20">
          <h2 className="text-xl font-black text-white">What Counts</h2>
          <p className="mt-3">
            IsoTokens are meant to reward useful contributions, not volume for
            volume's sake. Good species data, original photos, clear guides, and
            helpful discussion posts are the goal.
          </p>
          {!isLoggedIn && (
            <Link
              href="/login?next=/isotoken-store/earn"
              className="mt-4 inline-flex rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Sign In To Track Ledger
            </Link>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#102016] p-5 text-sm leading-6 text-emerald-50/65 shadow-xl shadow-black/20">
          <h2 className="text-xl font-black text-white">Future Ideas</h2>
          <p className="mt-3">
            Good future rewards could include approved suggested edits, expo
            submissions that get approved, and high-quality profile collection
            contributions once those workflows have stronger review controls.
          </p>
        </section>
      </aside>
    </div>
  );
}

function Ledger({ entries }: { entries: IsoTokenLedgerEntry[] }) {
  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-[#102016] p-5 shadow-xl shadow-black/20 sm:p-6">
      <h2 className="text-2xl font-black text-white">IsoToken Ledger</h2>
      <p className="mt-2 text-sm leading-6 text-emerald-50/60">
        Each row shows where IsoTokens were earned or removed.
      </p>

      <div className="mt-5 grid gap-3">
        {entries.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#07130c]/70 p-5 text-sm text-emerald-50/55">
            No IsoToken activity yet.
          </div>
        ) : (
          entries.map((entry) => (
            <article
              key={entry.id}
              className="grid gap-3 rounded-xl border border-white/10 bg-[#07130c]/70 p-4 sm:grid-cols-[90px_1fr_auto]"
            >
              <div
                className={`text-2xl font-black ${
                  entry.amount >= 0 ? "text-emerald-200" : "text-red-200"
                }`}
              >
                {entry.amount >= 0 ? "+" : ""}
                {entry.amount}
              </div>
              <div>
                <p className="font-black text-white">{entry.description}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-emerald-50/40">
                  {entry.reason.replace(/_/g, " ")}
                </p>
              </div>
              <time className="text-sm font-bold text-emerald-50/50">
                {new Date(entry.created_at).toLocaleDateString()}
              </time>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

async function getLedger(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profileId: string
) {
  const { data, error } = await supabase
    .from("isotoken_ledger")
    .select("id, profile_id, amount, reason, description, entity_type, entity_id, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<IsoTokenLedgerEntry[]>();

  if (error || !data) return [];
  return data;
}
