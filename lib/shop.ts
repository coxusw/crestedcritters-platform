export type ShopProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  image_url: string | null;
  price_cents: number;
  inventory: number;
  sold_out: boolean;
  featured: boolean;
  shipping_mode: string;
  shipping_cents: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ShopCartItem = {
  productId: string;
  quantity: number;
};

export type ShopOrderItem = {
  productId: string;
  slug: string;
  name: string;
  quantity: number;
  priceCents: number;
  shippingCents: number;
  imageUrl: string | null;
};

export function formatShopMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(cents || 0) / 100);
}

export function slugifyProductName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 90);
}

export function parseDollarToCents(value: FormDataEntryValue | null) {
  const numeric = Number(String(value || "0").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric * 100));
}

export function squareApiBase() {
  return process.env.SQUARE_ENVIRONMENT === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

export function shopBaseUrl(request?: Request) {
  const configured =
    process.env.SHOP_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_SHOP_URL;

  if (configured) return configured.replace(/\/$/, "");
  if (request) return new URL(request.url).origin;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return "https://shop.crestedcritters.com";
}
