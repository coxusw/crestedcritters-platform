import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import type { ShopProduct } from "@/lib/shop";

export type CleanCartItem = {
  productId: string;
  slug: string;
  name: string;
  quantity: number;
};

export function cleanCartItems(items: unknown) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const candidate = item as { productId?: unknown; slug?: unknown; name?: unknown; quantity?: unknown };
      return {
        productId: String(candidate.productId || ""),
        slug: String(candidate.slug || ""),
        name: String(candidate.name || ""),
        quantity: Math.max(1, Math.min(99, Math.floor(Number(candidate.quantity || 1)))),
      };
    })
    .filter((item) => item.productId || item.slug);
}

export async function fetchCartProducts(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  productIds: string[],
  slugs: string[]
) {
  if (productIds.length === 0 && slugs.length === 0) {
    return { data: [] as ShopProduct[], error: null as string | null };
  }

  const results = await Promise.all([
    productIds.length > 0
      ? supabase.from("shop_products").select("*").eq("active", true).in("id", productIds)
      : Promise.resolve({ data: [] as ShopProduct[] | null, error: null }),
    slugs.length > 0
      ? supabase.from("shop_products").select("*").eq("active", true).in("slug", slugs)
      : Promise.resolve({ data: [] as ShopProduct[] | null, error: null }),
  ]);

  const firstError = results.find((result) => result.error)?.error;
  if (firstError) return { data: [] as ShopProduct[], error: firstError.message };

  const merged = new Map<string, ShopProduct>();
  for (const result of results) {
    for (const product of (result.data || []) as ShopProduct[]) {
      merged.set(product.id, product);
    }
  }

  return { data: Array.from(merged.values()), error: null as string | null };
}

export function matchCartProducts(products: ShopProduct[], cleanItems: CleanCartItem[]) {
  const productById = new Map(products.map((product) => [product.id, product]));
  const productBySlug = new Map(products.map((product) => [product.slug, product]));

  return cleanItems.map((item) => ({
    item,
    product: productById.get(item.productId) || productBySlug.get(item.slug) || null,
  }));
}
