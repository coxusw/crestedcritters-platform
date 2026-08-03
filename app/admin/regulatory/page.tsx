import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { getCartCompliance } from "@/lib/shop-compliance";
import { US_STATES } from "@/lib/shop-shipping";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { QuickAllowedStatesForm } from "./quick-allowed-states-form";

export const dynamic = "force-dynamic";

type SearchParams = {
  notice?: string;
  error?: string;
  check_state?: string;
  check_product_id?: string;
};

type Product = {
  id: number | string;
  name: string;
  category: string;
  is_live: boolean | null;
  active: boolean | null;
};

type AllowedState = {
  product_id: number;
  state_code: string;
  allowed: boolean;
};

type ProductOption = {
  id: string;
  label: string;
  allowedStates: string[];
};

export default async function RegulatoryDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const data = await getRegulatoryData();
  const products = buildProductOptions(data.products, data.allowedStates);
  const check = await getComplianceCheck(params, data.products);

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="text-sm font-bold text-emerald-300">
            Back to admin
          </Link>
          <Link
            href="https://shop.crestedcritters.com"
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
          >
            Open shop
          </Link>
        </div>

        <header className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-5">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
            Live shipping states
          </p>
          <h1 className="mt-2 text-3xl font-black">Allowed States</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50/80">
            Select a live shop item, check the states it is allowed to ship to,
            and save. If a state is checked here, the shop treats that item as
            allowed for that state.
          </p>
        </header>

        {(params.notice || params.error) && (
          <div
            className={`rounded-lg border p-4 text-sm font-bold ${
              params.error
                ? "border-red-300/30 bg-red-500/10 text-red-100"
                : "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
            }`}
          >
            {params.error || params.notice}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Live items" value={products.length} />
          <StatCard label="Allowed rows" value={data.allowedStates.length} />
          <StatCard label="States" value={US_STATES.length} />
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-xl font-black">Set Allowed States</h2>
          <div className="mt-4">
            <QuickAllowedStatesForm
              products={products}
              states={US_STATES.map(([code, name]) => ({ code, name }))}
            />
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-black">Current Allowed States</h2>
            <AllowedSummary products={products} />
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-black">Check One Item</h2>
            <ComplianceChecker
              products={data.products}
              params={params}
              result={check}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
      <div className="text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </div>
    </div>
  );
}

function AllowedSummary({ products }: { products: ProductOption[] }) {
  const withStates = products.filter((product) => product.allowedStates.length > 0);
  if (withStates.length === 0) {
    return (
      <p className="mt-4 rounded-md border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
        No allowed states saved yet.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {withStates.map((product) => (
        <div key={product.id} className="rounded-md border border-white/10 bg-black/20 p-3">
          <p className="font-black text-white">{product.label}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {product.allowedStates.join(", ")}
          </p>
        </div>
      ))}
    </div>
  );
}

function ComplianceChecker({
  products,
  params,
  result,
}: {
  products: Product[];
  params: SearchParams;
  result: Awaited<ReturnType<typeof getComplianceCheck>>;
}) {
  return (
    <div className="mt-4 grid gap-4">
      <form className="grid gap-4" action="/admin/regulatory">
        <label className="grid gap-2 text-sm font-bold text-slate-200">
          Product
          <select
            name="check_product_id"
            defaultValue={params.check_product_id || ""}
            required
            className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white [color-scheme:dark]"
          >
            <option value="">Choose product</option>
            {products
              .filter((product) => product.is_live)
              .map((product) => (
                <option key={String(product.id)} value={String(product.id)} className="bg-[#111827] text-white">
                  {product.name}
                </option>
              ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-bold text-slate-200">
          State
          <select
            name="check_state"
            defaultValue={params.check_state || ""}
            required
            className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white [color-scheme:dark]"
          >
            <option value="">Choose state</option>
            {US_STATES.map(([code, name]) => (
              <option key={code} value={code} className="bg-[#111827] text-white">
                {name} ({code})
              </option>
            ))}
          </select>
        </label>

        <button className="rounded-md bg-emerald-300 px-4 py-3 text-sm font-black text-slate-950 hover:bg-emerald-200">
          Run Check
        </button>
      </form>

      {result && (
        <div
          className={`rounded-md border p-4 text-sm font-bold ${
            result.overall === "cleared"
              ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
              : "border-amber-300/30 bg-amber-300/10 text-amber-100"
          }`}
        >
          {result.items[0]?.publicMessage || result.publicMessage}
        </div>
      )}
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

async function getRegulatoryData() {
  const supabase = createSupabaseAdminClient();
  const [products, allowedStates] = await Promise.all([
    safeRows<Product>(
      supabase
        .from("shop_products")
        .select("id,name,category,is_live,active")
        .order("category")
        .order("name")
    ),
    safeRows<AllowedState>(
      supabase
        .from("live_product_allowed_states")
        .select("product_id,state_code,allowed")
        .eq("allowed", true)
        .order("state_code")
    ),
  ]);

  return { products, allowedStates };
}

function buildProductOptions(products: Product[], allowedStates: AllowedState[]) {
  return products
    .filter((product) => product.is_live)
    .map((product) => ({
      id: String(product.id),
      label: `${product.name} (${product.category}${product.active === false ? ", inactive" : ""})`,
      allowedStates: allowedStates
        .filter((row) => String(row.product_id) === String(product.id) && row.allowed)
        .map((row) => row.state_code)
        .sort(),
    }));
}

async function getComplianceCheck(params: SearchParams, products: Product[]) {
  if (!params.check_state || !params.check_product_id) return null;
  const product = products.find((item) => String(item.id) === String(params.check_product_id));
  if (!product) return null;
  return getCartCompliance({
    products: [product as never],
    stateCode: params.check_state,
    includeInternal: true,
  });
}

async function safeRows<T>(query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) {
  try {
    const result = await query;
    if (result.error) return [];
    return (result.data || []) as T[];
  } catch {
    return [];
  }
}
