import Image from "next/image";
import Link from "next/link";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import { enterRaffleWithDonation, enterRaffleWithIsoTokens } from "@/app/raffles/actions";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { entryCount, isRaffleOpen, type Raffle, type RaffleEntry } from "@/lib/isopedia-raffles";

type SearchParams = {
  tab?: string;
  entered?: string;
  checkout?: string;
  error?: string;
};

export const metadata = {
  title: "Isopedia Raffles",
  description: "Community prize drawings entered with IsoTokens or thank-you entries for Isopedia donations.",
};

export default async function RafflesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const activeTab = ["faq", "past"].includes(params.tab || "") ? params.tab || "current" : "current";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [activeRaffle, completedRaffles] = await Promise.all([
    getActiveRaffle(supabase),
    getCompletedRaffles(supabase),
  ]);
  const activeEntries = activeRaffle ? await getRaffleEntries(supabase, activeRaffle.id) : [];
  const userEntries =
    user && activeEntries.length
      ? activeEntries
          .filter((entry) => entry.profile_id === user.id)
          .reduce((total, entry) => total + Number(entry.quantity || 0), 0)
      : 0;

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <IsopediaNav active="raffles" />

        <section className="rounded-3xl border border-white/10 bg-[#102016] p-5 shadow-2xl shadow-black/25 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">Community prize drawings</p>
          <h1 className="mt-2 text-4xl font-black text-white">Isopedia Raffles</h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-emerald-50/75 sm:text-base">
            All raffles are conducted by users spending their IsoTokens or making a donation to
            Isopedia. Donation entries are awarded as a thank-you for supporting site operation
            costs; every entry has the same odds as every other entry.
          </p>
        </section>

        {(params.entered || params.checkout || params.error) && (
          <div className={`mt-4 rounded-2xl border p-4 text-sm font-bold ${params.error ? "border-red-300/30 bg-red-500/10 text-red-100" : "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"}`}>
            {params.error
              ? decodeURIComponent(params.error)
              : params.checkout === "success"
                ? "Donation checkout complete. Your entry will appear after Square confirms payment."
                : "Your raffle entry was added."}
          </div>
        )}

        <nav className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#102016] p-2">
          <RaffleTab href="/raffles" active={activeTab === "current"} label="Current Raffle" />
          <RaffleTab href="/raffles?tab=faq" active={activeTab === "faq"} label="Raffle FAQ" />
          <RaffleTab href="/raffles?tab=past" active={activeTab === "past"} label="Past Raffles" />
        </nav>

        <div className="mt-5">
          {activeTab === "faq" ? (
            <RaffleFaq />
          ) : activeTab === "past" ? (
            <PastRaffles raffles={completedRaffles} />
          ) : activeRaffle ? (
            <CurrentRaffle
              raffle={activeRaffle}
              entries={activeEntries}
              signedIn={Boolean(user)}
              userEntries={userEntries}
            />
          ) : (
            <div className="rounded-3xl border border-white/10 bg-[#102016] p-8 text-center shadow-xl shadow-black/20">
              <h2 className="text-2xl font-black text-white">No Active Raffle</h2>
              <p className="mt-2 text-emerald-50/60">Check back soon.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

async function getActiveRaffle(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data } = await supabase
    .from("isopedia_raffles")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<Raffle[]>();
  return (data || []).find((raffle) => isRaffleOpen(raffle)) || null;
}

async function getCompletedRaffles(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data } = await supabase
    .from("isopedia_raffles")
    .select("*")
    .eq("status", "completed")
    .order("updated_at", { ascending: false })
    .limit(20)
    .returns<Raffle[]>();
  return data || [];
}

