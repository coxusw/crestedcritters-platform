import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#07130c] px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] max-w-4xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-3xl border border-white/10 bg-[#102016] shadow-2xl shadow-black/30">
          <div className="bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_38%),linear-gradient(135deg,rgba(6,78,59,0.55),rgba(7,19,12,0.95))] px-6 py-10 text-center sm:px-10 sm:py-14">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
              Page Not Found
            </p>

            <h1 className="mt-4 text-6xl font-black tracking-tight text-white sm:text-7xl">
              404
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-emerald-50/75 sm:text-lg">
              This page may have moved, been removed, or the link may be
              misspelled.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/"
                className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Back to Isopedia
              </Link>

              <Link
                href="/expos"
                className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm font-black text-white transition hover:bg-black/30"
              >
                Browse Expos
              </Link>

              <Link
                href="/"
                className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm font-black text-white transition hover:bg-black/30"
              >
                Home
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
