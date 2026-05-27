import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { productionIsopediaUrl } from "@/lib/isopedia-site";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type ShopItem = {
  id: string;
  item_key: string | null;
  name: string;
  description: string | null;
  item_type: string;
  price: number;
  active: boolean;
  limited_quantity: number | null;
  created_at: string;
};

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const [{ data: adminProfile }, { data: roleProfile }] = await Promise.all([
    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle(),
  ]);

  if (
    !adminProfile &&
    roleProfile?.role !== "admin" &&
    roleProfile?.role !== "moderator"
  ) {
    redirect("/admin/login");
  }

  return supabase;
}

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

async function createShopItem(formData: FormData) {
  "use server";

  const supabase = await requireAdmin();
  const name = clean(formData.get("name"));
  const description = clean(formData.get("description")) || null;
  const itemType = clean(formData.get("item_type")) || "feature";
  const price = Math.max(0, Number(clean(formData.get("price")) || 0));
  const itemKey = clean(formData.get("item_key")) || null;
  const limitedQuantityValue = clean(formData.get("limited_quantity"));
  const limitedQuantity = limitedQuantityValue
    ? Math.max(0, Number(limitedQuantityValue))
    : null;
  const active = clean(formData.get("active")) === "on";

  if (!name) {
    throw new Error("Item name is required.");
  }

  const { error } = await supabase.from("isotoken_shop_items").insert({
    item_key: itemKey,
    name,
    description,
    item_type: itemType,
    price,
    limited_quantity: limitedQuantity,
    active,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/isopedia/isotoken-shop");
  revalidatePath("/isotoken-store");
}

async function updateShopItem(formData: FormData) {
  "use server";

  const supabase = await requireAdmin();
  const id = clean(formData.get("id"));
  const name = clean(formData.get("name"));
  const description = clean(formData.get("description")) || null;
  const itemType = clean(formData.get("item_type")) || "feature";
  const price = Math.max(0, Number(clean(formData.get("price")) || 0));
  const itemKey = clean(formData.get("item_key")) || null;
  const limitedQuantityValue = clean(formData.get("limited_quantity"));
  const limitedQuantity = limitedQuantityValue
    ? Math.max(0, Number(limitedQuantityValue))
    : null;
  const active = clean(formData.get("active")) === "on";

  if (!id || !name) {
    throw new Error("Item id and name are required.");
  }

  const { error } = await supabase
    .from("isotoken_shop_items")
    .update({
      item_key: itemKey,
      name,
      description,
      item_type: itemType,
      price,
      limited_quantity: limitedQuantity,
      active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/isopedia/isotoken-shop");
  revalidatePath("/isotoken-store");
}

const itemTypes = [
  ["badge", "Badge"],
  ["feature", "Feature"],
  ["profile_banner", "Profile Banner"],
  ["username_change", "Username Change"],
  ["profile_theme", "Profile Theme"],
  ["other", "Other"],
];

export default async function IsoTokenShopAdminPage() {
  const supabase = await requireAdmin();
  const { data: items, error } = await supabase
    .from("isotoken_shop_items")
    .select(
      "id, item_key, name, description, item_type, price, active, limited_quantity, created_at"
    )
    .order("created_at", { ascending: false })
    .returns<ShopItem[]>();

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
              Isopedia Tools
            </p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">
              IsoToken Shop
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Add future IsoToken rewards, set prices, and choose which items
              appear in the public IsoToken Store.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/isopedia"
              className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
            >
              Back to Isopedia
            </Link>
            <Link
              href={`${productionIsopediaUrl}/isotoken-store`}
              className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300"
            >
              View Store
            </Link>
          </div>
        </header>

        {error ? (
          <section className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
            The IsoToken shop tables are not available yet. Run the new
            Supabase migration, then refresh this page.
          </section>
        ) : (
          <>
            <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
              <h2 className="text-xl font-black text-white">Add Shop Item</h2>
              <ShopItemForm action={createShopItem} />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              {(items || []).map((item) => (
                <article
                  key={item.id}
                  className="rounded-lg border border-white/10 bg-white/[0.05] p-5"
                >
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black text-white">
                        {item.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        {item.price} IsoTokens -{" "}
                        {item.active ? "Active" : "Hidden"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        item.active
                          ? "bg-emerald-400 text-slate-950"
                          : "bg-white/10 text-slate-300"
                      }`}
                    >
                      {item.active ? "Storefront" : "Inactive"}
                    </span>
                  </div>

                  <ShopItemForm action={updateShopItem} item={item} />
                </article>
              ))}

              {items?.length === 0 && (
                <p className="rounded-lg border border-white/10 bg-white/[0.05] p-5 text-sm text-slate-400">
                  No IsoToken shop items yet.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function ShopItemForm({
  action,
  item,
}: {
  action: (formData: FormData) => Promise<void>;
  item?: ShopItem;
}) {
  return (
    <form action={action} className="mt-4 grid gap-4">
      {item && <input type="hidden" name="id" value={item.id} />}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Name
          </span>
          <input
            name="name"
            defaultValue={item?.name || ""}
            required
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Item Key Optional
          </span>
          <input
            name="item_key"
            defaultValue={item?.item_key || ""}
            placeholder="profile-banner-unlock"
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300"
          />
        </label>
      </div>

      <label className="grid gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
          Description
        </span>
        <textarea
          name="description"
          defaultValue={item?.description || ""}
          className="min-h-20 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Type
          </span>
          <select
            name="item_type"
            defaultValue={item?.item_type || "feature"}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300"
          >
            {itemTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Price
          </span>
          <input
            name="price"
            type="number"
            min={0}
            defaultValue={item?.price || 0}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Limit Optional
          </span>
          <input
            name="limited_quantity"
            type="number"
            min={0}
            defaultValue={item?.limited_quantity ?? ""}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300"
          />
        </label>

        <label className="flex items-end gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm font-bold text-slate-200">
          <input
            name="active"
            type="checkbox"
            defaultChecked={item?.active || false}
          />
          Active in store
        </label>
      </div>

      <div>
        <button
          type="submit"
          className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-300"
        >
          {item ? "Save Item" : "Create Item"}
        </button>
      </div>
    </form>
  );
}
