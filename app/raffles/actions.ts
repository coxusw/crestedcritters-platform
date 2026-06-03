"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import {
  activeEntryCountForUser,
  canAddRaffleEntries,
  createRaffleDonationCheckout,
  isRaffleOpen,
  spendIsoTokensForRaffle,
  type Raffle,
} from "@/lib/isopedia-raffles";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function cleanQuantity(value: FormDataEntryValue | null) {
  return Math.max(1, Math.min(100, Math.floor(Number(value || 1))));
}

async function currentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/raffles");
  return { supabase, user };
}

async function activeRaffle(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, raffleId: string) {
  const { data, error } = await supabase
    .from("isopedia_raffles")
    .select("*")
    .eq("id", raffleId)
    .eq("status", "active")
    .maybeSingle<Raffle>();

  if (error || !data) throw new Error(error?.message || "This raffle is not active.");
  if (!isRaffleOpen(data)) throw new Error("This raffle is not currently open for entries.");

  return data;
}

export async function enterRaffleWithIsoTokens(formData: FormData) {
  const { supabase, user } = await currentUser();
  const raffleId = String(formData.get("raffle_id") || "");
  const raffle = await activeRaffle(supabase, raffleId);
  const requestedQuantity = cleanQuantity(formData.get("quantity"));

  if (!raffle.allow_isotoken_entries) redirect("/raffles?error=isotokens-disabled");

  const existingForUser = await activeEntryCountForUser(supabase, raffle.id, user.id);
  if (!raffle.allow_multiple_entries && existingForUser > 0) {
    redirect("/raffles?error=one-entry-only");
  }

  const allowed = await canAddRaffleEntries({
    supabase,
    raffle,
    profileId: user.id,
    quantity: requestedQuantity,
  });

  if (!allowed.ok) redirect(`/raffles?error=${encodeURIComponent(allowed.message || "Could not add entries.")}`);

  const quantity = allowed.quantity;
  const isotokensSpent = quantity * raffle.entry_cost_isotokens;
  await spendIsoTokensForRaffle({
    profileId: user.id,
    raffleId: raffle.id,
    raffleTitle: raffle.title,
    amount: isotokensSpent,
  });

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("isopedia_raffle_entries").insert({
    raffle_id: raffle.id,
    profile_id: user.id,
    entry_source: "isotokens",
    quantity,
    isotokens_spent: isotokensSpent,
    status: "active",
  });

  if (error) redirect(`/raffles?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/raffles");
  redirect("/raffles?entered=true");
}

export async function enterRaffleWithDonation(formData: FormData) {
  const { supabase, user } = await currentUser();
  const raffleId = String(formData.get("raffle_id") || "");
  const raffle = await activeRaffle(supabase, raffleId);
  const requestedQuantity = cleanQuantity(formData.get("quantity"));

  if (!raffle.allow_donation_entries) redirect("/raffles?error=donations-disabled");

  const existingForUser = await activeEntryCountForUser(supabase, raffle.id, user.id);
  if (!raffle.allow_multiple_entries && existingForUser > 0) {
    redirect("/raffles?error=one-entry-only");
  }

  const allowed = await canAddRaffleEntries({
    supabase,
    raffle,
    profileId: user.id,
    quantity: requestedQuantity,
  });

  if (!allowed.ok) redirect(`/raffles?error=${encodeURIComponent(allowed.message || "Could not add entries.")}`);

  const quantity = allowed.quantity;
  const donationCents = quantity * raffle.donation_cents_per_entry;
  const admin = createSupabaseAdminClient();
  const { data: entry, error } = await admin
    .from("isopedia_raffle_entries")
    .insert({
      raffle_id: raffle.id,
      profile_id: user.id,
      entry_source: "donation",
      quantity,
      donation_cents: donationCents,
      status: "pending",
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !entry) redirect(`/raffles?error=${encodeURIComponent(error?.message || "entry-failed")}`);

  let checkoutUrl = "";

  try {
    const paymentLink = await createRaffleDonationCheckout({
      raffle,
      entryId: entry.id,
      quantity,
      email: user.email,
    });

    await admin
      .from("isopedia_raffle_entries")
      .update({
        square_order_id: paymentLink.order_id || null,
        square_payment_link_id: paymentLink.id || null,
        square_checkout_url: paymentLink.url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entry.id);
    checkoutUrl = paymentLink.url;
  } catch (error) {
    await admin.from("isopedia_raffle_entries").update({ status: "cancelled" }).eq("id", entry.id);
    redirect(`/raffles?error=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
  }

  redirect(checkoutUrl);
}
