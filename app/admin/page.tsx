import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type AdminTool = {
  title: string;
  href: string;
  status: string;
  description: string;
  actions: string[];
};

const tools: AdminTool[] = [
  {
    title: "Isopedia Tools",
    href: "/admin/isopedia",
    status: "Live",
    description:
      "Manage species, expos, badges, roles, discussions, submissions, and suggested edits.",
    actions: ["Species editor", "Expo manager", "Role and badge controls"],
  },
  {
    title: "Facebook Content Agent",
    href: "/admin/content-agent",
    status: "Live",
    description:
      "Review, schedule, and tune automated Facebook content tied to Crested Critters and Isopedia.",
    actions: ["Post queue", "Topic settings", "Image generation"],
  },
  {
    title: "Randomizer",
    href: "/admin/randomizer",
    status: "Prepared",
    description:
      "Future home for giveaway templates, billing oversight, saved results, and cleanup settings.",
    actions: ["Template controls", "Result audit trail", "Billing review"],
  },
  {
    title: "Bookkeeping",
    href: "/admin/bookkeeping",
    status: "Prepared",
    description:
      "Planned income and expense tracker for Square deposits, email receipts, categories, and reports.",
    actions: ["Square imports", "Email receipt review", "Category rules"],
  },
  {
    title: "IsoTracker",
    href: "/admin/isotracker",
    status: "Prepared",
    description:
      "Migration planning for the local-device colony tracker and future optional paid backup service.",
    actions: ["Static app inventory", "Backup roadmap", "Support notes"],
  },
  {
    title: "Shop",
    href: "/admin/shop",
    status: "Prepared",
    description:
      "Future product, cart, inventory, and Square checkout control center for a smoother shop flow.",
    actions: ["Product catalog", "Cart checkout plan", "Square integration"],
  },
];

export default async function AdminDashboard() {
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

  if (!adminProfile) {
    await supabase.auth.signOut();
    redirect("/admin/login");
  }

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
              admin.crestedcritters.com
            </p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">
              Crested Critters Admin
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
              A private control center for the public site, Isopedia, Randomizer,
              Facebook content, bookkeeping, IsoTracker, and the future shop.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-sm font-bold">
            <Link
              href="/admin/login"
              className="rounded-md border border-white/10 px-3 py-2 text-slate-200 hover:bg-white/10"
            >
              Switch account
            </Link>
            <Link
              href="/logout"
              className="rounded-md bg-red-500 px-3 py-2 text-white hover:bg-red-400"
            >
              Logout
            </Link>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto rounded-md border border-white/10 bg-white/[0.04] p-2">
          {tools.map((tool) => (
            <Link
              key={tool.title}
              href={tool.href}
              className="shrink-0 rounded-md px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
            >
              {tool.title}
            </Link>
          ))}
        </nav>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <ToolCard key={tool.title} tool={tool} />
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-5">
            <h2 className="text-lg font-black text-emerald-100">
              Parallel rollout status
            </h2>
            <p className="mt-2 text-sm leading-6 text-emerald-50/80">
              The existing `/admin` routes are still in place. When DNS points
              `admin.crestedcritters.com` at this app, the subdomain root will
              load this dashboard and `/login` will load the admin login.
            </p>
          </div>

          <div className="rounded-lg border border-sky-400/20 bg-sky-400/10 p-5">
            <h2 className="text-lg font-black text-sky-100">
              External access still needed
            </h2>
            <p className="mt-2 text-sm leading-6 text-sky-50/80">
              Shop, bookkeeping, and email imports are scaffolded for planning,
              but they need Square, email, and Google Sheet permissions before
              live data can be connected.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function ToolCard({ tool }: { tool: AdminTool }) {
  return (
    <Link
      href={tool.href}
      className="group rounded-lg border border-white/10 bg-white/[0.05] p-5 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-white/[0.07]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-black">{tool.title}</h2>
        <span className="rounded-md border border-white/10 px-2 py-1 text-xs font-black uppercase tracking-wide text-emerald-200">
          {tool.status}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">
        {tool.description}
      </p>
      <div className="mt-5 grid gap-2">
        {tool.actions.map((action) => (
          <div
            key={action}
            className="rounded-md bg-black/20 px-3 py-2 text-sm text-slate-200"
          >
            {action}
          </div>
        ))}
      </div>
      <p className="mt-5 text-sm font-black text-emerald-300 group-hover:text-emerald-200">
        Open {tool.title}
      </p>
    </Link>
  );
}
