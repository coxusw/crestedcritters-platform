import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { getCartCompliance } from "@/lib/shop-compliance";
import { normalizeState } from "@/lib/shop-shipping";
import type { ShopProduct } from "@/lib/shop";

export async function POST(request: Request) {
  let body: { productIds?: string[]; stateCode?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const stateCode = normalizeState(String(body.stateCode || ""));
  const productIds = Array.from(
    new Set((body.productIds || []).map((id) => String(id || "")).filter(Boolean))
  ).slice(0, 100);
  const numericProductIds = productIds
    .map((id) => Number(id))
    .filter((id) => Number.isSafeInteger(id) && id > 0);

  if (!stateCode) {
    return NextResponse.json({ error: "Select a destination state." }, { status: 400 });
  }

  if (numericProductIds.length === 0) {
    return NextResponse.json({ stateCode, overall: "cleared", items: [] });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_products")
    .select("*")
    .eq("active", true)
    .in("id", numericProductIds);

  if (error) {
    return NextResponse.json({ error: "Could not check product availability." }, { status: 500 });
  }

  const compliance = await getCartCompliance({
    products: (data || []) as ShopProduct[],
    stateCode,
    includeInternal: false,
  });

  return NextResponse.json(compliance);
}
