import type { createSupabaseServerClient } from "@/lib/supabase-server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type LimitedShopItem = {
  id: string;
  limited_quantity: number | null;
};

export type ShopAvailability = {
  purchasedCount: number;
  remainingQuantity: number | null;
  isSoldOut: boolean;
  label: string;
};

export async function getShopAvailabilityMap(
  supabase: SupabaseServerClient,
  items: LimitedShopItem[]
) {
  const ids = new Set(items.map((item) => item.id));
  const counts = new Map<string, number>();

  if (ids.size > 0) {
    const { data } = await supabase.rpc("get_isotoken_shop_purchase_counts");
    const rows = Array.isArray(data)
      ? (data as Array<{ item_id: string; purchase_count: number }>)
      : [];

    for (const count of rows) {
      if (ids.has(count.item_id)) {
        counts.set(count.item_id, Number(count.purchase_count) || 0);
      }
    }
  }

  return new Map(
    items.map((item) => [
      item.id,
      getShopAvailability(item.limited_quantity, counts.get(item.id) || 0),
    ])
  );
}

export function getShopAvailability(
  limitedQuantity: number | null,
  purchasedCount: number
): ShopAvailability {
  if (limitedQuantity === null) {
    return {
      purchasedCount,
      remainingQuantity: null,
      isSoldOut: false,
      label: "Unlimited",
    };
  }

  const remainingQuantity = Math.max(0, limitedQuantity - purchasedCount);

  return {
    purchasedCount,
    remainingQuantity,
    isSoldOut: remainingQuantity <= 0,
    label:
      remainingQuantity <= 0
        ? `Sold out - 0 of ${limitedQuantity} left`
        : `${remainingQuantity} of ${limitedQuantity} left`,
  };
}
