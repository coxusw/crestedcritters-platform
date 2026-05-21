import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import {
  shopBaseUrl,
  squareApiBase,
  type ShopCartItem,
  type ShopOrderItem,
} from "@/lib/shop";
import {
  getBlockedLiveStates,
  getLiveShippingSeason,
  getShippingOptions,
  hasLiveProducts,
  normalizeState,
  normalizeZip,
} from "@/lib/shop-shipping";
import { cleanCartItems, fetchCartProducts, matchCartProducts } from "@/lib/shop-server";

type CheckoutRequest = {
  customerEmail?: string;
  marketingOptIn?: boolean;
  items?: ShopCartItem[];
  shippingState?: string;
  shippingPostalCode?: string;
  shippingServiceKey?: string;
  reviewedLiveShipping?: boolean;
};

export async function POST(request: Request) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!accessToken || !locationId) {
    return NextResponse.json(
      { error: "Square checkout is not configured yet." },
      { status: 500 }
    );
  }

  let body: CheckoutRequest;

  try {
    body = (await request.json()) as CheckoutRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const cleanItems = cleanCartItems(body.items);
  const shippingState = normalizeState(String(body.shippingState || ""));
  const shippingPostalCode = normalizeZip(String(body.shippingPostalCode || ""));
  const shippingServiceKey = String(body.shippingServiceKey || "");

  if (cleanItems.length === 0) {
    return NextResponse.json({ error: "Add at least one item before checkout." }, { status: 400 });
  }

  if (!shippingState || !shippingPostalCode || shippingPostalCode.length !== 5) {
    return NextResponse.json({ error: "Enter a shipping state and 5-digit ZIP code." }, { status: 400 });
  }

  if (!shippingServiceKey) {
    return NextResponse.json({ error: "Select a USPS shipping option." }, { status: 400 });
  }

  const productIds = Array.from(
    new Set(cleanItems.map((item) => item.productId).filter(Boolean))
  );
  const slugs = Array.from(new Set(cleanItems.map((item) => item.slug).filter(Boolean)));
  const supabase = createSupabaseAdminClient();
  const products = await fetchCartProducts(supabase, productIds, slugs);

  if (products.error) {
    return NextResponse.json({ error: products.error }, { status: 500 });
  }

  const matchedProducts = matchCartProducts(products.data || [], cleanItems);
  const orderItems: ShopOrderItem[] = [];

  for (const { item, product } of matchedProducts) {

    if (!product) {
      return NextResponse.json(
        {
          error: `${
            item.name || "One cart item"
          } is no longer available. Remove it from the cart and add it again.`,
        },
        { status: 400 }
      );
    }

    if (product.sold_out || product.inventory <= 0) {
      return NextResponse.json(
        { error: `${product.name} is sold out.` },
        { status: 400 }
      );
    }

    if (item.quantity > product.inventory) {
      return NextResponse.json(
        { error: `${product.name} only has ${product.inventory} available.` },
        { status: 400 }
      );
    }

    orderItems.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      quantity: item.quantity,
      priceCents: product.price_cents,
      shippingCents: product.shipping_cents,
      imageUrl: product.image_url,
    });
  }

  const subtotalCents = orderItems.reduce(
    (total, item) => total + item.priceCents * item.quantity,
    0
  );
  const hasLiveItems = hasLiveProducts(matchedProducts.map((match) => match.product!).filter(Boolean));

  if (hasLiveItems) {
    const season = await getLiveShippingSeason();

    if (season.blocked) {
      return NextResponse.json({ error: season.message }, { status: 400 });
    }

    if ((await getBlockedLiveStates()).includes(shippingState)) {
      return NextResponse.json(
        {
          error: `Crested Critters cannot live ship to ${shippingState} at this time due to permitting restrictions.`,
        },
        { status: 400 }
      );
    }

    if (!body.reviewedLiveShipping) {
      return NextResponse.json(
        { error: "Please review Live Shipping FAQ before checkout." },
        { status: 400 }
      );
    }
  }

  const shippingOptions = await getShippingOptions({
    destinationZip: shippingPostalCode,
    destinationState: shippingState,
    hasLiveItems,
  });
  const selectedShipping = shippingOptions.find(
    (option) => option.serviceKey === shippingServiceKey
  );

  if (!selectedShipping) {
    return NextResponse.json({ error: "Select an available USPS shipping option." }, { status: 400 });
  }

  const shippingCents = selectedShipping.totalCents;
  const totalCents = subtotalCents + shippingCents;

  if (totalCents <= 0) {
    return NextResponse.json({ error: "Checkout total must be greater than zero." }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabase
    .from("shop_orders")
    .insert({
      customer_email: normalizeEmail(body.customerEmail),
      subtotal_cents: subtotalCents,
      shipping_cents: shippingCents,
      total_cents: totalCents,
      items: orderItems,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return NextResponse.json(
      { error: orderError?.message || "Could not create order." },
      { status: 500 }
    );
  }

  const customerEmail = normalizeEmail(body.customerEmail);
  if (customerEmail) {
    await supabase.from("shop_email_subscribers").upsert(
      {
        email: customerEmail,
        marketing_opt_in: Boolean(body.marketingOptIn),
        source: Boolean(body.marketingOptIn) ? "checkout_opt_in" : "checkout_order",
        last_order_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );
  }

  const lineItems = orderItems.map((item) => ({
    name: item.name,
    quantity: String(item.quantity),
    item_type: "ITEM",
    base_price_money: {
      amount: item.priceCents,
      currency: "USD",
    },
  }));

  if (shippingCents > 0) {
    lineItems.push({
      name: `Shipping - ${selectedShipping.serviceName}`,
      quantity: "1",
      item_type: "ITEM",
      base_price_money: {
        amount: shippingCents,
        currency: "USD",
      },
    });
  }

  const squareResponse = await fetch(`${squareApiBase()}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": process.env.SQUARE_API_VERSION || "2026-04-16",
    },
    body: JSON.stringify({
      idempotency_key: randomUUID(),
      order: {
        location_id: locationId,
        reference_id: order.id,
        line_items: lineItems,
      },
      checkout_options: {
        redirect_url: `${shopBaseUrl(request)}/checkout/success?order=${order.id}`,
      },
      pre_populated_data: normalizeEmail(body.customerEmail)
        ? { buyer_email: normalizeEmail(body.customerEmail) }
        : undefined,
    }),
  });

  const squarePayload = await squareResponse.json();

  if (!squareResponse.ok) {
    await supabase
      .from("shop_orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", order.id);

    return NextResponse.json(
      { error: squarePayload.errors?.[0]?.detail || "Square could not create checkout." },
      { status: 502 }
    );
  }

  const paymentLink = squarePayload.payment_link;
  const { error: updateError } = await supabase
    .from("shop_orders")
    .update({
      square_order_id: paymentLink?.order_id || null,
      square_payment_link_id: paymentLink?.id || null,
      square_checkout_url: paymentLink?.url || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ checkoutUrl: paymentLink.url });
}

function normalizeEmail(value: unknown) {
  const email = String(value || "").trim().toLowerCase();
  return email && email.includes("@") ? email : null;
}
