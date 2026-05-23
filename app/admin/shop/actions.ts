"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { parseDollarToCents, slugifyProductName } from "@/lib/shop";
import {
  getShopShippingSettings,
  saveShopShippingSettings,
  type ShopShippingSettings,
} from "@/lib/shop-shipping-settings";

export async function createShopProductAction(formData: FormData) {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const payload = productPayload(formData);

  const { error } = await supabase.from("shop_products").insert(payload);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/shop");
  revalidatePath("/shop");
}

export async function updateShopProductAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Missing product id.");

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("shop_products")
    .update({ ...productPayload(formData), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/shop");
  revalidatePath("/shop");
}

export async function archiveShopProductAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Missing product id.");

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("shop_products")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/shop");
  revalidatePath("/shop");
}

export async function deletePendingShopOrderAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Missing order id.");

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("shop_orders")
    .delete()
    .eq("id", id)
    .eq("status", "pending");

  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath("/admin/shop");
}

export async function updateShippingSettingsAction(formData: FormData) {
  await requireAdmin();
  const current = await getShopShippingSettings();
  const next: ShopShippingSettings = {
    ...current,
    originZip: String(formData.get("originZip") || current.originZip).trim(),
    packageLengthIn: Number(formData.get("packageLengthIn") || current.packageLengthIn),
    packageWidthIn: Number(formData.get("packageWidthIn") || current.packageWidthIn),
    packageHeightIn: Number(formData.get("packageHeightIn") || current.packageHeightIn),
    packageWeightLb: Number(formData.get("packageWeightLb") || current.packageWeightLb),
    useShippo: formData.get("useShippo") === "on",
    useRevAddress: formData.get("useRevAddress") === "on",
    blockedLiveStates: String(formData.get("blockedLiveStates") || "")
      .split(",")
      .map((state) => state.trim().toUpperCase())
      .filter(Boolean),
    seasonalSurchargesCents: {
      spring: parseDollarToCents(formData.get("springSurcharge")),
      summer: parseDollarToCents(formData.get("summerSurcharge")),
      october: parseDollarToCents(formData.get("octoberSurcharge")),
      november: parseDollarToCents(formData.get("novemberSurcharge")),
    },
    fallbackRatesCents: {
      usps_1_day: parseZoneRateList(formData.get("oneDayRates"), current.fallbackRatesCents.usps_1_day),
      usps_2_day: parseZoneRateList(formData.get("twoDayRates"), current.fallbackRatesCents.usps_2_day),
      usps_ground: parseZoneRateList(formData.get("groundRates"), current.fallbackRatesCents.usps_ground),
    },
  };

  await saveShopShippingSettings(next);
  revalidatePath("/admin/shop");
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: adminProfile } = await supabase
    .from("admin_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminProfile) redirect("/admin/login");
}

function productPayload(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const slugInput = String(formData.get("slug") || "").trim();
  const slug = slugifyProductName(slugInput || name);

  if (!name) throw new Error("Product name is required.");
  if (!slug) throw new Error("Product slug is required.");

  return {
    name,
    slug,
    category: String(formData.get("category") || "Isopods").trim() || "Isopods",
    description: String(formData.get("description") || "").trim() || null,
    image_url: String(formData.get("image_url") || "").trim() || null,
    price_cents: parseDollarToCents(formData.get("price")),
    inventory: Math.max(0, Math.floor(Number(formData.get("inventory") || 0))),
    shipping_mode: String(formData.get("shipping_mode") || "shipping"),
    shipping_cents: parseDollarToCents(formData.get("shipping")),
    option_name: String(formData.get("option_name") || "").trim() || null,
    options: parseProductOptions(formData.get("options")),
    sold_out: formData.get("sold_out") === "on",
    featured: formData.get("featured") === "on",
    active: formData.get("active") === "on",
  };
}

function parseProductOptions(value: FormDataEntryValue | null) {
  const seen = new Map<string, number>();

  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawLabel, rawPrice, rawInventory] = line.split("|").map((part) => part.trim());
      const label = rawLabel || "";
      const baseId = slugifyProductName(label);
      const count = seen.get(baseId) || 0;
      seen.set(baseId, count + 1);
      const id = count > 0 ? `${baseId}-${count + 1}` : baseId;
      const priceText = rawPrice || "";
      const inventoryText = rawInventory || "";

      return {
        id,
        label,
        price_cents: priceText ? parseDollarToCents(priceText) : null,
        inventory: inventoryText ? Math.max(0, Math.floor(Number(inventoryText))) : null,
        active: true,
      };
    })
    .filter((option) => option.id && option.label);
}

function parseZoneRateList(value: FormDataEntryValue | null, fallback: number[]) {
  const parsed = String(value || "")
    .split(",")
    .map((item) => parseDollarToCents(item.trim()))
    .filter((item) => item >= 0);

  if (parsed.length < 9) return fallback;
  return parsed.slice(0, 9);
}