async function getRaffleEntries(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  raffleId: string
) {
  const { data } = await supabase
    .from("isopedia_raffle_entries")
    .select("id, raffle_id, profile_id, entry_source, quantity, isotokens_spent, donation_cents, status, created_at, profiles:profile_id(username, display_name)")
    .eq("raffle_id", raffleId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .returns<RaffleEntry[]>();
  return data || [];
}

function CurrentRaffle({
  raffle,
  entries,
  signedIn,
  userEntries,
}: {
  raffle: Raffle;
  entries: RaffleEntry[];
  signedIn: boolean;
  userEntries: number;
}) {
  const totalEntries = entryCount(entries);

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <article className="overflow-hidden rounded-3xl border border-white/10 bg-[#102016] shadow-xl shadow-black/20">
        {raffle.image_url && (
          <div className="relative aspect-[16/9] bg-black/20">
            <Image src={raffle.image_url} alt={raffle.title} fill sizes="(min-width: 1024px) 720px, 100vw" className="object-cover" />
          </div>
        )}
        <div className="p-5 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Current raffle</p>
          <h2 className="mt-2 text-3xl font-black text-white">{raffle.title}</h2>
          {raffle.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-emerald-50/75">{raffle.description}</p>}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Mini label="Opens" value={displayDate(raffle.starts_at)} />
            <Mini label="Closes / Winner Decided" value={displayDate(raffle.ends_at)} />
          </div>
          {raffle.rules && (
            <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
              <h3 className="font-black text-emerald-100">Specific rules for this raffle</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-50/80">{raffle.rules}</p>
            </div>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Mini label="Entries" value={totalEntries} />
            <Mini label="Your Entries" value={userEntries} />
            <Mini label="Max Entries" value={raffle.max_entries || "No cap"} />
          </div>
        </div>
      </article>

      <aside className="space-y-5">
        <div className="rounded-3xl border border-white/10 bg-[#102016] p-5 shadow-xl shadow-black/20">
          <h3 className="text-xl font-black text-white">Enter</h3>
          {!signedIn ? (
            <Link href="/login?next=/raffles" className="mt-4 block rounded-xl bg-emerald-400 px-4 py-3 text-center font-black text-slate-950">Sign in to participate</Link>
          ) : (
            <div className="mt-4 grid gap-3">
              {raffle.allow_isotoken_entries && (
                <form action={enterRaffleWithIsoTokens} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <input type="hidden" name="raffle_id" value={raffle.id} />
                  <EntryQuantity disabled={!raffle.allow_multiple_entries} />
                  <p className="mt-2 text-xs leading-5 text-emerald-50/55">{raffle.entry_cost_isotokens} IsoTokens per entry.</p>
                  <button className="mt-3 w-full rounded-xl bg-emerald-400 px-4 py-3 font-black text-slate-950">Use IsoTokens</button>
                </form>
              )}
              {raffle.allow_donation_entries && (
                <form action={enterRaffleWithDonation} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <input type="hidden" name="raffle_id" value={raffle.id} />
                  <EntryQuantity disabled={!raffle.allow_multiple_entries} />
                  <p className="mt-2 text-xs leading-5 text-emerald-50/55">$1 donation per thank-you entry. This does not increase the odds of each entry over IsoToken entries.</p>
                  <button className="mt-3 w-full rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 font-black text-emerald-100">Donate via Square</button>
                </form>
              )}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#102016] p-5 shadow-xl shadow-black/20">
          <h3 className="text-xl font-black text-white">Entrants</h3>
          <p className="mt-1 text-sm text-emerald-50/50">Public list for transparency.</p>
          <div className="mt-4 grid max-h-96 gap-2 overflow-auto pr-1">
            {entries.length ? entries.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                <div className="font-black text-white">@{entry.profiles?.username || entry.profiles?.display_name || "user"}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-emerald-100/50">{entry.quantity} entry{entry.quantity === 1 ? "" : "ies"} via {entry.entry_source}</div>
              </div>
            )) : <p className="text-sm text-emerald-50/50">No entries yet.</p>}
          </div>
        </div>
      </aside>
    </section>
  );
}

function EntryQuantity({ disabled }: { disabled: boolean }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-emerald-50/80">
      Entries
      <input name="quantity" type="number" min="1" max="100" defaultValue="1" disabled={disabled} className="rounded-xl border border-white/10 bg-[#07130c] px-3 py-2 text-white disabled:opacity-70" />
    </label>
  );
}

function RaffleFaq() {
  const rows = [
    ["How are raffles conducted?", "Raffles are run using Crested Critters' own Randomizer Wheel. Results are shared in the Past Raffles tab and on the Isopedia Facebook page."],
    ["Who can enter?", "Users must be logged in to participate. Make sure your account email address is active because winners are notified by email."],
    ["Physical prizes", "For physical product raffles, only USA users are eligible. If a non-USA user joins a physical product raffle, they will not receive the prize. Isopedia covers shipping for physical prizes at no cost to the winner."],
    ["Donation entries", "Donation entries support Isopedia operation costs and are awarded as a thank-you. Donation entries do not receive better odds than IsoToken entries. Every entry has the same odds."],
    ["Different raffle rules", "Each raffle can have different rules, entry limits, multiple-entry settings, prize details, and maximum entries."],
  ];

  return (
    <section className="rounded-3xl border border-white/10 bg-[#102016] p-5 shadow-xl shadow-black/20 sm:p-7">
      <h2 className="text-2xl font-black">Raffle FAQ</h2>
      <div className="mt-5 grid gap-3">
        {rows.map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <h3 className="font-black text-emerald-100">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-emerald-50/70">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PastRaffles({ raffles }: { raffles: Raffle[] }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#102016] p-5 shadow-xl shadow-black/20 sm:p-7">
      <h2 className="text-2xl font-black">Past Raffles</h2>
      <div className="mt-5 grid gap-3">
        {raffles.length ? raffles.map((raffle) => (
          <article key={raffle.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <h3 className="font-black text-white">{raffle.title}</h3>
            {raffle.result_notes && <p className="mt-2 text-sm leading-6 text-emerald-50/70">{raffle.result_notes}</p>}
            {raffle.results_url && <a href={raffle.results_url} className="mt-3 inline-flex text-sm font-black text-emerald-300 underline">View shared result</a>}
          </article>
        )) : <p className="text-emerald-50/55">No past raffle results yet.</p>}
      </div>
    </section>
  );
}

function RaffleTab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link href={href} className={`rounded-xl px-4 py-2 text-sm font-black ${active ? "bg-emerald-400 text-slate-950" : "border border-white/10 bg-[#07130c] text-white"}`}>{label}</Link>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs font-black uppercase tracking-wide text-emerald-100/45">{label}</div>
      <div className="mt-2 break-words text-lg font-black text-white sm:text-xl">{value}</div>
    </div>
  );
}

function displayDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
