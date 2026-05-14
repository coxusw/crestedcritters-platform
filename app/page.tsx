import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0c1710] px-4 py-10 text-white">
      <section className="mx-auto max-w-5xl">
        <div className="mb-10 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/crest-logo.png"
            alt="Crested Critters"
            className="h-16 w-16 rounded-full object-contain"
          />

          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
              Crested Critters
            </p>
            <p className="text-xs font-semibold text-emerald-50/60">
              Modern bioactive platform
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-900/40 bg-[#142318] p-8 shadow-xl shadow-black/20">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
            Welcome
          </p>

          <h1 className="mt-4 text-5xl font-black tracking-tight">
            Crested Critters Platform
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-emerald-50/75">
            The rebuilt Crested Critters site is being developed as a modern
            Next.js and Supabase platform.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/isopedia"
              className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Open Isopedia
            </Link>

            <Link
              href="/isopedia/submit"
              className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15"
            >
              Submit Species
            </Link>

            <Link
              href="/isopedia/review"
              className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15"
            >
              Review Queue
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}