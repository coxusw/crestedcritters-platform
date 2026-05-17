"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { fetchSquareBookkeepingTransactions } from "@/lib/bookkeeping/square";

const CLASSIFICATIONS = new Set([
  "business",
  "owner_contribution",
  "owner_draw",
  "sales_tax",
  "ignore",
]);

const TYPES = new Set(["income", "expense", "equity", "tax", "mileage", "transfer"]);

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function numberValue(formData: FormData, key: string) {
  const parsed = Number(textValue(formData, key).replace(/[$,]/g, "") || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function redirectWithNotice(message: string): never {
  revalidatePath("/admin/bookkeeping");
  redirect(`/admin/bookkeeping?notice=${encodeURIComponent(message)}`);
}

function redirectWithError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  revalidatePath("/admin/bookkeeping");
  redirect(`/admin/bookkeeping?error=${encodeURIComponent(message.slice(0, 1400))}`);
}

export async function createManualBookkeepingTransaction(formData: FormData) {
  await requireContentAgentAdmin();

  try {
    const type = textValue(formData, "type");
    const classification = textValue(formData, "classification");

    if (!TYPES.has(type)) throw new Error("Invalid transaction type.");
    if (!CLASSIFICATIONS.has(classification)) throw new Error("Invalid classification.");

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("bookkeeping_transactions")
      .insert({
        transaction_date: textValue(formData, "transaction_date") || null,
        type,
        classification,
        category: textValue(formData, "category") || null,
        description: textValue(formData, "description") || null,
        amount: numberValue(formData, "amount"),
        payment_method: textValue(formData, "payment_method") || null,
        source: "manual",
        imported_from: "Manual",
        notes: textValue(formData, "notes") || null,
        reviewed: formData.get("reviewed") === "on",
      });

    if (error) throw new Error(error.message);

    redirectWithNotice("Added manual bookkeeping entry.");
  } catch (error) {
    redirectWithError(error);
  }
}

export async function pullSquareBookkeepingTransactions() {
  await requireContentAgentAdmin();

  try {
    const squareTransactions = await fetchSquareBookkeepingTransactions();
    if (squareTransactions.length === 0) {
      redirectWithNotice("Square pull finished. No completed payments were found in the last year.");
    }

    const supabase = createSupabaseAdminClient();
    const sourceKeys = squareTransactions.map((transaction) => transaction.source_key);
    const { data: existingRows, error: existingError } = await supabase
      .from("bookkeeping_transactions")
      .select("source_key")
      .in("source_key", sourceKeys);

    if (existingError) throw new Error(existingError.message);

    const existingKeys = new Set((existingRows || []).map((row) => row.source_key));
    const newTransactions = squareTransactions.filter(
      (transaction) => !existingKeys.has(transaction.source_key)
    );

    if (newTransactions.length > 0) {
      const { error } = await supabase
        .from("bookkeeping_transactions")
        .insert(newTransactions);

      if (error) throw new Error(error.message);
    }

    redirectWithNotice(
      `Square pull finished. Added ${newTransactions.length} new payment rows. Skipped ${
        squareTransactions.length - newTransactions.length
      } already imported rows.`
    );
  } catch (error) {
    redirectWithError(error);
  }
}

export async function updateBookkeepingTransaction(formData: FormData) {
  await requireContentAgentAdmin();

  try {
    const id = textValue(formData, "transaction_id");
    if (!id) throw new Error("Missing transaction ID.");

    const type = textValue(formData, "type");
    const classification = textValue(formData, "classification");

    if (!TYPES.has(type)) throw new Error("Invalid transaction type.");
    if (!CLASSIFICATIONS.has(classification)) throw new Error("Invalid classification.");

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("bookkeeping_transactions")
      .update({
        transaction_date: textValue(formData, "transaction_date") || null,
        type,
        classification,
        category: textValue(formData, "category") || null,
        description: textValue(formData, "description") || null,
        amount: numberValue(formData, "amount"),
        payment_method: textValue(formData, "payment_method") || null,
        receipt_status: textValue(formData, "receipt_status") || null,
        receipt_location: textValue(formData, "receipt_location") || null,
        notes: textValue(formData, "notes") || null,
        reviewed: formData.get("reviewed") === "on",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw new Error(error.message);

    redirectWithNotice("Saved bookkeeping transaction.");
  } catch (error) {
    redirectWithError(error);
  }
}
