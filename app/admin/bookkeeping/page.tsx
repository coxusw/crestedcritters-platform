import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function AdminBookkeepingPage() {
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
          <h1 className="mt-2 text-3xl font-black">Bookkeeping</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Planning hub for replacing the manual spreadsheet with imported
            Square deposits, email receipts, categories, and monthly reports.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <PlanCard
            title="Imports"
            items={[
              "Square Payments API for transactions.",
              "Square Orders API for item-level sales.",
              "Email connector for receipts and vendor bills.",
            ]}
          />
          <PlanCard
            title="Tracking"
            items={[
              "Income, fees, refunds, deposits, and expenses.",
              "Manual review queue for uncertain matches.",
              "Category rules that can be reused each month.",
            ]}
          />
          <PlanCard
            title="Reports"
            items={[
              "Monthly profit and loss summaries.",
              "Tax category export.",
              "Spreadsheet import/export for continuity.",
            ]}
          />
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

function PlanCard({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
      <h2 className="text-lg font-black">{title}</h2>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <p
            key={item}
            className="rounded-md bg-black/20 px-3 py-2 text-sm leading-6 text-slate-300"
          >
            {item}
          </p>
        ))}
      </div>
    </article>
  );
}
