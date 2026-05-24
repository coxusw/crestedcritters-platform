import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import {
  formatOrderItemName,
  formatShopMoney,
  normalizeProductOptions,
  productTotalAvailableQuantity,
  type ShopOrderItem,
  type ShopShippingAddress,
} from "@/lib/shop";

function verifySquareSignature(rawBody: string, signature: string | null) {
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const notificationUrl = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL;

  if (!signatureKey || !notificationUrl || !signature) return false;

  const expected = createHmac("sha256", signatureKey)
    .update(notificationUrl + rawBody)
    .digest("base64");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

type ShopWebhookItem = {
  productId?: string;
  optionId?: string | null;
  quantity?: number;
};

type PaidShopOrder = {
  id: string;
  customer_email: string | null;
  marketing_opt_in?: boolean | null;
  shipping_address?: ShopShippingAddress | null;
  items?: ShopOrderItem[] | null;
  subtotal_cents?: number | null;
  shipping_cents?: number | null;
  total_cents?: number | null;
  square_checkout_url?: string | null;
  status: string;
};

async function grantRandomizerOrder(squareOrderId: string, squarePaymentId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: order, error: readError } = await supabase
    .from("randomizer_orders")
    .select("*")
    .eq("square_order_id", squareOrderId)
    .maybeSingle();

  if (readError) throw readError;
  if (!order || order.status === "paid") return;

  const { data: account } = await supabase
    .from("randomizer_accounts")
    .select("*")
    .eq("user_id", order.user_id)
    .maybeSingle();

  const now = new Date();
  const currentExpiry = account?.access_expires_at
    ? new Date(account.access_expires_at)
    : null;
  const accessBase =
    currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  const nextExpiry = order.access_days
    ? new Date(accessBase.getTime() + Number(order.access_days) * 24 * 60 * 60 * 1000)
    : currentExpiry;

  const { error: accountError } = await supabase.from("randomizer_accounts").upsert({
    user_id: order.user_id,
    credits: Number(account?.credits || 0) + Number(order.credits || 0),
    lifetime_access: Boolean(account?.lifetime_access) || Boolean(order.lifetime_access),
    access_expires_at: order.lifetime_access ? account?.access_expires_at || null : nextExpiry?.toISOString() || null,
    updated_at: now.toISOString(),
  });

  if (accountError) throw accountError;

  const { error: orderError } = await supabase
    .from("randomizer_orders")
    .update({
      status: "paid",
      square_payment_id: squarePaymentId,
      completed_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", order.id);

  if (orderError) throw orderError;
}

async function markShopOrderPaid(squareOrderId: string, squarePaymentId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: order, error: readError } = await supabase
    .from("shop_orders")
    .select("*")
    .eq("square_order_id", squareOrderId)
    .maybeSingle();

  if (readError) {
    if (readError.code === "42P01") return;
    throw readError;
  }
  if (!order || order.status === "paid") return;
  const shopOrder = order as PaidShopOrder;

  const now = new Date().toISOString();
  const { error: orderError } = await supabase
    .from("shop_orders")
    .update({
      status: "paid",
      square_payment_id: squarePaymentId,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", order.id);

  if (orderError) throw orderError;

  await savePaidShopLead(supabase, shopOrder, now);
  await sendPaidShopOrderEmail(shopOrder);

  const items = Array.isArray(order.items) ? (order.items as ShopWebhookItem[]) : [];

  for (const item of items) {
    if (!item.productId) continue;
    const quantity = Math.max(0, Math.floor(Number(item.quantity || 0)));
    if (quantity <= 0) continue;

    const { data: product, error: productError } = await supabase
      .from("shop_products")
      .select("*")
      .eq("id", item.productId)
      .maybeSingle();

    if (productError || !product) continue;

    const productOptions = normalizeProductOptions(product);
    const hasOptions = productOptions.length > 0;
    const nextInventory = hasOptions ? Number(product.inventory || 0) : Math.max(0, Number(product.inventory || 0) - quantity);
    const nextOptions =
      item.optionId && productOptions.some((option) => option.id === item.optionId && typeof option.inventory === "number")
        ? productOptions.map((option) =>
            option.id === item.optionId && typeof option.inventory === "number"
              ? { ...option, inventory: Math.max(0, option.inventory - quantity) }
              : option
          )
        : product.options;
    const nextProduct = {
      ...product,
      inventory: nextInventory,
      options: nextOptions,
    };
    const updatePayload: Record<string, unknown> = {
      inventory: nextInventory,
      sold_out: productTotalAvailableQuantity(nextProduct) <= 0,
      updated_at: now,
    };

    if (Object.prototype.hasOwnProperty.call(product, "options")) updatePayload.options = nextOptions;

    await supabase
      .from("shop_products")
      .update(updatePayload)
      .eq("id", item.productId);
  }
}

async function savePaidShopLead(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  order: PaidShopOrder,
  paidAt: string
) {
  const address = order.shipping_address;
  const email = normalizeEmail(order.customer_email || address?.email);
  if (!email) return;
  const { data: existingLead } = await supabase
    .from("shop_email_subscribers")
    .select("marketing_opt_in")
    .eq("email", email)
    .maybeSingle();
  const nextMarketingOptIn = Boolean(existingLead?.marketing_opt_in) || Boolean(order.marketing_opt_in);

  const leadPayload: Record<string, unknown> = {
    email,
    name: address?.name || null,
    phone: address?.phone || null,
    shipping_address: address || null,
    marketing_opt_in: nextMarketingOptIn,
    source: nextMarketingOptIn ? "paid_order_opt_in" : "paid_order",
    last_order_at: paidAt,
    updated_at: paidAt,
  };

  const { error } = await supabase.from("shop_email_subscribers").upsert(leadPayload, { onConflict: "email" });

  if (error?.message?.includes("shipping_address") || error?.message?.includes("name") || error?.message?.includes("phone")) {
    await supabase.from("shop_email_subscribers").upsert(
      {
        email,
        marketing_opt_in: nextMarketingOptIn,
        source: leadPayload.source,
        last_order_at: paidAt,
        updated_at: paidAt,
      },
      { onConflict: "email" }
    );
  }
}

async function sendPaidShopOrderEmail(order: PaidShopOrder) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.SHOP_ORDER_EMAIL_FROM || "Crested Critters Shop <orders@crestedcritters.com>",
        to: [process.env.SHOP_ORDER_EMAIL_TO || "sales@crestedcritters.com"],
        subject: `Paid shop order ${order.id.slice(0, 8)} - ${formatShopMoney(Number(order.total_cents || 0))}`,
        text: buildPaidShopOrderEmail(order),
      }),
    });
  } catch {
    return;
  }
}

