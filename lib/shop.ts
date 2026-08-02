export type ShopProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  card_description?: string | null;
  full_description?: string | null;
  source_note?: string | null;
  image_url: string | null;
  image_urls?: string[] | null;
  price_cents: number;
  inventory: number;
  sold_out: boolean;
  featured: boolean;
  shipping_mode: string;
  shipping_cents: number;
  option_name?: string | null;
  options?: ShopProductOption[] | null;
  active: boolean;
  is_live?: boolean | null;
  live_category?: "isopod" | "springtail" | "gecko" | "plant" | "other" | null;
  regulated_taxon_id?: string | null;
  taxon_mapping_status?: "verified" | "provisional" | "unmapped" | "disputed" | null;
  local_pickup_possible?: boolean | null;
  requires_live_shipping_method?: boolean | null;
  compliance_exempt?: boolean | null;
  compliance_exempt_reason?: string | null;
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

export function isPackInventoryProduct(
  product: Pick<ShopProduct, "category" | "live_category" | "is_live">
) {
  const category = String(product.category || "").toLowerCase();
  return (
    product.live_category === "isopod" ||
    product.live_category === "springtail" ||
    category.includes("isopod") ||
    category.includes("springtail")
  );
}

export function productOptionUnitCount(option?: Pick<ShopProductOption, "label"> | null) {
  const match = String(option?.label || "").match(/^\s*(\d+)\s*(?:count|ct)\b/i);
  const count = match ? Number(match[1]) : 1;
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
}

export function productAvailableQuantity(
  product: Pick<ShopProduct, "inventory" | "category" | "live_category" | "is_live">,
  option?: Pick<ShopProductOption, "inventory" | "label"> | null
) {
  if (isPackInventoryProduct(product)) {
    return Math.floor(product.inventory / productOptionUnitCount(option));
  }

  return typeof option?.inventory === "number" ? option.inventory : product.inventory;
}

export function productTotalAvailableQuantity(
  product: Pick<ShopProduct, "inventory" | "options" | "category" | "live_category" | "is_live">
) {
  if (isPackInventoryProduct(product)) return product.inventory;

  const options = normalizeProductOptions(product);
  if (options.length === 0) return product.inventory;

  return options.reduce(
    (total, option) => total + productAvailableQuantity(product, option),
    0
  );
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

export function shopProductCardDescription(
  product: Pick<ShopProduct, "card_description" | "description">
) {
  return product.card_description || product.description || "";
}

export function shopProductFullDescription(
  product: Pick<ShopProduct, "full_description" | "card_description" | "description">
) {
  return product.full_description || product.description || product.card_description || "";
}

const SHOP_PRODUCT_ISOPEDIA_URLS: Record<string, string> = {
  "dairy-cows": "https://isopedia.crestedcritters.com/dairy-cow-isopod",
  "powder-orange":
    "https://isopedia.crestedcritters.com/porcellionides-pruinosus-powder-orange-powder-powder-orange",
  gestroi: "https://isopedia.crestedcritters.com/gestroi-gold-spot-isopod",
  "yellow-zebra":
    "https://isopedia.crestedcritters.com/armadillidium-maculatum-yellow-zebra-yellow-zebra",
  "orange-cream":
    "https://isopedia.crestedcritters.com/porcellionides-pruinosus-orange-cream-orange-cream",
  "oreo-crumble":
    "https://isopedia.crestedcritters.com/porcellionides-pruinosus-oreo-crumble-oreo-crumble",
  "pineapple-spikey":
    "https://isopedia.crestedcritters.com/cristarmadillidium-muricatum-pineapple-spikey",
  "high-white-zebra":
    "https://isopedia.crestedcritters.com/armadillidium-maculatum-high-white-white-zebra",
  "red-panda": "https://isopedia.crestedcritters.com/red-panda-isopod",
  "rubber-ducky": "https://isopedia.crestedcritters.com/rubber-ducky",
  "temporate-springtails":
    "https://isopedia.crestedcritters.com/folsomia-candida-temperate-springtails",
  "black-panda":
    "https://isopedia.crestedcritters.com/cubaris-sp-black-panda-black-panda-black-panda-king",
  "cherry-blossoms":
    "https://isopedia.crestedcritters.com/cubaris-sp-cherry-blossom-cherry-blossom",
  citrus: "https://isopedia.crestedcritters.com/cubaris-sp-citrus-citrus",
  "panda-kings": "https://isopedia.crestedcritters.com/sp-panda-king-panda-king",
};

export function shopProductIsopediaUrl(product: Pick<ShopProduct, "slug">) {
  return SHOP_PRODUCT_ISOPEDIA_URLS[product.slug] || "";
}

export function normalizeShopProductImages(
  product: Pick<ShopProduct, "image_url" | "image_urls">
) {
  const values = [
    product.image_url,
    ...(Array.isArray(product.image_urls) ? product.image_urls : []),
  ];
  const seen = new Set<string>();

  return values
    .map((value) => String(value || "").trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
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
