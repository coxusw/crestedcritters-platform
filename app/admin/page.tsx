import Link from "next/link";
import { redirect } from "next/navigation";
import { postDueAction } from "@/app/admin/content-agent/actions";
import { effectiveMileageDeduction } from "@/lib/bookkeeping/mileage";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type SnapshotStat = {
  label: string;
  value: string | number;
  alert?: boolean;
};

type AdminTool = {
  title: string;
  href: string;
  status: string;
  stats: SnapshotStat[];
  links: Array<{ href: string; label: string }>;
  postDueButton?: boolean;
};

type BookkeepingRow = {
  type: string;
  classification: string;
  category: string | null;
  amount: number | null;
  payment_method: string | null;
  money_destination: string | null;
  mileage: number | null;
  mileage_deduction: number | null;
  source: string | null;
  imported_from: string | null;
  reviewed: boolean | null;
};

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

  const snapshots = await getAdminSnapshots();
  const tools = buildTools(snapshots);

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
              A private control center for Isopedia, Facebook content,
              Randomizer, bookkeeping, IsoTracker, and the future shop.
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
              Admin tools are running under `admin.crestedcritters.com` while
              the older Isopedia admin routes remain available during the
              migration.
            </p>
          </div>

          <div className="rounded-lg border border-sky-400/20 bg-sky-400/10 p-5">
            <h2 className="text-lg font-black text-sky-100">
              Next admin move
            </h2>
            <p className="mt-2 text-sm leading-6 text-sky-50/80">
              Pull the remaining Isopedia admin-only controls fully into this
              dashboard, verify them here, then remove the old Isopedia admin
              clutter.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function ToolCard({ tool }: { tool: AdminTool }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-black">{tool.title}</h2>
        <span className="rounded-md border border-white/10 px-2 py-1 text-xs font-black uppercase tracking-wide text-emerald-200">
          {tool.status}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {tool.stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-md border p-3 ${
              stat.alert
                ? "border-amber-400/30 bg-amber-400/10"
                : "border-white/10 bg-black/20"
            }`}
          >
            <div className="text-xl font-black">{stat.value}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={tool.href}
          className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-black text-slate-950 hover:bg-emerald-300"
        >
          Open
        </Link>
        {tool.links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
          >
            {link.label}
          </Link>
        ))}
      </div>

      {tool.postDueButton && (
        <form action={postDueAction} className="mt-3">
          <button className="w-full rounded-md bg-sky-400 px-3 py-2 text-sm font-black text-slate-950 hover:bg-sky-300">
            Post Due Content
          </button>
        </form>
      )}
    </div>
  );
}

async function getAdminSnapshots() {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const [
    species,
    pendingSpecies,
    pendingExpos,
    reports,
    contentDrafts,
    contentApproved,
    contentDue,
    contentPosted,
    contentTopics,
    randomizerActive,
    randomizerLifetime,
    randomizerAccounts,
    randomizerResults,
    shopProducts,
    shopActive,
    shopPendingOrders,
    shopPaidOrders,
    permitSpecies,
    permitSubmitted,
    permitIssued,
    permitDrafting,
    bookkeepingRows,
  ] = await Promise.all([
    safeCount(supabase.from("isopedia_species").select("id", { count: "exact", head: true })),
    safeCount(supabase.from("isopedia_submissions").select("id", { count: "exact", head: true }).eq("status", "unverified")),
    safeCount(supabase.from("isopedia_expos").select("id", { count: "exact", head: true }).eq("status", "pending")),
    safeCount(supabase.from("isopedia_discussion_reports").select("id", { count: "exact", head: true }).eq("status", "open")),
    safeCount(supabase.from("content_agent_posts").select("id", { count: "exact", head: true }).eq("status", "Draft")),
    safeCount(supabase.from("content_agent_posts").select("id", { count: "exact", head: true }).eq("status", "Approved")),
    safeCount(supabase.from("content_agent_posts").select("id", { count: "exact", head: true }).eq("status", "Approved").lte("scheduled_at", now)),
    safeCount(supabase.from("content_agent_posts").select("id", { count: "exact", head: true }).eq("status", "Posted")),
    safeCount(supabase.from("content_agent_topics").select("id", { count: "exact", head: true }).eq("active", true)),
    safeCount(supabase.from("randomizer_accounts").select("user_id", { count: "exact", head: true }).eq("lifetime_access", false).gt("access_expires_at", now)),
    safeCount(supabase.from("randomizer_accounts").select("user_id", { count: "exact", head: true }).eq("lifetime_access", true)),
    safeRows<{ credits: number | null }>(supabase.from("randomizer_accounts").select("credits").limit(5000)),
    safeCount(supabase.from("randomizer_results").select("id", { count: "exact", head: true })),
    safeCount(supabase.from("shop_products").select("id", { count: "exact", head: true })),
    safeCount(supabase.from("shop_products").select("id", { count: "exact", head: true }).eq("active", true)),
    safeCount(supabase.from("shop_orders").select("id", { count: "exact", head: true }).eq("status", "pending")),
    safeCount(supabase.from("shop_orders").select("id", { count: "exact", head: true }).eq("status", "paid")),
    safeCount(supabase.from("permit_species").select("id", { count: "exact", head: true }).eq("active", true)),
    safeCount(supabase.from("permit_state_records").select("id", { count: "exact", head: true }).eq("status", "submitted")),
    safeCount(supabase.from("permit_state_records").select("id", { count: "exact", head: true }).eq("status", "issued")),
    safeCount(supabase.from("permit_state_records").select("id", { count: "exact", head: true }).eq("status", "drafting")),
    safeRows<BookkeepingRow>(
      supabase
        .from("bookkeeping_transactions")
        .select("type, classification, category, amount, payment_method, money_destination, mileage, mileage_deduction, source, imported_from, reviewed")
        .gte("transaction_date", "2026-01-01")
        .limit(5000)
    ),
  ]);

  const bookkeeping = summarizeBookkeeping(bookkeepingRows);
  const outstandingCredits = randomizerAccounts.reduce(
    (total, account) => total + Number(account.credits || 0),
    0
  );

  return {
    isopedia: { species, pendingSpecies, pendingExpos, reports },
    content: {
      drafts: contentDrafts,
      approved: contentApproved,
      due: contentDue,
      posted: contentPosted,
      topics: contentTopics,
    },
    randomizer: {
      activeUsers: randomizerActive,
      lifetimeUsers: randomizerLifetime,
      outstandingCredits,
      results: randomizerResults,
    },
    shop: {
      products: shopProducts,
      active: shopActive,
      pendingOrders: shopPendingOrders,
      paidOrders: shopPaidOrders,
    },
    permits: {
      species: permitSpecies,
      submitted: permitSubmitted,
      issued: permitIssued,
      drafting: permitDrafting,
    },
    bookkeeping,
  };
}

function buildTools(snapshots: Awaited<ReturnType<typeof getAdminSnapshots>>): AdminTool[] {
  return [
    {
      title: "Isopedia Tools",
      href: "/admin/isopedia",
      status: "Live",
      stats: [
        { label: "Species", value: snapshots.isopedia.species },
        { label: "Species Review", value: snapshots.isopedia.pendingSpecies, alert: snapshots.isopedia.pendingSpecies > 0 },
        { label: "Expo Review", value: snapshots.isopedia.pendingExpos, alert: snapshots.isopedia.pendingExpos > 0 },
        { label: "Reports", value: snapshots.isopedia.reports, alert: snapshots.isopedia.reports > 0 },
      ],
      links: [
        { href: "/admin/isopedia/new", label: "New Species" },
        { href: "/admin/isopedia/expos", label: "Expos" },
        { href: "/admin/isopedia/discussions", label: "Reports" },
      ],
    },
    {
      title: "Facebook Content Agent",
      href: "/admin/content-agent",
      status: "Live",
      stats: [
        { label: "Due Now", value: snapshots.content.due, alert: snapshots.content.due > 0 },
        { label: "Approved", value: snapshots.content.approved },
        { label: "Drafts", value: snapshots.content.drafts },
        { label: "Topics", value: snapshots.content.topics },
      ],
      links: [
        { href: "/admin/content-agent/topics", label: "Topics" },
        { href: "/admin/content-agent/traction", label: "Traction" },
        { href: "/admin/content-agent/settings", label: "Settings" },
      ],
      postDueButton: true,
    },
    {
      title: "Randomizer",
      href: "/admin/randomizer",
      status: "Live",
      stats: [
        { label: "Active Users", value: snapshots.randomizer.activeUsers },
        { label: "Lifetime Users", value: snapshots.randomizer.lifetimeUsers },
        { label: "Credits", value: snapshots.randomizer.outstandingCredits },
        { label: "Results", value: snapshots.randomizer.results },
      ],
      links: [
        { href: "/randomizer", label: "Open App" },
        { href: "/randomizer/billing", label: "Billing" },
      ],
    },
    {
      title: "Bookkeeping",
      href: "/admin/bookkeeping",
      status: "Live",
      stats: [
        { label: "Square", value: formatMoney(snapshots.bookkeeping.squareBalance), alert: snapshots.bookkeeping.squareBalance < 0 },
        { label: "Cash", value: formatMoney(snapshots.bookkeeping.cashOnHand), alert: snapshots.bookkeeping.cashOnHand < 0 },
        { label: "YTD Income", value: formatMoney(snapshots.bookkeeping.income) },
        { label: "Needs Review", value: snapshots.bookkeeping.needsReview, alert: snapshots.bookkeeping.needsReview > 0 },
      ],
      links: [
        { href: "/admin/bookkeeping?review=needs", label: "Review Rows" },
      ],
    },
    {
      title: "Permit Tracker",
      href: "/admin/isotracker",
      status: "Live",
      stats: [
        { label: "Species", value: snapshots.permits.species },
        { label: "Drafts", value: snapshots.permits.drafting, alert: snapshots.permits.drafting > 0 },
        { label: "Submitted", value: snapshots.permits.submitted },
        { label: "Issued", value: snapshots.permits.issued },
      ],
      links: [{ href: "/admin/isotracker", label: "Open Permits" }],
    },
    {
      title: "Shop",
      href: "/admin/shop",
      status: "Live",
      stats: [
        { label: "Products", value: snapshots.shop.products },
        { label: "Active", value: snapshots.shop.active },
        { label: "Pending Orders", value: snapshots.shop.pendingOrders, alert: snapshots.shop.pendingOrders > 0 },
        { label: "Paid Orders", value: snapshots.shop.paidOrders },
      ],
      links: [{ href: "https://shop.crestedcritters.com", label: "Open Shop" }],
    },
  ];
}

async function safeCount(query: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  try {
    const result = await query;
    if (result.error) return 0;
    return result.count || 0;
  } catch {
    return 0;
  }
}

async function safeRows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  try {
    const result = await query;
    if (result.error) return [];
    return result.data || [];
  } catch {
    return [];
  }
}

function summarizeBookkeeping(rows: BookkeepingRow[]) {
  return rows.reduce(
    (totals, row) => {
      if (!row.reviewed) totals.needsReview += 1;
      const amount = Number(row.amount || 0);
      const paymentLabel = `${row.payment_method || ""} ${row.money_destination || ""}`.toLowerCase();

      if (isCashDepositRow(row)) {
        totals.squareBalance += amount;
        totals.cashOnHand -= amount;
      } else {
        if (paymentLabel.includes("square")) totals.squareBalance += balanceEffect(row, amount);
        if (paymentLabel.includes("cash")) totals.cashOnHand += balanceEffect(row, amount);
      }

      if (row.classification === "ignore" || isCashDepositRow(row)) return totals;
      const ledgerAmount = row.type === "mileage" && Number(row.mileage || 0) > 0
        ? effectiveMileageDeduction(row.mileage, row.mileage_deduction)
        : amount;
      if (row.type === "income") totals.income += ledgerAmount;
      if (row.type === "expense" || row.type === "mileage") totals.expenses += ledgerAmount;
      return totals;
    },
    { squareBalance: 0, cashOnHand: 0, income: 0, expenses: 0, needsReview: 0 }
  );
}

function balanceEffect(row: BookkeepingRow, amount: number) {
  if (row.source === "rebalance") return amount;
  if (row.classification === "ignore") return 0;
  if (isCashDepositRow(row)) return 0;
  if (row.classification === "owner_draw") return -amount;
  if (row.classification === "owner_contribution") return amount;
  if (row.type === "income") return amount;
  if (row.type === "expense" || row.type === "tax" || row.type === "transfer") return -amount;
  return 0;
}

function isCashDepositRow(row: BookkeepingRow) {
  const category = (row.category || "").toLowerCase();
  const importedFrom = (row.imported_from || "").toLowerCase();
  return (
    row.source === "cash_deposit" ||
    row.classification === "cash_deposit" ||
    category === "cash deposit" ||
    importedFrom.includes("cash deposit")
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