function buildPaidShopOrderEmail(order: PaidShopOrder) {
  const address = order.shipping_address;
  const items = Array.isArray(order.items) ? order.items : [];

  return [
    "A paid Crested Critters shop order is ready to process.",
    "",
    `Order ID: ${order.id}`,
    `Customer: ${address?.name || "Not provided"}`,
    `Email: ${order.customer_email || address?.email || "Not provided"}`,
    `Phone: ${address?.phone || "Not provided"}`,
    "",
    "Shipping address:",
    address
      ? [
          address.name,
          address.address1,
          address.address2,
          `${address.city}, ${address.state} ${address.postalCode}`,
          address.country || "US",
        ].filter(Boolean).join("\n")
      : "Not provided",
    "",
    "Items:",
    ...items.map((item) => `- ${formatOrderItemName(item)} x${item.quantity} (${formatShopMoney(item.priceCents)} each)`),
    "",
    `Subtotal: ${formatShopMoney(Number(order.subtotal_cents || 0))}`,
    `Shipping: ${formatShopMoney(Number(order.shipping_cents || 0))}`,
    `Total: ${formatShopMoney(Number(order.total_cents || 0))}`,
    order.square_checkout_url ? `Square checkout: ${order.square_checkout_url}` : "",
  ].filter((line) => line !== "").join("\n");
}

function normalizeEmail(value: unknown) {
  const email = String(value || "").trim().toLowerCase();
  return email && email.includes("@") ? email : null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature");

  if (!verifySquareSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const payment = event?.data?.object?.payment;

  if (
    payment?.order_id &&
    payment?.id &&
    (payment.status === "COMPLETED" || payment.status === "APPROVED")
  ) {
    await grantRandomizerOrder(payment.order_id, payment.id);
    await markShopOrderPaid(payment.order_id, payment.id);
  }

  return NextResponse.json({ ok: true });
}
