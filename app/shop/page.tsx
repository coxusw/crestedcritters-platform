import { createSupabaseServerClient } from "@/lib/supabase-server";
import { shopBaseUrl, type ShopProduct } from "@/lib/shop";
import ShopClient from "./ShopClient";
import ShopShell from "./ShopShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "Shop | Crested Critters" },
  description: "Shop Crested Critters isopods, botanicals, merch, and accessories.",
  alternates: {
    canonical: shopBaseUrl(),
  },
  openGraph: {
    title: "Shop | Crested Critters",
    description: "Shop Crested Critters isopods, botanicals, merch, and accessories.",
    url: shopBaseUrl(),
    siteName: "Crested Critters Shop",
  },
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
    <ShopShell>
      <ShopClient products={(data || []) as ShopProduct[]} view="shop" />
    </ShopShell>
  );
}
