import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";

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
  quantity?: number;
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

  const items = Array.isArray(order.items) ? (order.items as ShopWebhookItem[]) : [];

  for (const item of items) {
    if (!item.productId) continue;
    const quantity = Math.max(0, Math.floor(Number(item.quantity || 0)));
    if (quantity <= 0) continue;

    const { data: product, error: productError } = await supabase
      .from("shop_products")
      .select("inventory")
      .eq("id", item.productId)
      .maybeSingle();

    if (productError || !product) continue;

    const nextInventory = Math.max(0, Number(product.inventory || 0) - quantity);
    await supabase
      .from("shop_products")
      .update({
        inventory: nextInventory,
        sold_out: nextInventory <= 0,
        updated_at: now,
      })
      .eq("id", item.productId);
  }
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
