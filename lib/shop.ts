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
  option_name?: string | null;
  options?: ShopProductOption[] | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ShopProductOption = {
  id: string;
  label: string;
  price_cents?: number | null;
  inventory?: number | null;
  active?: boolean | null;
};

export type ShopCartItem = {
  productId: string;
  slug?: string;
  name?: string;
  optionId?: string;
  optionLabel?: string;
  quantity: number;
};

export type ShopOrderItem = {
  productId: string;
  slug: string;
  name: string;
  optionName?: string | null;
  optionId?: string | null;
  optionLabel?: string | null;
  quantity: number;
  priceCents: number;
  shippingCents: number;
  imageUrl: string | null;
};

export type ShopShippingAddress = {
  name: string;
  email: string;
  phone?: string | null;
  address1: string;
  address2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
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

export function normalizeProductOptions(product: Pick<ShopProduct, "options">) {
  if (!Array.isArray(product.options)) return [] as ShopProductOption[];

  return product.options
    .map((option) => ({
      id: String(option?.id || slugifyProductName(String(option?.label || ""))).trim(),
      label: String(option?.label || "").trim(),
      price_cents:
        typeof option?.price_cents === "number" && Number.isFinite(option.price_cents)
          ? Math.max(0, Math.round(option.price_cents))
          : null,
      inventory:
        typeof option?.inventory === "number" && Number.isFinite(option.inventory)
          ? Math.max(0, Math.floor(option.inventory))
          : null,
      active: option?.active !== false,
    }))
    .filter((option) => option.id && option.label && option.active);
}

export function getProductOption(product: Pick<ShopProduct, "options">, optionId?: string | null) {
  const options = normalizeProductOptions(product);
  if (options.length === 0) return null;
  return options.find((option) => option.id === optionId) || null;
}

export function productUnitPrice(
  product: Pick<ShopProduct, "price_cents">,
  option?: Pick<ShopProductOption, "price_cents"> | null
) {
  return typeof option?.price_cents === "number" ? option.price_cents : product.price_cents;
}

export function productAvailableQuantity(
  product: Pick<ShopProduct, "inventory">,
  option?: Pick<ShopProductOption, "inventory"> | null
) {
  return typeof option?.inventory === "number" ? option.inventory : product.inventory;
}

export function formatProductPrice(product: Pick<ShopProduct, "price_cents" | "options">) {
  const prices = [
    product.price_cents,
    ...normalizeProductOptions(product)
      .map((option) => productUnitPrice(product, option))
      .filter((price) => Number.isFinite(price)),
  ];
  const uniquePrices = Array.from(new Set(prices)).sort((left, right) => left - right);

  if (uniquePrices.length <= 1) return formatShopMoney(uniquePrices[0] || 0);
  return `${formatShopMoney(uniquePrices[0])} - ${formatShopMoney(uniquePrices[uniquePrices.length - 1])}`;
}

export function formatOrderItemName(item: Pick<ShopOrderItem, "name" | "optionName" | "optionLabel">) {
  if (!item.optionLabel) return item.name;
  return `${item.name} - ${item.optionName || "Option"}: ${item.optionLabel}`;
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
