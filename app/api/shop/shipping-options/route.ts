import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import {
  getBlockedLiveStates,
  getLiveShippingSeason,
  getShippingOptions,
  hasLiveProducts,
  normalizeState,
  normalizeZip,
} from "@/lib/shop-shipping";
import { cleanCartItems, fetchCartProducts, matchCartProducts } from "@/lib/shop-server";

export async function POST(request: Request) {
  let body: { items?: unknown; shippingState?: string; shippingPostalCode?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const cleanItems = cleanCartItems(body.items);
  const shippingState = normalizeState(String(body.shippingState || ""));
  const shippingPostalCode = normalizeZip(String(body.shippingPostalCode || ""));

  if (cleanItems.length === 0) {
    return NextResponse.json({ error: "Add at least one item before shipping." }, { status: 400 });
  }

  if (!shippingState || !shippingPostalCode || shippingPostalCode.length !== 5) {
    return NextResponse.json({ error: "Enter a shipping state and 5-digit ZIP code." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const productIds = Array.from(new Set(cleanItems.map((item) => item.productId).filter(Boolean)));
  const slugs = Array.from(new Set(cleanItems.map((item) => item.slug).filter(Boolean)));
  const products = await fetchCartProducts(supabase, productIds, slugs);

  if (products.error) {
    return NextResponse.json({ error: products.error }, { status: 500 });
  }

  const matched = matchCartProducts(products.data || [], cleanItems);
  const missing = matched.find((match) => !match.product);

  if (missing) {
    return NextResponse.json(
      {
        error: `${
          missing.item.name || "One cart item"
        } is no longer available. Remove it from the cart and add it again.`,
      },
      { status: 400 }
    );
  }

  const cartProducts = matched.map((match) => match.product!);
  const hasLiveItems = hasLiveProducts(cartProducts);

  if (hasLiveItems) {
    const season = await getLiveShippingSeason();

    if (season.blocked) {
      return NextResponse.json({
        hasLiveItems,
        blocked: true,
        blockedReason: season.message,
        liveWarning: "",
        options: [],
      });
    }

    if ((await getBlockedLiveStates()).includes(shippingState)) {
      return NextResponse.json({
        hasLiveItems,
        blocked: true,
        blockedReason: `Crested Critters cannot live ship to ${shippingState} at this time due to permitting restrictions.`,
        liveWarning: "",
        options: [],
      });
    }
  }

  const options = await getShippingOptions({
    destinationZip: shippingPostalCode,
    destinationState: shippingState,
    hasLiveItems,
  });

  return NextResponse.json({
    hasLiveItems,
    blocked: false,
    blockedReason: "",
    liveWarning: hasLiveItems
      ? "Please review Live Shipping FAQ before checkout. Live orders can only use USPS 1 Day or USPS 2 Day shipping."
      : "",
    options,
  });
}
