import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import {
  formatOrderItemName,
  formatShopMoney,
  normalizeProductOptions,
  productTotalAvailableQuantity,
  squareApiBase,
  type ShopOrderItem,
  type ShopShippingAddress,
} from "@/lib/shop";

type ShopWebhookItem = {
  productId?: string;
  optionId?: string | null;
  quantity?: number;
};

export type PaidShopOrder = {
  id: string;
  customer_email: string | null;
  marketing_opt_in?: boolean | null;
  shipping_address?: ShopShippingAddress | null;
  items?: ShopOrderItem[] | null;
  subtotal_cents?: number | null;
  shipping_cents?: number | null;
  total_cents?: number | null;
  square_payment_link_id?: string | null;
  square_checkout_url?: string | null;
  status: string;
};

type SquarePayment = {
  id?: string;
  order_id?: string;
  status?: string;
};

export async function findCompletedSquarePaymentForOrder(squareOrderId: string) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken || !squareOrderId) return null;

  const response = await fetch(`${squareApiBase()}/v2/payments`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Square-Version": process.env.SQUARE_API_VERSION || "2026-04-16",
    },
  });

  if (!response.ok) return null;

  const payload = await response.json();
  const payments = Array.isArray(payload.payments)
    ? (payload.payments as SquarePayment[])
    : [];

  return (
    payments.find(
      (payment) =>
        payment.order_id === squareOrderId &&
        payment.id &&
        (payment.status === "COMPLETED" || payment.status === "APPROVED")
    ) || null
  );
}

export async function reconcilePaidShopOrderById(orderId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: order, error } = await supabase
    .from("shop_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle<PaidShopOrder & { square_order_id?: string | null }>();

  if (error) throw error;
  if (!order) return null;
  if (order.status === "paid") return order;
  if (!order.square_order_id) return order;

  const payment = await findCompletedSquarePaymentForOrder(order.square_order_id);
  if (!payment?.id) return order;

  await markShopOrderPaid(order.square_order_id, payment.id);

  const { data: updatedOrder } = await supabase
    .from("shop_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle<PaidShopOrder>();

  return updatedOrder || order;
}

export async function markShopOrderPaid(squareOrderId: string, squarePaymentId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: order, error: readError } = await supabase
    .from("shop_orders")
    .select("*")
    .eq("square_order_id", squareOrderId)
    .maybeSingle<PaidShopOrder>();

  if (readError) {
    if (readError.code === "42P01") return;
    throw readError;
  }

  if (!order || order.status === "paid") return;

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

  await savePaidShopLead(supabase, order, now);
  await sendPaidShopOrderEmails(order);
  await deleteSquarePaymentLink(order.square_payment_link_id || "");
  await decrementShopInventory(supabase, order, now);
}

async function deleteSquarePaymentLink(paymentLinkId: string) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken || !paymentLinkId) return;

  try {
    await fetch(`${squareApiBase()}/v2/online-checkout/payment-links/${paymentLinkId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Square-Version": process.env.SQUARE_API_VERSION || "2026-04-16",
      },
    });
  } catch {
    return;
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
  const nextMarketingOptIn =
    Boolean(existingLead?.marketing_opt_in) || Boolean(order.marketing_opt_in);

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

  const { error } = await supabase
    .from("shop_email_subscribers")
    .upsert(leadPayload, { onConflict: "email" });

  if (
    error?.message?.includes("shipping_address") ||
    error?.message?.includes("name") ||
    error?.message?.includes("phone")
  ) {
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

async function sendPaidShopOrderEmails(order: PaidShopOrder) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const from =
    process.env.SHOP_ORDER_EMAIL_FROM ||
    "Crested Critters Shop <orders@crestedcritters.com>";
  const adminEmail = normalizeEmail(
    process.env.SHOP_ORDER_EMAIL_TO || "sales@crestedcritters.com"
  );
  const customerEmail = normalizeEmail(
    order.customer_email || order.shipping_address?.email
  );

  await Promise.all([
    adminEmail
      ? sendEmail({
          apiKey,
          from,
          to: adminEmail,
          subject: `Paid shop order ${order.id.slice(0, 8)} - ${formatShopMoney(Number(order.total_cents || 0))}`,
          text: buildPaidShopAdminEmail(order),
        })
      : Promise.resolve(),
    customerEmail
      ? sendEmail({
          apiKey,
          from,
          to: customerEmail,
          subject: `Crested Critters order ${order.id.slice(0, 8)} received`,
          text: buildPaidShopCustomerEmail(order),
        })
      : Promise.resolve(),
  ]);
}

async function sendEmail({
  apiKey,
  from,
  to,
  subject,
  text,
}: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}) {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: process.env.SHOP_REPLY_TO_EMAIL || "Sales@crestedcritters.com",
        subject,
        text,
      }),
    });
  } catch {
    return;
  }
}

async function decrementShopInventory(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  order: PaidShopOrder,
  now: string
) {
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
    const nextInventory = hasOptions
      ? Number(product.inventory || 0)
      : Math.max(0, Number(product.inventory || 0) - quantity);
    const nextOptions =
      item.optionId &&
      productOptions.some(
        (option) => option.id === item.optionId && typeof option.inventory === "number"
      )
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

    if (Object.prototype.hasOwnProperty.call(product, "options")) {
      updatePayload.options = nextOptions;
    }

    await supabase.from("shop_products").update(updatePayload).eq("id", item.productId);
  }
}

function buildPaidShopAdminEmail(order: PaidShopOrder) {
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
    formatAddress(address),
    "",
    "Items:",
    ...items.map(
      (item) =>
        `- ${formatOrderItemName(item)} x${item.quantity} (${formatShopMoney(item.priceCents)} each)`
    ),
    "",
    `Subtotal: ${formatShopMoney(Number(order.subtotal_cents || 0))}`,
    `Shipping: ${formatShopMoney(Number(order.shipping_cents || 0))}`,
    `Total: ${formatShopMoney(Number(order.total_cents || 0))}`,
    order.square_checkout_url ? `Square checkout: ${order.square_checkout_url}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function buildPaidShopCustomerEmail(order: PaidShopOrder) {
  const address = order.shipping_address;
  const items = Array.isArray(order.items) ? order.items : [];

  return [
    `Hi ${address?.name || "there"},`,
    "",
    "Thank you for your Crested Critters order. Your payment was received and your order is in our queue.",
    "",
    `Order ID: ${order.id}`,
    "",
    "Items:",
    ...items.map((item) => `- ${formatOrderItemName(item)} x${item.quantity}`),
    "",
    `Subtotal: ${formatShopMoney(Number(order.subtotal_cents || 0))}`,
    `Shipping: ${formatShopMoney(Number(order.shipping_cents || 0))}`,
    `Total: ${formatShopMoney(Number(order.total_cents || 0))}`,
    "",
    "Shipping address:",
    formatAddress(address),
    "",
    "If anything looks wrong, reply to this email and we can help.",
    "",
    "Thank you,",
    "Crested Critters",
  ].join("\n");
}

function formatAddress(address?: ShopShippingAddress | null) {
  if (!address) return "Not provided";

  return [
    address.name,
    address.address1,
    address.address2,
    `${address.city}, ${address.state} ${address.postalCode}`,
    address.country || "US",
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeEmail(value: unknown) {
  const email = String(value || "").trim().toLowerCase();
  return email && email.includes("@") ? email : null;
}
