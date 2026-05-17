import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function AdminShopPage() {
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
          <h1 className="mt-2 text-3xl font-black">Shop Admin</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Future product and checkout control center for replacing one-item
            Square payment links with a real cart and smoother purchase flow.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <PlanCard
            title="Product tools"
            items={[
              "Add, remove, edit, hide, and restock products.",
              "Sync product images, prices, quantities, and categories.",
              "Support pickup or shipping options when business rules are ready.",
            ]}
          />
          <PlanCard
            title="Checkout tools"
            items={[
              "Use Square Checkout or Payments APIs for cart checkout.",
              "Store pending orders before redirecting to Square payment.",
              "Record webhook confirmations for order status and bookkeeping.",
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
