import { randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { getIsoTokenBalanceForProfile } from "@/lib/isotokens";
import { squareApiBase } from "@/lib/shop";

export type Raffle = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  rules: string | null;
  image_url: string | null;
  prize_type: string;
  status: "template" | "draft" | "active" | "closed" | "completed";
  entry_cost_isotokens: number;
  donation_cents_per_entry: number;
  allow_isotoken_entries: boolean;
  allow_donation_entries: boolean;
  allow_multiple_entries: boolean;
  max_entries: number | null;
  starts_at: string | null;
  ends_at: string | null;
  winner_profile_id: string | null;
  winner_entry_id: string | null;
  results_url: string | null;
  result_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RaffleEntry = {
  id: string;
  raffle_id: string;
  profile_id: string;
  entry_source: "isotokens" | "donation" | "manual";
  quantity: number;
  isotokens_spent: number;
  donation_cents: number;
  status: "pending" | "active" | "cancelled";
  created_at: string;
  profiles?: {
    username: string | null;
    display_name: string | null;
  } | null;
};

export function raffleBaseUrl(request?: Request) {
  const configured =
    process.env.ISOPEDIA_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_ISOPEDIA_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;

  if (configured) return configured.replace(/\/$/, "");
  if (request) return new URL(request.url).origin;
  return "https://isopedia.crestedcritters.com";
}

export function raffleSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function entryCount(entries: Array<Pick<RaffleEntry, "quantity" | "status">>) {
  return entries
    .filter((entry) => entry.status === "active")
    .reduce((total, entry) => total + Number(entry.quantity || 0), 0);
}

export async function canAddRaffleEntries(input: {
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase-server").createSupabaseServerClient>>;
  raffle: Raffle;
  profileId: string;
  quantity: number;
}) {
  const quantity = Math.max(1, Math.floor(input.quantity || 1));
  const { data: entries, error } = await input.supabase
    .from("isopedia_raffle_entries")
    .select("quantity, status, profile_id")
    .eq("raffle_id", input.raffle.id)
    .returns<Array<{ quantity: number; status: string; profile_id: string }>>();

  if (error) return { ok: false, message: error.message, quantity };

  const activeEntries = (entries || []).filter((entry) => entry.status === "active");
  const totalActiveEntries = activeEntries.reduce((total, entry) => total + Number(entry.quantity || 0), 0);
  const userActiveEntries = activeEntries
    .filter((entry) => entry.profile_id === input.profileId)
    .reduce((total, entry) => total + Number(entry.quantity || 0), 0);

  if (!input.raffle.allow_multiple_entries && userActiveEntries > 0) {
    return { ok: false, message: "This raffle allows only one entry per user.", quantity };
  }

  if (!input.raffle.allow_multiple_entries && quantity > 1) {
    return { ok: false, message: "This raffle allows only one entry per user.", quantity: 1 };
  }

  if (input.raffle.max_entries && totalActiveEntries + quantity > input.raffle.max_entries) {
    return { ok: false, message: "This raffle has reached its maximum number of entries.", quantity };
  }

  return { ok: true, quantity };
}

export async function activeEntryCountForUser(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase-server").createSupabaseServerClient>>,
  raffleId: string,
  profileId: string
) {
  const { data } = await supabase
    .from("isopedia_raffle_entries")
    .select("quantity")
    .eq("raffle_id", raffleId)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .returns<Array<{ quantity: number }>>();

  return (data || []).reduce((total, entry) => total + Number(entry.quantity || 0), 0);
}

export async function spendIsoTokensForRaffle(input: {
  profileId: string;
  raffleId: string;
  raffleTitle: string;
  amount: number;
}) {
  const admin = createSupabaseAdminClient();
  const balance = await getIsoTokenBalanceForProfile(admin as never, input.profileId);

  if (balance < input.amount) {
    throw new Error(`You need ${input.amount} IsoTokens to enter this raffle.`);
  }

  const { error } = await admin.from("isotoken_ledger").insert({
    profile_id: input.profileId,
    amount: -input.amount,
    reason: "raffle_entry",
    reason_key: `raffle_entry:${input.raffleId}:${input.profileId}:${Date.now()}`,
    description: `Redeemed IsoTokens for ${input.raffleTitle} raffle entries.`,
    entity_type: "raffle",
    entity_id: input.raffleId,
  });

  if (error) throw new Error(error.message);
}

export async function createRaffleDonationCheckout(input: {
  request?: Request;
  raffle: Raffle;
  entryId: string;
  quantity: number;
  email?: string | null;
}) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!accessToken || !locationId) throw new Error("Square checkout is not configured.");

  const amountCents = input.raffle.donation_cents_per_entry * input.quantity;
  const response = await fetch(`${squareApiBase()}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": process.env.SQUARE_API_VERSION || "2026-04-16",
    },
    body: JSON.stringify({
      idempotency_key: randomUUID(),
      quick_pay: {
        name: `Isopedia donation thank-you entry - ${input.raffle.title}`,
        price_money: { amount: amountCents, currency: "USD" },
        location_id: locationId,
      },
      checkout_options: {
        redirect_url: `${raffleBaseUrl(input.request)}/raffles?checkout=success`,
      },
      pre_populated_data: input.email ? { buyer_email: input.email } : undefined,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.errors?.[0]?.detail || "Square could not create checkout.");
  }

  return payload.payment_link as {
    id?: string;
    order_id?: string;
    url: string;
  };
}

export async function markRaffleDonationPaid(squareOrderId: string, squarePaymentId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: entry, error } = await supabase
    .from("isopedia_raffle_entries")
    .select("id, status")
    .eq("square_order_id", squareOrderId)
    .maybeSingle<{ id: string; status: string }>();

  if (error) throw error;
  if (!entry || entry.status === "active") return;

  const { error: updateError } = await supabase
    .from("isopedia_raffle_entries")
    .update({
      status: "active",
      square_payment_id: squarePaymentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entry.id);

  if (updateError) throw updateError;
}
