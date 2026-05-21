import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { formatShopMoney, type ShopProduct } from "@/lib/shop";
import {
  archiveShopProductAction,
  createShopProductAction,
  updateShopProductAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminShopPage() {
  await requireAdmin();
  const products = await getProducts();
  const categories = Array.from(new Set(products.map((product) => product.category))).sort();
  const activeCount = products.filter((product) => product.active).length;
  const soldOutCount = products.filter((product) => product.sold_out || product.inventory <= 0).length;

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

        <section className="grid gap-3 md:grid-cols-4">
          <Stat label="Products" value={products.length} />
          <Stat label="Active" value={activeCount} />
          <Stat label="Sold out" value={soldOutCount} alert={soldOutCount > 0} />
          <Stat label="Categories" value={categories.length} />
        </section>

        <section className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-5">
          <h2 className="text-xl font-black text-emerald-50">Add Product</h2>
          <ProductForm action={createShopProductAction} categories={categories} submitLabel="Add Product" />
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Catalog</h2>
              <p className="mt-1 text-sm text-slate-400">
                Edit a product and save. Archive hides it from the shop without deleting order history.
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {products.map((product) => (
              <article key={product.id} className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
                <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                      {product.category}
                    </p>
                    <h3 className="mt-1 text-xl font-black">{product.name}</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {formatShopMoney(product.price_cents)} - {product.inventory} in stock
                    </p>
                  </div>
                  <StatusPill product={product} />
                </div>

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
              </article>
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
