import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function AdminIsoTrackerPage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/admin" className="text-sm font-bold text-emerald-300">
          Back to admin
        </Link>
        <header className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
            Prepared
          </p>
          <h1 className="mt-2 text-3xl font-black">IsoTracker</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Migration planning for moving the existing static IsoTracker to its
            own subdomain while preserving local-only user storage.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="https://crestedcritters.com/isotracker/"
              className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
            >
              Current IsoTracker
            </Link>
          </div>
        </header>

        <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <h2 className="text-lg font-black">Local-first requirements</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {[
              "Keep colonies, care logs, settings, and price sheets in browser storage.",
              "No server account required for the first subdomain release.",
              "Add export/import backup controls before any hosted sync feature.",
              "Design future paid backup as opt-in, never automatic migration.",
            ].map((item) => (
              <p
                key={item}
                className="rounded-md bg-black/20 px-3 py-2 text-sm leading-6 text-slate-300"
              >
                {item}
              </p>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: adminProfile } = await supabase
    .from("admin_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminProfile) redirect("/admin/login");
}
