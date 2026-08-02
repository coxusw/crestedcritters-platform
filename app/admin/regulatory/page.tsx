import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type Stat = {
  label: string;
  value: number | string;
  alert?: boolean;
};

export default async function RegulatoryDashboardPage() {
  await requireAdmin();
  const stats = await getRegulatoryStats();

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="text-sm font-bold text-emerald-300">
            Back to admin
          </Link>
          <Link
            href="/admin/shop"
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
          >
            Shop admin
          </Link>
        </div>

        <header className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-5">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
            Private regulatory compliance
          </p>
          <h1 className="mt-2 text-3xl font-black">Regulatory Dashboard</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-emerald-50/80">
            Admin-only source of truth for live-shipping decisions, product taxon
            mappings, private permit documents, and live-shipment recordkeeping.
            Public shop checks fail closed unless a product has a verified taxon
            mapping and a manually verified active destination decision.
          </p>
        </header>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {stats.summary.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Panel title="Alerts">
            <AlertRow
              active={Number(stats.unmappedLiveProducts) > 0}
              text={`${stats.unmappedLiveProducts} live products are not mapped to a verified regulated taxon.`}
            />
            <AlertRow
              active={Number(stats.unresolvedApplications) > 0}
              text={`${stats.unresolvedApplications} applications have unresolved conflicts.`}
            />
            <AlertRow
              active={Number(stats.conditionalDecisions) > 0}
              text={`${stats.conditionalDecisions} conditional decisions require review or condition evidence.`}
            />
            <AlertRow
              active={Number(stats.expiringPermits) > 0}
              text={`${stats.expiringPermits} permits expire within 180 days.`}
            />
            <AlertRow
              active
              text="Florida Cubaris murina must remain unavailable until an admin records controlling written clarification or satisfied conditions."
            />
          </Panel>

          <Panel title="Next Build Steps">
            <ul className="space-y-3 text-sm leading-6 text-slate-300">
              <li>Upload permit and denial PDFs into the private regulatory document bucket.</li>
              <li>Create applications, destinations, and taxon decisions from verified documents only.</li>
              <li>Map live shop products to canonical taxa one product or morph at a time.</li>
              <li>Use the compliance checker before enabling any public live-shipping eligibility.</li>
            </ul>
          </Panel>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-xl font-black">Privacy Boundary</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">
            Permit documents, denial correspondence, internal notes, shipment
            records, audit logs, and customer records are stored for private
            admin use. Public endpoints return only product eligibility status,
            public reason codes, and customer-safe messages.
          </p>
        </section>
      </div>
    </main>
  );
}

function StatCard({ stat }: { stat: Stat }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        stat.alert
          ? "border-amber-300/30 bg-amber-300/10"
          : "border-white/10 bg-white/[0.05]"
      }`}
    >
      <div className="text-2xl font-black">{stat.value}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">
        {stat.label}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function AlertRow({ active, text }: { active: boolean; text: string }) {
  return (
    <div
      className={`mb-3 rounded-md border p-3 text-sm font-bold leading-6 ${
        active
          ? "border-amber-300/30 bg-amber-300/10 text-amber-50"
          : "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
      }`}
    >
      {text}
    </div>
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

async function getRegulatoryStats() {
  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const expiresSoon = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [
    activePermits,
    statesCovered,
    needsReview,
    conditionalDecisions,
    unmappedLiveProducts,
    liveOrdersAwaitingReview,
    expiringPermits,
    shipmentRecords,
    retentionEligible,
    unresolvedApplications,
  ] = await Promise.all([
    safeCount(supabase.from("regulatory_applications").select("id", { count: "exact", head: true }).in("overall_status", ["approved", "partial_approval"])),
    safeCount(supabase.from("regulatory_destinations").select("state_code", { count: "exact", head: true }).eq("included", true)),
    safeCount(supabase.from("regulatory_applications").select("id", { count: "exact", head: true }).in("overall_status", ["pending", "needs_review"])),
    safeCount(supabase.from("regulatory_decisions").select("id", { count: "exact", head: true }).eq("decision", "conditional").eq("condition_satisfied", false)),
    safeCount(supabase.from("shop_products").select("id", { count: "exact", head: true }).eq("is_live", true).neq("taxon_mapping_status", "verified")),
    safeCount(supabase.from("live_order_records").select("id", { count: "exact", head: true }).eq("compliance_result", "manual_review")),
    safeCount(supabase.from("regulatory_applications").select("id", { count: "exact", head: true }).in("overall_status", ["approved", "partial_approval"]).lte("expires_at", expiresSoon)),
    safeCount(supabase.from("live_order_records").select("id", { count: "exact", head: true })),
    safeCount(supabase.from("live_order_records").select("id", { count: "exact", head: true }).lte("retention_until", now.toISOString().slice(0, 10))),
    safeCount(supabase.from("regulatory_applications").select("id", { count: "exact", head: true }).eq("unresolved_conflict", true)),
  ]);

  return {
    unmappedLiveProducts,
    unresolvedApplications,
    conditionalDecisions,
    expiringPermits,
    summary: [
      { label: "Active permits", value: activePermits },
      { label: "States covered", value: statesCovered },
      { label: "Needs review", value: needsReview, alert: needsReview > 0 },
      { label: "Conditional", value: conditionalDecisions, alert: conditionalDecisions > 0 },
      { label: "Unmapped live", value: unmappedLiveProducts, alert: unmappedLiveProducts > 0 },
      { label: "Live review", value: liveOrdersAwaitingReview, alert: liveOrdersAwaitingReview > 0 },
      { label: "Expiring 180d", value: expiringPermits, alert: expiringPermits > 0 },
      { label: "Ship records", value: shipmentRecords },
      { label: "Retention eligible", value: retentionEligible },
      { label: "Conflicts", value: unresolvedApplications, alert: unresolvedApplications > 0 },
    ] satisfies Stat[],
  };
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
