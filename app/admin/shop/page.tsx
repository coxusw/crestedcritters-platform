import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  formatOrderItemName,
  formatProductPrice,
  formatShopMoney,
  normalizeProductOptions,
  type ShopOrderItem,
  type ShopShippingAddress,
  type ShopProduct,
} from "@/lib/shop";
import { getShippingOptions } from "@/lib/shop-shipping";
import { getShopShippingSettings, type ShopShippingSettings } from "@/lib/shop-shipping-settings";
import {
  archiveShopProductAction,
  createShopProductAction,
  deletePendingShopOrderAction,
  sendShopMarketingEmailAction,
  sendPendingShopOrderReminderAction,
  updateShippingSettingsAction,
  updateShopProductAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminShopPage({
  searchParams,
}: {
  searchParams: Promise<{
    state?: string;
    zip?: string;
    live?: string;
    category?: string;
    catalog?: string;
    tab?: string;
    notice?: string;
    error?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const products = await getProducts();
  const shippingSettings = await getShopShippingSettings();
  const { orders, pendingOrders, subscribers, marketingSubscribers, unsubscribedSubscribers } = await getShopAdminData();
  const categories = Array.from(new Set(products.map((product) => product.category))).sort();
  const activeTab = params.tab === "marketing" ? "marketing" : "manage";
  const soldOutProducts = products.filter((product) => product.sold_out || product.inventory <= 0);
  const showingSoldOut = params.catalog === "sold-out";
  const selectedCategory = categories.includes(params.category || "") ? params.category || "" : "";
  const catalogProducts = showingSoldOut
    ? soldOutProducts
    : selectedCategory
    ? products.filter((product) => product.category === selectedCategory)
    : products;
  const activeCount = products.filter((product) => product.active).length;
  const soldOutCount = soldOutProducts.length;
  const categoryHref = (category?: string, catalog?: string) => {
    const nextParams = new URLSearchParams();
    if (params.state) nextParams.set("state", params.state);
    if (params.zip) nextParams.set("zip", params.zip);
    if (params.live) nextParams.set("live", params.live);
    if (category) nextParams.set("category", category);
    if (catalog) nextParams.set("catalog", catalog);
    const query = nextParams.toString();
    return query ? `/admin/shop?${query}` : "/admin/shop";
  };

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
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

        <header className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
            shop.crestedcritters.com
          </p>
          <h1 className="mt-2 text-3xl font-black">Shop Admin</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Manage the new Supabase-backed catalog. The storefront uses these saved prices and quantities when it creates a multi-item Square checkout.
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

        <nav className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-2">
          <ShopAdminTab href="/admin/shop" active={activeTab === "manage"}>
            Manage Shop
          </ShopAdminTab>
          <ShopAdminTab href="/admin/shop?tab=marketing" active={activeTab === "marketing"}>
            Marketing
          </ShopAdminTab>
        </nav>

        {activeTab === "marketing" ? (
          <MarketingPanel
            subscribers={subscribers}
            marketingSubscriberCount={marketingSubscribers.length}
            unsubscribedSubscribers={unsubscribedSubscribers}
          />
        ) : (
          <>
        <section className="grid gap-3 md:grid-cols-4">
          <Stat label="Products" value={products.length} />
          <Stat label="Active" value={activeCount} />
          <Stat label="Sold out" value={soldOutCount} alert={soldOutCount > 0} />
          <Stat label="Categories" value={categories.length} />
        </section>

        <details className="group rounded-lg border border-emerald-300/20 bg-emerald-300/10">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 marker:hidden">
            <div>
              <h2 className="text-xl font-black text-emerald-50">Add Product</h2>
              <p className="mt-1 text-sm text-emerald-100/75">
                Open this when you are adding a new shop item.
              </p>
            </div>
            <span className="rounded-md border border-emerald-100/20 px-3 py-2 text-sm font-black text-emerald-50 group-open:hidden">
              Open
            </span>
            <span className="hidden rounded-md border border-emerald-100/20 px-3 py-2 text-sm font-black text-emerald-50 group-open:inline">
              Close
            </span>
          </summary>
          <div className="border-t border-emerald-100/10 px-5 pb-5">
            <ProductForm action={createShopProductAction} categories={categories} submitLabel="Add Product" />
          </div>
        </details>

        <section className="grid items-start gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <ShippingSettingsPanel settings={shippingSettings} />
          <ShippingTester searchParams={params} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <PendingOrdersPanel orders={pendingOrders} />
          <SubscribersPanel subscribers={subscribers} />
        </section>

        <section>
          <OrdersPanel orders={orders} />
        </section>

        <section className="space-y-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Catalog</h2>
              <p className="mt-1 text-sm text-slate-400">
                Filter by category, then click a product name to open its editor.
              </p>
            </div>
            <span className="rounded-md border border-white/10 px-3 py-2 text-sm font-black text-slate-300">
              {catalogProducts.length} shown
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={categoryHref()}
              className={`rounded-md border px-3 py-2 text-sm font-black ${
                !selectedCategory && !showingSoldOut
                  ? "border-emerald-300/40 bg-emerald-300 text-slate-950"
                  : "border-white/10 text-slate-200 hover:bg-white/10"
              }`}
            >
              All
            </Link>
            {categories.map((category) => (
              <Link
                key={category}
                href={categoryHref(category)}
                className={`rounded-md border px-3 py-2 text-sm font-black ${
                  selectedCategory === category && !showingSoldOut
                    ? "border-emerald-300/40 bg-emerald-300 text-slate-950"
                    : "border-white/10 text-slate-200 hover:bg-white/10"
                }`}
              >
                {category}
              </Link>
            ))}
            <Link
              href={categoryHref(undefined, "sold-out")}
              className={`rounded-md border px-3 py-2 text-sm font-black ${
                showingSoldOut
                  ? "border-amber-300/40 bg-amber-300 text-slate-950"
                  : "border-white/10 text-slate-200 hover:bg-white/10"
              }`}
            >
              Sold Out
            </Link>
          </div>

          <div className="grid gap-2">
            {catalogProducts.map((product) => (
              <details key={product.id} className="group rounded-lg border border-white/10 bg-black/20">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 marker:hidden">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-white">{product.name}</h3>
                      <span className="rounded-md border border-white/10 px-2 py-1 text-xs font-bold text-slate-300">
                        {product.category}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                      {formatProductPrice(product)} - {product.inventory} in stock
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill product={product} />
                    <span className="rounded-md border border-white/10 px-2 py-1 text-xs font-black text-emerald-200 group-open:hidden">
                      Open
                    </span>
                    <span className="hidden rounded-md border border-white/10 px-2 py-1 text-xs font-black text-slate-300 group-open:inline">
                      Close
                    </span>
                  </div>
                </summary>

                <div className="border-t border-white/10 p-4">
                  <p className="mb-4 text-sm text-slate-400">
                    Edit a product and save. Archive hides it from the shop without deleting order history.
                  </p>

                  <ProductForm
                    action={updateShopProductAction}
                    categories={categories}
                    product={product}
                    submitLabel="Save Changes"
                  />

                  <form action={archiveShopProductAction} className="mt-3">
                    <input type="hidden" name="id" value={product.id} />
                    <button className="rounded-md border border-red-300/30 px-3 py-2 text-sm font-bold text-red-100 hover:bg-red-400/10">
                      Archive Product
                    </button>
                  </form>
                </div>
              </details>
            ))}
          </div>
        </section>
          </>
        )}
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

async function getProducts() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_products")
    .select("*")
    .order("active", { ascending: false })
    .order("category")
    .order("name");

  if (error) return [];
  return (data || []) as ShopProduct[];
}

async function getShopAdminData() {
  const supabase = createSupabaseAdminClient();
  const [
    ordersResult,
    pendingOrdersResult,
    subscribersResult,
    marketingSubscribersResult,
    unsubscribedSubscribersResult,
  ] = await Promise.all([
    supabase
      .from("shop_orders")
      .select("id,customer_email,status,subtotal_cents,shipping_cents,total_cents,created_at,items,shipping_address,square_checkout_url")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("shop_orders")
      .select("id,customer_email,status,subtotal_cents,shipping_cents,total_cents,created_at,items,shipping_address,square_checkout_url")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("shop_email_subscribers")
      .select("email,name,phone,marketing_opt_in,source,last_order_at,updated_at,shipping_address")
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("shop_email_subscribers")
      .select("email,name")
      .eq("marketing_opt_in", true)
      .order("updated_at", { ascending: false })
      .limit(1000),
    supabase
      .from("shop_email_subscribers")
      .select("email,name,unsubscribe_reason,unsubscribed_at,updated_at")
      .eq("marketing_opt_in", false)
      .not("unsubscribed_at", "is", null)
      .order("unsubscribed_at", { ascending: false })
      .limit(200),
  ]);

  return {
    orders: ordersResult.data || [],
    pendingOrders: pendingOrdersResult.data || [],
    subscribers: subscribersResult.data || [],
    marketingSubscribers: marketingSubscribersResult.data || [],
    unsubscribedSubscribers: unsubscribedSubscribersResult.data || [],
  };
}

function Stat({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        alert ? "border-amber-300/30 bg-amber-300/10" : "border-white/10 bg-white/[0.05]"
      }`}
    >
      <div className="text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </div>
    </div>
  );
}

function ShopAdminTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md px-4 py-2 text-sm font-black ${
        active
          ? "bg-emerald-300 text-slate-950"
          : "border border-white/10 text-slate-200 hover:bg-white/10"
      }`}
    >
      {children}
    </Link>
  );
}

function MarketingPanel({
  subscribers,
  marketingSubscriberCount,
  unsubscribedSubscribers,
}: {
  subscribers: ShopSubscriberAdminRow[];
  marketingSubscriberCount: number;
  unsubscribedSubscribers: ShopUnsubscribedAdminRow[];
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Marketing Email</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Draft a shop update, send yourself a test, then send it to customers who opted into shop updates.
            </p>
          </div>
          <span className="rounded-md border border-emerald-300/30 px-3 py-2 text-sm font-black text-emerald-100">
            {marketingSubscriberCount} opt-in
          </span>
        </div>

        <form action={sendShopMarketingEmailAction} className="mt-5 grid gap-3">
          <Field label="Subject">
            <input
              name="subject"
              required
              placeholder="Example: New isopods and shop updates"
              className={inputClass}
            />
          </Field>
          <Field label="Email body">
            <textarea
              name="body"
              required
              rows={10}
              placeholder={"Write the email here. Keep it simple, friendly, and clear.\n\nExample:\nWe added new botanicals and 3D prints to the shop today..."}
              className={`${inputClass} min-h-64`}
            />
          </Field>
          <Field label="Test email">
            <input
              name="test_email"
              type="email"
              placeholder="sales@crestedcritters.com"
              className={inputClass}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button
              name="send_mode"
              value="test"
              className="rounded-md border border-white/10 px-4 py-3 text-sm font-black text-slate-100 hover:bg-white/10"
            >
              Send Test
            </button>
            <button
              name="send_mode"
              value="all"
              className="rounded-md bg-emerald-300 px-4 py-3 text-sm font-black text-slate-950 hover:bg-emerald-200"
            >
              Send To Opt-In List
            </button>
          </div>
        </form>
      </div>

      <div className="grid gap-4">
        <SubscribersPanel subscribers={subscribers} />
        <UnsubscribedPanel subscribers={unsubscribedSubscribers} />
      </div>
    </section>
  );
}

function ShippingSettingsPanel({ settings }: { settings: ShopShippingSettings }) {
  return (
    <details className="group rounded-lg border border-white/10 bg-white/[0.05]">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 marker:hidden">
        <div>
          <h2 className="text-xl font-black">Shipping Settings</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Edit Shippo/RevAddress setup, blocked live states, packaging costs, and fallback rates.
          </p>
        </div>
        <span className="rounded-md border border-white/10 px-3 py-2 text-sm font-black text-slate-200 group-open:hidden">
          Open
        </span>
        <span className="hidden rounded-md border border-white/10 px-3 py-2 text-sm font-black text-slate-200 group-open:inline">
          Close
        </span>
      </summary>
      <form action={updateShippingSettingsAction} className="grid gap-3 border-t border-white/10 px-5 pb-5 pt-4">
        <div className="grid gap-3 md:grid-cols-5">
          <Field label="Ship ZIP">
            <input name="originZip" defaultValue={settings.originZip} className={inputClass} />
          </Field>
          <Field label="Length">
            <input name="packageLengthIn" type="number" step="0.1" defaultValue={settings.packageLengthIn} className={inputClass} />
          </Field>
          <Field label="Width">
            <input name="packageWidthIn" type="number" step="0.1" defaultValue={settings.packageWidthIn} className={inputClass} />
          </Field>
          <Field label="Height">
            <input name="packageHeightIn" type="number" step="0.1" defaultValue={settings.packageHeightIn} className={inputClass} />
          </Field>
          <Field label="Weight lb">
            <input name="packageWeightLb" type="number" step="0.1" defaultValue={settings.packageWeightLb} className={inputClass} />
          </Field>
        </div>

        <Field label="Blocked live states">
          <input name="blockedLiveStates" defaultValue={settings.blockedLiveStates.join(",")} className={inputClass} />
        </Field>

        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Spring $">
            <input name="springSurcharge" type="number" step="0.01" defaultValue={settings.seasonalSurchargesCents.spring / 100} className={inputClass} />
          </Field>
          <Field label="Summer $">
            <input name="summerSurcharge" type="number" step="0.01" defaultValue={settings.seasonalSurchargesCents.summer / 100} className={inputClass} />
          </Field>
          <Field label="October $">
            <input name="octoberSurcharge" type="number" step="0.01" defaultValue={settings.seasonalSurchargesCents.october / 100} className={inputClass} />
          </Field>
          <Field label="November $">
            <input name="novemberSurcharge" type="number" step="0.01" defaultValue={settings.seasonalSurchargesCents.november / 100} className={inputClass} />
          </Field>
        </div>

        <Field label="Fallback 1 Day by zone 0-8">
          <input name="oneDayRates" defaultValue={formatZoneRates(settings.fallbackRatesCents.usps_1_day)} className={inputClass} />
        </Field>
        <Field label="Fallback 2 Day by zone 0-8">
          <input name="twoDayRates" defaultValue={formatZoneRates(settings.fallbackRatesCents.usps_2_day)} className={inputClass} />
        </Field>
        <Field label="Fallback Ground by zone 0-8">
          <input name="groundRates" defaultValue={formatZoneRates(settings.fallbackRatesCents.usps_ground)} className={inputClass} />
        </Field>

        <div className="flex flex-wrap gap-3">
          <Check name="useShippo" label="Use Shippo first" defaultChecked={settings.useShippo} />
          <Check name="useRevAddress" label="Use RevAddress fallback" defaultChecked={settings.useRevAddress} />
        </div>

        <button className="w-fit rounded-md bg-emerald-300 px-5 py-3 font-black text-slate-950 hover:bg-emerald-200">
          Save Shipping Settings
        </button>
      </form>
    </details>
  );
}

async function ShippingTester({
  searchParams,
}: {
  searchParams?: { state?: string; zip?: string; live?: string };
}) {
  const state = searchParams?.state || "";
  const zip = searchParams?.zip || "";
  const live = searchParams?.live === "on";
  const options = zip.length === 5 ? await getShippingOptions({ destinationZip: zip, destinationState: state, hasLiveItems: live }) : [];

  return (
    <details className="group rounded-lg border border-white/10 bg-white/[0.05]">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 marker:hidden">
        <div>
          <h2 className="text-xl font-black">Shipping Tester</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Preview shop shipping rates by destination.
          </p>
        </div>
        <span className="rounded-md border border-white/10 px-3 py-2 text-sm font-black text-slate-200 group-open:hidden">
          Open
        </span>
        <span className="hidden rounded-md border border-white/10 px-3 py-2 text-sm font-black text-slate-200 group-open:inline">
          Close
        </span>
      </summary>
      <form className="grid gap-3 border-t border-white/10 px-5 pb-5 pt-4">
        <Field label="State">
          <input name="state" defaultValue={state} className={inputClass} />
        </Field>
        <Field label="ZIP code">
          <input name="zip" defaultValue={zip} className={inputClass} />
        </Field>
        <Check name="live" label="Live cart" defaultChecked={live} />
        <button className="w-fit rounded-md border border-white/10 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10">
          Test Rates
        </button>
      </form>
      <div className="grid gap-2 px-5 pb-5">
        {options.length === 0 ? (
          <p className="text-sm text-slate-400">Enter a ZIP to preview rates.</p>
        ) : (
          options.map((option) => (
            <div key={option.serviceKey} className="rounded-md bg-black/20 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-black">{option.serviceName}</span>
                <span className="font-black text-emerald-200">{formatShopMoney(option.totalCents)}</span>
              </div>
              <p className="mt-1 text-slate-400">
                {option.carrier}
                {option.surchargeCents > 0
                  ? ` - includes ${formatShopMoney(option.surchargeCents)} Live packaging fee.`
                  : ""}
              </p>
            </div>
          ))
        )}
      </div>
    </details>
  );
}

type ShopOrderAdminRow = {
  id: string;
  customer_email: string | null;
  status: string;
  total_cents: number | null;
  created_at: string;
  items?: ShopOrderItem[] | null;
  shipping_address?: ShopShippingAddress | null;
  square_checkout_url?: string | null;
};

type ShopSubscriberAdminRow = {
  email: string;
  name?: string | null;
  phone?: string | null;
  marketing_opt_in: boolean | null;
  shipping_address?: ShopShippingAddress | null;
};

type ShopUnsubscribedAdminRow = {
  email: string;
  name?: string | null;
  unsubscribe_reason?: string | null;
  unsubscribed_at?: string | null;
  updated_at?: string | null;
};

function PendingOrdersPanel({ orders }: { orders: ShopOrderAdminRow[] }) {
  return (
    <section className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-amber-50">Pending Orders</h2>
          <p className="mt-1 text-sm leading-6 text-amber-100/80">
            These customers started checkout but Square has not marked the order paid yet.
          </p>
        </div>
        <span className="rounded-md border border-amber-200/25 px-2 py-1 text-xs font-black uppercase text-amber-50">
          {orders.length} pending
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {orders.length === 0 ? (
          <p className="text-sm text-amber-100/75">No pending orders right now.</p>
        ) : (
          orders.map((order) => (
            <OrderCard key={order.id} order={order} pending />
          ))
        )}
      </div>
    </section>
  );
}

function OrdersPanel({ orders }: { orders: ShopOrderAdminRow[] }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
      <h2 className="text-xl font-black">Recent Orders</h2>
      <div className="mt-4 grid gap-2">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </section>
  );
}

