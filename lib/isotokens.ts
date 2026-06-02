import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";

export type IsoTokenLedgerEntry = {
  id: string;
  profile_id: string;
  amount: number;
  reason: string;
  description: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

export async function getIsoTokenBalance(profileId: string) {
  const supabase = await createSupabaseServerClient();
  return getIsoTokenBalanceForProfile(supabase, profileId);
}

export async function getIsoTokenBalanceForProfile(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profileId: string
) {
  try {
    const [{ data: ledgerRows }, { data: purchases }] = await Promise.all([
      supabase
        .from("isotoken_ledger")
        .select("amount")
        .eq("profile_id", profileId)
        .returns<Array<{ amount: number }>>(),
      supabase
        .from("isotoken_purchases")
        .select("price_paid")
        .eq("profile_id", profileId)
        .eq("status", "completed")
        .returns<Array<{ price_paid: number }>>(),
    ]);

    const earned = (ledgerRows || []).reduce(
      (total, entry) => total + Number(entry.amount || 0),
      0
    );
    const spent = (purchases || []).reduce(
      (total, purchase) => total + Number(purchase.price_paid || 0),
      0
    );

    return Math.max(0, earned - spent);
  } catch {
    return 0;
  }
}

export async function awardIsoTokens(
  _supabase: unknown,
  input: {
    profileId: string;
    amount: number;
    reason: string;
    reasonKey: string;
    description: string;
    entityType?: string | null;
    entityId?: string | null;
  }
) {
  if (!input.profileId || !input.reasonKey || input.amount === 0) return;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("isotoken_ledger")
    .upsert(
      {
        profile_id: input.profileId,
        amount: input.amount,
        reason: input.reason,
        reason_key: input.reasonKey,
        description: input.description,
        entity_type: input.entityType || null,
        entity_id: input.entityId || null,
      },
      {
        onConflict: "reason_key",
        ignoreDuplicates: true,
      }
    );

  if (error) {
    console.error("Failed to award IsoTokens:", error.message);
  }
}
