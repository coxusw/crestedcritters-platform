"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  formatOrderItemName,
  formatShopMoney,
  parseDollarToCents,
  slugifyProductName,
  type ShopOrderItem,
  type ShopShippingAddress,
} from "@/lib/shop";
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

export async function sendPendingShopOrderReminderAction(formData: FormData) {
  await requireAdmin();

  try {
    const id = String(formData.get("id") || "");
    if (!id) throw new Error("Missing order id.");

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("Missing RESEND_API_KEY in Vercel. Add it before sending reminder emails.");
    }

    const supabase = createSupabaseAdminClient();
    const { data: order, error } = await supabase
      .from("shop_orders")
      .select("id,customer_email,status,total_cents,items,shipping_address,square_checkout_url")
      .eq("id", id)
      .eq("status", "pending")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!order) throw new Error("Pending order was not found. It may already be paid or deleted.");

    const address = order.shipping_address as ShopShippingAddress | null;
    const email = order.customer_email || address?.email || "";
    if (!email) throw new Error("This pending order does not have an email address.");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:
          process.env.SHOP_REMINDER_EMAIL_FROM ||
          "Crested Critters <Sales@crestedcritters.com>",
        to: [email],
        reply_to: process.env.SHOP_REPLY_TO_EMAIL || "Sales@crestedcritters.com",
        subject: "Your Crested Critters checkout",
        text: buildPendingOrderReminderEmail({
          customerName: address?.name || "",
          totalCents: Number(order.total_cents || 0),
          items: Array.isArray(order.items) ? (order.items as ShopOrderItem[]) : [],
          checkoutUrl: order.square_checkout_url || "",
        }),
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Resend failed to send the reminder. ${details.slice(0, 500)}`);
    }
  } catch (error) {
    redirectShopAdminWithError(error);
  }

  redirectShopAdminWithNotice("Pending order reminder email sent.");
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

function redirectShopAdminWithNotice(message: string): never {
  revalidatePath("/admin/shop");
  redirect(`/admin/shop?notice=${encodeURIComponent(message)}`);
}

function redirectShopAdminWithError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  revalidatePath("/admin/shop");
  redirect(`/admin/shop?error=${encodeURIComponent(message.slice(0, 1400))}`);
}

function buildPendingOrderReminderEmail({
  customerName,
  totalCents,
  items,
  checkoutUrl,
}: {
  customerName: string;
  totalCents: number;
  items: ShopOrderItem[];
  checkoutUrl: string;
}) {
  return [
    `Hi ${customerName || "there"},`,
    "",
    "I noticed your Crested Critters checkout was started but has not been completed yet.",
    "If you had any trouble checking out or need help with your order, just reply to this email and I can help.",
    "",
    checkoutUrl ? `You can return to your checkout here: ${checkoutUrl}` : "",
    "",
    "Order summary:",
    ...items.map((item) => `- ${formatOrderItemName(item)} x${item.quantity}`),
    `Total: ${formatShopMoney(totalCents)}`,
    "",
    "Thank you,",
    "Crested Critters",
  ]
    .filter((line, index, lines) => line || lines[index - 1] !== "")
    .join("\n");
}
