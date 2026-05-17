import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function AdminRandomizerPage() {
  await requireAdmin();

  return (
    <AdminToolPage
      title="Randomizer Admin"
      status="Prepared"
      summary="This page is ready to become the operations console for Randomizer templates, result auditing, billing checks, and cleanup controls."
      liveLinks={[
        { href: "/randomizer", label: "Open Randomizer" },
        { href: "/randomizer/billing", label: "Billing Page" },
      ]}
      sections={[
        {
          title: "Existing pieces",
          items: [
            "Public randomizer app and verification pages already live in this platform.",
            "Square webhook and checkout routes already exist for Randomizer billing.",
            "Expired result cleanup cron is already configured in Vercel.",
          ],
        },
        {
          title: "Next build steps",
          items: [
            "Add editable giveaway templates and default wheel settings.",
            "Add a saved-results table with filters for result code, user, and date.",
            "Add billing status summaries from Square checkout/webhook data.",
          ],
        },
      ]}
    />
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

function AdminToolPage({
  title,
  status,
  summary,
  liveLinks,
  sections,
}: {
  title: string;
  status: string;
  summary: string;
  liveLinks: { href: string; label: string }[];
  sections: { title: string; items: string[] }[];
}) {
  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/admin" className="text-sm font-bold text-emerald-300">
          Back to admin
        </Link>
        <header className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
            {status}
          </p>
          <h1 className="mt-2 text-3xl font-black">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            {summary}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {liveLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-lg border border-white/10 bg-white/[0.05] p-5"
            >
              <h2 className="text-lg font-black">{section.title}</h2>
              <div className="mt-4 grid gap-2">
                {section.items.map((item) => (
                  <p
                    key={item}
                    className="rounded-md bg-black/20 px-3 py-2 text-sm leading-6 text-slate-300"
                  >
                    {item}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
