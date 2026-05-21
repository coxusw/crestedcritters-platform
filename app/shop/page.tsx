import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { ShopProduct } from "@/lib/shop";
import ShopClient from "./ShopClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shop | Crested Critters",
  description: "Shop Crested Critters isopods, botanicals, merch, and accessories.",
};

export default async function ShopPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("shop_products")
    .select("*")
    .eq("active", true)
    .order("featured", { ascending: false })
    .order("category")
    .order("name");

  return (
    <main className="min-h-screen bg-[#f5f1e8] text-[#172018]">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 md:px-6">
        <header className="flex flex-col gap-4 border-b border-[#172018]/15 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-[#47715b]">
              Crested Critters
            </p>
            <h1 className="mt-2 text-4xl font-black md:text-5xl">Shop</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#405545] md:text-base">
              Isopods, springtails, botanicals, accessories, and merch in one cart with secure Square checkout.
            </p>
          </div>
          <div className="rounded-md border border-[#172018]/15 bg-white px-4 py-3 text-sm font-bold text-[#405545] shadow-sm">
            Secure checkout powered by Square
          </div>
        </header>

        <ShopClient products={(data || []) as ShopProduct[]} />
      </div>
    </main>
  );
}