function OrderCard({ order, pending = false }: { order: ShopOrderAdminRow; pending?: boolean }) {
  const reminderEmail = order.customer_email || order.shipping_address?.email || "";

  return (
    <div className="rounded-md bg-black/20 p-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="font-black">{order.customer_email || order.shipping_address?.email || "No email"}</span>
        <span className="rounded-md border border-white/10 px-2 py-1 text-xs font-black uppercase">{order.status}</span>
      </div>
      <p className="mt-1 text-slate-400">{new Date(order.created_at).toLocaleString()}</p>
      <p className="mt-2 font-black text-emerald-100">
        {formatShopMoney(Number(order.total_cents || 0))}
      </p>
      {order.shipping_address && (
        <div className="mt-2 rounded-md border border-white/10 bg-black/20 p-2 text-xs leading-5 text-slate-300">
          <div className="font-black text-slate-100">{order.shipping_address.name}</div>
          <div>{order.shipping_address.address1}</div>
          {order.shipping_address.address2 && <div>{order.shipping_address.address2}</div>}
          <div>
            {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postalCode}
          </div>
          {order.shipping_address.phone && <div>Phone: {order.shipping_address.phone}</div>}
        </div>
      )}
      {Array.isArray(order.items) && order.items.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-white/10 pt-2 text-xs text-slate-300">
          {order.items.map((item, index) => (
            <div key={`${order.id}-${index}`} className="flex justify-between gap-2">
              <span>{formatOrderItemName(item)}</span>
              <span className="font-bold">x{item.quantity}</span>
            </div>
          ))}
        </div>
      )}
      {pending && (
        <div className="mt-3 flex flex-wrap gap-2">
          {order.square_checkout_url && (
            <a
              href={order.square_checkout_url}
              className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-slate-100 hover:bg-white/10"
            >
              Open Checkout Link
            </a>
          )}
          {reminderEmail && (
            <form action={sendPendingShopOrderReminderAction}>
              <input type="hidden" name="id" value={order.id} />
              <button className="rounded-md border border-emerald-300/30 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-300/10">
                Send Reminder Email
              </button>
            </form>
          )}
          <form action={deletePendingShopOrderAction}>
            <input type="hidden" name="id" value={order.id} />
            <button className="rounded-md border border-red-300/30 px-3 py-2 text-xs font-black text-red-100 hover:bg-red-400/10">
              Delete Pending
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function SubscribersPanel({ subscribers }: { subscribers: ShopSubscriberAdminRow[] }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
      <h2 className="text-xl font-black">Email List</h2>
      <div className="mt-4 grid gap-2">
        {subscribers.length === 0 ? (
          <p className="text-sm text-slate-400">No emails collected yet.</p>
        ) : (
          subscribers.map((subscriber) => (
            <div key={subscriber.email} className="rounded-md bg-black/20 p-3 text-sm">
              <div className="font-black">{subscriber.name || subscriber.email}</div>
              {subscriber.name && <div className="mt-1 text-slate-300">{subscriber.email}</div>}
              {subscriber.phone && <div className="mt-1 text-slate-400">{subscriber.phone}</div>}
              <div className="mt-1 text-slate-400">
                {subscriber.marketing_opt_in ? "Marketing opt-in" : "Order contact only"}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function UnsubscribedPanel({ subscribers }: { subscribers: ShopUnsubscribedAdminRow[] }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Unsubscribed</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            These emails stay in your list, but are excluded from marketing sends.
          </p>
        </div>
        <span className="rounded-md border border-white/10 px-3 py-2 text-sm font-black text-slate-300">
          {subscribers.length}
        </span>
      </div>

      <div className="mt-4 grid gap-2">
        {subscribers.length === 0 ? (
          <p className="text-sm text-slate-400">No unsubscribes yet.</p>
        ) : (
          subscribers.map((subscriber) => (
            <details key={subscriber.email} className="rounded-md bg-black/20 p-3 text-sm">
              <summary className="cursor-pointer list-none font-black text-slate-100 marker:hidden">
                {subscriber.email}
              </summary>
              {subscriber.name && <div className="mt-2 text-slate-300">{subscriber.name}</div>}
              <div className="mt-1 text-xs text-slate-500">
                {subscriber.unsubscribed_at
                  ? new Date(subscriber.unsubscribed_at).toLocaleString()
                  : "Unsubscribed"}
              </div>
              <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-300">
                {subscriber.unsubscribe_reason || "No reason provided."}
              </div>
            </details>
          ))
        )}
      </div>
    </section>
  );
}

function ProductForm({
  action,
  categories,
  product,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  categories: string[];
  product?: ShopProduct;
  submitLabel: string;
}) {
  return (
    <form action={action} className="mt-4 grid gap-3">
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Name">
          <input name="name" required defaultValue={product?.name || ""} className={inputClass} />
        </Field>
        <Field label="Slug">
          <input
            name="slug"
            defaultValue={product?.slug || ""}
            placeholder="Auto-created from name"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_140px_140px_160px]">
        <Field label="Category">
          <input
            name="category"
            required
            defaultValue={product?.category || ""}
            list="shop-categories"
            className={inputClass}
          />
          <datalist id="shop-categories">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </Field>
        <Field label="Price">
          <input
            name="price"
            required
            type="number"
            min="0"
            step="0.01"
            defaultValue={product ? product.price_cents / 100 : ""}
            className={inputClass}
          />
        </Field>
        <Field label="Inventory">
          <input
            name="inventory"
            required
            type="number"
            min="0"
            defaultValue={product?.inventory ?? 0}
            className={inputClass}
          />
        </Field>
        <Field label="Shipping Mode">
          <select name="shipping_mode" defaultValue={product?.shipping_mode || "shipping"} className={inputClass}>
            <option value="shipping">Shipping</option>
            <option value="pickup">Pickup</option>
            <option value="contact">Coordinate live shipping</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-[160px_1fr]">
        <Field label="Shipping $">
          <input
            name="shipping"
            type="number"
            min="0"
            step="0.01"
            defaultValue={product ? product.shipping_cents / 100 : ""}
            className={inputClass}
          />
        </Field>
        <Field label="Image URL">
          <input name="image_url" defaultValue={product?.image_url || ""} className={inputClass} />
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
        <Field label="Option Name">
          <input
            name="option_name"
            defaultValue={product?.option_name || ""}
            placeholder="Example: Size"
            className={inputClass}
          />
        </Field>
        <Field label="Options / Variants">
          <textarea
            name="options"
            rows={4}
            defaultValue={formatProductOptionsInput(product)}
            placeholder={"Small\nMedium\nLarge\n6 inch | 40\n8 inch | 55 | 10"}
            className={`${inputClass} min-h-28`}
          />
          <p className="mt-1 text-xs leading-5 text-slate-500">
            One option per line. Use <span className="font-black text-slate-300">Label | Price | Inventory</span>.
            Leave price blank when the option uses the product price.
          </p>
        </Field>
      </div>

      <Field label="Description">
        <textarea
          name="description"
          rows={3}
          defaultValue={product?.description || ""}
          className={`${inputClass} min-h-24`}
        />
      </Field>

      <div className="flex flex-wrap gap-3">
        <Check name="active" label="Active" defaultChecked={product ? product.active : true} />
        <Check name="featured" label="Featured" defaultChecked={Boolean(product?.featured)} />
        <Check name="sold_out" label="Sold out" defaultChecked={Boolean(product?.sold_out)} />
      </div>

      <button className="w-fit rounded-md bg-emerald-300 px-5 py-3 font-black text-slate-950 hover:bg-emerald-200">
        {submitLabel}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-bold text-slate-300">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm font-bold text-slate-200">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

function formatZoneRates(values: number[]) {
  return values.map((value) => (value / 100).toFixed(2)).join(",");
}

function formatProductOptionsInput(product?: ShopProduct) {
  if (!product) return "";

  return normalizeProductOptions(product)
    .map((option) => {
      const price = typeof option.price_cents === "number" ? (option.price_cents / 100).toFixed(2) : "";
      const inventory = typeof option.inventory === "number" ? String(option.inventory) : "";
      return [option.label, price, inventory].join(" | ").replace(/( \| )+$/g, "");
    })
    .join("\n");
}

function StatusPill({ product }: { product: ShopProduct }) {
  const label = !product.active
    ? "Archived"
    : product.sold_out || product.inventory <= 0
      ? "Sold Out"
      : "Active";
  const tone =
    label === "Active"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
      : "border-amber-300/30 bg-amber-300/10 text-amber-100";

  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-black uppercase tracking-wide ${tone}`}>
      {label}
    </span>
  );
}

const inputClass =
  "w-full rounded-md border border-white/10 bg-[#07100c] px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-300 focus:outline-none";
