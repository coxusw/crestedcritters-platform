import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import {
  formatOrderItemName,
  getProductOption,
  normalizeProductOptions,
  productAvailableQuantity,
  productUnitPrice,
  shopBaseUrl,
  squareApiBase,
  type ShopCartItem,
  type ShopOrderItem,
  type ShopShippingAddress,
} from "@/lib/shop";
import {
  getLiveShippingSeason,
  getShippingOptions,
  hasLiveProducts,
  normalizeState,
  normalizeZip,
} from "@/lib/shop-shipping";
import { cleanCartItems, fetchCartProducts, matchCartProducts } from "@/lib/shop-server";
import {
  getCartCompliance,
  type CartComplianceResult,
  type ProductAvailability,
} from "@/lib/shop-compliance";

type CheckoutRequest = {
  customerEmail?: string;
  marketingOptIn?: boolean;
  shippingAddress?: Partial<ShopShippingAddress>;
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
      { error: "Checkout is temporarily unavailable. Please contact Crested Critters to place this order." },
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
  const shippingAddress = normalizeShippingAddress(body.shippingAddress);
  const shippingState = shippingAddress.state || normalizeState(String(body.shippingState || ""));
  const shippingPostalCode = shippingAddress.postalCode || normalizeZip(String(body.shippingPostalCode || ""));
  const shippingServiceKey = String(body.shippingServiceKey || "");
  const customerEmail = normalizeEmail(body.customerEmail || shippingAddress.email);

  if (cleanItems.length === 0) {
    return NextResponse.json({ error: "Add at least one item before checkout." }, { status: 400 });
  }

  if (!shippingState || !shippingPostalCode || shippingPostalCode.length !== 5) {
    return NextResponse.json({ error: "Enter a shipping state and 5-digit ZIP code." }, { status: 400 });
  }

  if (!shippingAddress.name || !shippingAddress.email || !shippingAddress.address1 || !shippingAddress.city) {
    return NextResponse.json({ error: "Enter your full shipping address before checkout." }, { status: 400 });
  }

  if (!shippingServiceKey) {
    return NextResponse.json({ error: "Select a shipping option." }, { status: 400 });
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

    const productOptions = normalizeProductOptions(product);
    const selectedOption = productOptions.length > 0 ? getProductOption(product, item.optionId) : null;

    if (productOptions.length > 0 && !selectedOption) {
      return NextResponse.json(
        { error: `Choose a ${product.option_name || "size"} for ${product.name}.` },
        { status: 400 }
      );
    }

    const availableQuantity = productAvailableQuantity(product, selectedOption);

    if (product.sold_out || availableQuantity <= 0) {
      return NextResponse.json(
        { error: `${product.name} is sold out.` },
        { status: 400 }
      );
    }

    if (item.quantity > availableQuantity) {
      return NextResponse.json(
        { error: `${formatOrderItemName({ name: product.name, optionName: product.option_name, optionLabel: selectedOption?.label })} only has ${availableQuantity} available.` },
        { status: 400 }
      );
    }

    orderItems.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      optionName: selectedOption ? product.option_name || "Option" : null,
      optionId: selectedOption?.id || null,
      optionLabel: selectedOption?.label || null,
      quantity: item.quantity,
      priceCents: productUnitPrice(product, selectedOption),
      shippingCents: product.shipping_cents,
      imageUrl: product.image_url,
    });
  }

  const subtotalCents = orderItems.reduce(
    (total, item) => total + item.priceCents * item.quantity,
    0
  );
  const hasLiveItems = hasLiveProducts(matchedProducts.map((match) => match.product!).filter(Boolean));
  let compliance: CartComplianceResult | null = null;

  if (hasLiveItems) {
    const season = await getLiveShippingSeason();

    if (season.blocked) {
      return NextResponse.json({ error: season.message }, { status: 400 });
    }

    compliance = await getCartCompliance({
      products: matchedProducts.map((match) => match.product!).filter(Boolean),
      stateCode: shippingState,
      includeInternal: true,
    });

    if (compliance.overall !== "cleared") {
      const blockedItem = compliance.items.find(
        (item) => item.isLive && item.availability !== "available"
      );
      return NextResponse.json(
        {
          error:
            blockedItem?.publicMessage ||
            "One or more live items cannot be shipped to the selected state yet.",
          compliance,
        },
        { status: 400 }
      );
    }

    if (!body.reviewedLiveShipping) {
      return NextResponse.json(
        { error: "Please review the Live Shipping page before checkout." },
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
    return NextResponse.json({ error: "Select an available shipping option." }, { status: 400 });
  }

  const shippingCents = selectedShipping.totalCents;
  const totalCents = subtotalCents + shippingCents;

  if (totalCents <= 0) {
    return NextResponse.json({ error: "Checkout total must be greater than zero." }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabase
    .from("shop_orders")
    .insert({
      customer_email: customerEmail,
      shipping_address: shippingAddress,
      marketing_opt_in: Boolean(body.marketingOptIn),
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

  if (hasLiveItems && compliance) {
    await createLiveOrderRecord({
      supabase,
      orderId: order.id,
      shippingAddress,
      customerEmail,
      orderItems,
      compliance,
    });
  }

  await saveCheckoutLead({
    supabase,
    email: customerEmail || "",
    shippingAddress,
    marketingOptIn: Boolean(body.marketingOptIn),
  });

  const lineItems = orderItems.map((item) => ({
    name: formatOrderItemName(item),
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
      pre_populated_data: customerEmail
        ? { buyer_email: customerEmail }
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

async function createLiveOrderRecord({
  supabase,
  orderId,
  shippingAddress,
  customerEmail,
  orderItems,
  compliance,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  orderId: string;
  shippingAddress: ShopShippingAddress;
  customerEmail: string | null;
  orderItems: ShopOrderItem[];
  compliance: CartComplianceResult;
}) {
  const now = new Date().toISOString();
  const snapshot = {
    orderId,
    checkedAt: now,
    destinationState: shippingAddress.state,
    compliance,
    items: orderItems,
    shippingAddress,
  };
  const firstPermit = compliance.items.find((item) => item.permitNumber);
  const { data: record, error } = await supabase
    .from("live_order_records")
    .insert({
      order_id: orderId,
      is_live_order: true,
      destination_name: shippingAddress.name,
      destination_address_line_1: shippingAddress.address1,
      destination_address_line_2: shippingAddress.address2 || null,
      destination_city: shippingAddress.city,
      destination_state: shippingAddress.state,
      destination_postal_code: shippingAddress.postalCode,
      destination_country: shippingAddress.country || "US",
      customer_email: customerEmail || shippingAddress.email || null,
      customer_phone: shippingAddress.phone || null,
      permit_number_snapshot: firstPermit?.permitNumber || null,
      compliance_checked_at: now,
      compliance_result: "cleared",
      immutable_snapshot: snapshot,
      updated_at: now,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !record) {
    throw new Error(error?.message || "Could not create live shipment record.");
  }

  type LiveOrderItemInsert = {
    live_order_record_id: string;
    product_id: string;
    product_name_snapshot: string;
    morph_name_snapshot: string | null;
    scientific_name_snapshot: string | null;
    regulated_taxon_id: null;
    quantity: number;
    compliance_decision_id: string | null;
    decision_snapshot: ProductAvailability;
    permit_number_snapshot: string | null;
    destination_state_snapshot: string;
  };

  const liveItems = orderItems
    .map<LiveOrderItemInsert | null>((item) => {
      const itemCompliance = compliance.items.find(
        (result) => result.productId === item.productId
      );
      if (!itemCompliance?.isLive) return null;
      return {
        live_order_record_id: record.id,
        product_id: item.productId,
        product_name_snapshot: formatOrderItemName(item),
        morph_name_snapshot: item.optionLabel || null,
        scientific_name_snapshot: itemCompliance.canonicalScientificName,
        regulated_taxon_id: null,
        quantity: item.quantity,
        compliance_decision_id: itemCompliance.internalDecisionId || null,
        decision_snapshot: itemCompliance,
        permit_number_snapshot: itemCompliance.permitNumber || null,
        destination_state_snapshot: shippingAddress.state,
      };
    })
    .filter((item): item is LiveOrderItemInsert => Boolean(item));

  if (liveItems.length > 0) {
    const { error: itemsError } = await supabase.from("live_order_items").insert(liveItems);
    if (itemsError) throw new Error(itemsError.message);
  }
}

function normalizeEmail(value: unknown) {
  const email = String(value || "").trim().toLowerCase();
  return email && email.includes("@") ? email : null;
}

function normalizeShippingAddress(value: unknown): ShopShippingAddress {
  const record = (value && typeof value === "object" ? value : {}) as Partial<ShopShippingAddress>;
  return {
    name: cleanText(record.name),
    email: normalizeEmail(record.email) || "",
    phone: cleanText(record.phone || ""),
    address1: cleanText(record.address1),
    address2: cleanText(record.address2 || ""),
    city: cleanText(record.city),
    state: normalizeState(String(record.state || "")),
    postalCode: normalizeZip(String(record.postalCode || "")),
    country: "US",
  };
}

function cleanText(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

async function saveCheckoutLead({
  supabase,
  email,
  shippingAddress,
  marketingOptIn,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  email: string;
  shippingAddress: ShopShippingAddress;
  marketingOptIn: boolean;
}) {
  if (!email) return;

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("shop_email_subscribers")
    .select("marketing_opt_in")
    .eq("email", email)
    .maybeSingle();
  const nextMarketingOptIn = Boolean(existing?.marketing_opt_in) || marketingOptIn;

  await supabase.from("shop_email_subscribers").upsert(
    {
      email,
      name: shippingAddress.name || null,
      phone: shippingAddress.phone || null,
      shipping_address: shippingAddress,
      marketing_opt_in: nextMarketingOptIn,
      source: nextMarketingOptIn ? "checkout_opt_in" : "checkout",
      updated_at: now,
    },
    { onConflict: "email" }
  );
}
