import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import RandomizerClient from "./RandomizerClient";

export const metadata = {
  title: "Randomizer",
  description: "Generate official giveaway randomizer results with saved verification pages.",
};

export default async function RandomizerPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/randomizer");
  }

  return (
    <main className="min-h-screen bg-[#07130c] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-300">
              Crested Critters
            </p>
            <h1 className="mt-2 text-4xl font-black">Randomizer Wheel</h1>
            <p className="mt-2 max-w-2xl leading-7 text-emerald-50/70">
              Generate an official server-made result saved in Supabase with a public verification page.
            </p>
          </div>

          <nav className="flex flex-wrap gap-2 text-sm font-black">
            <Link className="rounded-full border border-white/10 px-4 py-2 text-emerald-100 hover:bg-white/10" href="/verify">
              Verify Result
            </Link>
            <Link className="rounded-full border border-white/10 px-4 py-2 text-emerald-100 hover:bg-white/10" href="/faq">
              FAQ
            </Link>
            <Link className="rounded-full border border-white/10 px-4 py-2 text-emerald-100 hover:bg-white/10" href="/billing">
              Account
            </Link>
          </nav>
        </header>

        <RandomizerClient />
      </div>
    </main>
  );
}
