import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { ShopProduct } from "@/lib/shop";
import ShopClient from "../ShopClient";
import ShopShell from "../ShopShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cart | Crested Critters Shop",
  description: "Review your Crested Critters cart and check out securely with Square.",
};

export default async function ShopCartPage() {
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
      <ShopClient products={(data || []) as ShopProduct[]} view="cart" />
    </ShopShell>
  );
}
