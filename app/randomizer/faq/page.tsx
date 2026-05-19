import Link from "next/link";

export const metadata = {
  title: "Randomizer FAQ",
  description: "How the official Crested Critters Randomizer works and how to verify results.",
};

const sections = [
  {
    title: "How the Randomizer works",
    body: "The person running a giveaway enters the title, rules, entry list, and wheel mode. When they make an official spin, the result is created on the secure-server, saved to a secure database, and assigned a public verification code. The browser animation is a replay of that saved database result. This happens without the randomizer user's input.",
  },
  {
    title: "How winners are determined",
    body: "The Randomizer uses server-side cryptographic randomness. Each entry line is treated as one entry, so duplicate names count as extra chances when the rules allow multiple entries. For Spin Count mode, the final spin is the official winner. For Last Name Spun mode, names are removed until one remains. The selected names, spin order, winner, and original entry list are saved together.",
  },
  {
    title: "How fair is the random pick?",
    body: "To sanity-check fairness, we ran a 1,000,000,000-pick simulation with 10 entries. Each entry should average 100,000,000 picks. The results were: Entry 1: 100,008,521; Entry 2: 100,001,369; Entry 3: 99,994,904; Entry 4: 99,998,675; Entry 5: 100,010,173; Entry 6: 100,013,366; Entry 7: 99,983,584; Entry 8: 99,993,868; Entry 9: 100,001,706; Entry 10: 99,993,834. Every entry landed between 9.9983584% and 10.0013366%, which is the tiny natural variance expected from real randomness.",
  },
  {
    title: "Why the result is harder to fake",
    body: "The official result page is created from the saved database record, not from a screenshot or manually typed winner. The public page shows the verification code, original entries, spin history, winners, and a wheel replay generated from the saved spin history.",
  },
  {
    title: "How to verify a result",
    body: "Ask the Randomizer user for the result link or verification code. Open the result link directly, or go to the Verify Result page and enter the code. If the code exists and is still within the one-year storage period, you will see the official saved result page. If the code does not exist, it is not a saved official result.",
  },
  {
    title: "What the wheel replay means",
    body: "The wheel replay is visual proof of the saved spin history. It does not choose a new winner when replayed. It simply replays the official server-generated spin sequence so viewers can watch how the result happened.",
  },
  {
    title: "Can entries be changed after the result?",
    body: "No. The result page stores the original entry list used for that result. If the runner made a mistake in the entry list, they should create a new official result and share the new verification code.",
  },
  {
    title: "Credits and access",
    body: "Users can buy time-based access for unlimited results during the active period, or buy credits for occasional use. Credits do not expire. If a user has no active access plan, one official result costs one credit.",
  },
  {
    title: "How long results are stored",
    body: "Official results are stored for one year. After one year, result records are deleted to keep the Randomizer database clean and limit long-term storage of old entry lists, logos, and spin history.",
  },
  {
    title: "Template limits",
    body: "Each user can save up to 5 templates. Users with lifetime access can save up to 10 templates. These limits help keep uploaded template logos from using excessive storage.",
  },
  {
    title: "What players should check",
    body: "Players should check that the official result page is on randomizer.crestedcritters.com, confirm the verification code, review the original entry list, and replay the wheel from the result page.",
  },
];

export default function RandomizerFaqPage() {
  return (
    <main className="min-h-screen bg-[#07130c] px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-300">
            Randomizer
          </p>
          <h1 className="mt-2 text-4xl font-black">FAQ</h1>
          <p className="mt-3 max-w-3xl leading-7 text-emerald-50/70">
            How official results are generated, saved, replayed, and verified.
          </p>

          <nav className="mt-5 flex flex-wrap gap-3 text-sm font-black">
            <Link className="rounded-full border border-white/10 px-4 py-2 text-emerald-100 hover:bg-white/10" href="/randomizer">
              Randomizer
            </Link>
            <Link className="rounded-full border border-white/10 px-4 py-2 text-emerald-100 hover:bg-white/10" href="/verify">
              Verify Result
            </Link>
            <Link className="rounded-full border border-white/10 px-4 py-2 text-emerald-100 hover:bg-white/10" href="/billing">
              Account
            </Link>
          </nav>
        </header>

        <section className="grid gap-4">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20"
            >
              <h2 className="text-2xl font-black text-emerald-100">{section.title}</h2>
              <p className="mt-3 leading-7 text-emerald-50/75">{section.body}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
