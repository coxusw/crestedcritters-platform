import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { getRandomizerPackage } from "@/lib/randomizer-billing";

function squareApiBase() {
  return process.env.SQUARE_ENVIRONMENT === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

function appBaseUrl(request: Request) {
  const configured =
    process.env.RANDOMIZER_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_RANDOMIZER_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;

  if (configured) return configured.replace(/\/$/, "");

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!accessToken || !locationId) {
    return NextResponse.json(
      { error: "Square checkout is not configured yet." },
      { status: 500 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before purchasing." }, { status: 401 });
  }

  let body: { packageKey?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const selectedPackage = getRandomizerPackage(String(body.packageKey || ""));

  if (!selectedPackage) {
    return NextResponse.json({ error: "Unknown package." }, { status: 400 });
  }

  const baseUrl = appBaseUrl(request);
  const idempotencyKey = randomUUID();
  const squareResponse = await fetch(`${squareApiBase()}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": process.env.SQUARE_API_VERSION || "2026-04-16",
    },
    body: JSON.stringify({
      idempotency_key: idempotencyKey,
      quick_pay: {
        name: `Randomizer - ${selectedPackage.name}`,
        price_money: {
          amount: selectedPackage.amountCents,
          currency: "USD",
        },
        location_id: locationId,
      },
      checkout_options: {
        redirect_url: `${baseUrl}/billing?checkout=success`,
      },
      pre_populated_data: {
        buyer_email: user.email || undefined,
      },
    }),
  });

  const squarePayload = await squareResponse.json();

  if (!squareResponse.ok) {
    return NextResponse.json(
      { error: squarePayload.errors?.[0]?.detail || "Square could not create checkout." },
      { status: 502 }
    );
  }

  const paymentLink = squarePayload.payment_link;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("randomizer_orders").insert({
    user_id: user.id,
    package_key: selectedPackage.key,
    package_name: selectedPackage.name,
    amount_cents: selectedPackage.amountCents,
    credits: selectedPackage.credits,
    access_days: selectedPackage.accessDays,
    lifetime_access: selectedPackage.lifetimeAccess,
    square_order_id: paymentLink?.order_id || null,
    square_payment_link_id: paymentLink?.id || null,
    square_checkout_url: paymentLink?.url || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ checkoutUrl: paymentLink.url });
}
