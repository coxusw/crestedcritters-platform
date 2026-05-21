"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseSquareBankingCsv } from "@/lib/bookkeeping/banking-csv";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import {
  diagnoseSquareBookkeepingPull,
  fetchSquareBookkeepingTransactions,
} from "@/lib/bookkeeping/square";

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

function redirectAddTabWithNotice(message: string): never {
  revalidatePath("/admin/bookkeeping");
  redirect(`/admin/bookkeeping?tab=add&notice=${encodeURIComponent(message)}`);
}

function redirectAddTabWithError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  revalidatePath("/admin/bookkeeping");
  redirect(`/admin/bookkeeping?tab=add&error=${encodeURIComponent(message.slice(0, 1400))}`);
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
        mileage: numberValue(formData, "mileage"),
        mileage_deduction: numberValue(formData, "mileage_deduction"),
        source: "manual",
        imported_from: "Manual",
        notes: textValue(formData, "notes") || null,
        reviewed: formData.get("reviewed") === "on",
      });

    if (error) throw new Error(error.message);
  } catch (error) {
    redirectAddTabWithError(error);
  }

  redirectAddTabWithNotice("Added manual bookkeeping entry.");
}

export async function createCashDepositTransaction(formData: FormData) {
  await requireContentAgentAdmin();

  try {
    const amount = numberValue(formData, "amount");
    if (amount <= 0) throw new Error("Cash deposit amount must be greater than zero.");

    const depositDate = textValue(formData, "transaction_date") || new Date().toISOString().slice(0, 10);
    const description = textValue(formData, "description") || "Cash deposited into Square";

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("bookkeeping_transactions")
      .insert({
        transaction_date: depositDate,
        type: "transfer",
        classification: "ignore",
        category: "Cash Deposit",
        description,
        amount,
        payment_method: "Cash to Square",
        money_destination: "Square",
        source: "cash_deposit",
        imported_from: "Manual Cash Deposit",
        notes: textValue(formData, "notes") || "Moves existing cash on hand into Square without counting as new income.",
        reviewed: true,
      });

    if (error) throw new Error(error.message);
  } catch (error) {
    redirectAddTabWithError(error);
  }

  redirectAddTabWithNotice("Recorded cash deposit as a transfer from cash on hand to Square.");
}

export async function pullSquareBookkeepingTransactions() {
  await requireContentAgentAdmin();
  let notice = "";

  try {
    const squarePull = await fetchSquareBookkeepingTransactions();
    const squareTransactions = squarePull.transactions;
    if (squareTransactions.length === 0) {
      notice = `Square pull finished. No completed payments were found for 2026. Checked ${squarePull.locations.length} location(s).`;
    } else {
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

      notice = `Square pull finished. Added ${newTransactions.length} new payment rows. Skipped ${
        squareTransactions.length - newTransactions.length
      } already imported rows. Checked ${squarePull.locations.length} location(s).`;
    }
    if (squarePull.warning) notice += `\n\nWarning: ${squarePull.warning}`;
  } catch (error) {
    redirectWithError(error);
  }

  redirectWithNotice(notice);
}

export async function diagnoseSquareBookkeepingTransactions() {
  await requireContentAgentAdmin();
  let notice = "";

  try {
    const diagnostic = await diagnoseSquareBookkeepingPull();
    notice = `Square diagnostic:\n${diagnostic}`;
  } catch (error) {
    redirectWithError(error);
  }

  redirectWithNotice(notice);
}

export async function importSquareBankingCsv(formData: FormData) {
  await requireContentAgentAdmin();
  let notice = "";

  try {
    const file = formData.get("banking_csv");
    if (!(file instanceof File)) throw new Error("Choose a Square Banking CSV file.");

    const csvText = await file.text();
    const parsed = parseSquareBankingCsv(csvText, file.name);
    if (parsed.transactions.length === 0) {
      notice = `Square Banking CSV parsed, but no 2026 importable rows were found. Skipped ${parsed.skippedOld} old rows and ${parsed.skippedInvalid} invalid rows. Headers: ${parsed.headers.join(", ")}`;
    } else {
      const supabase = createSupabaseAdminClient();
      const sourceKeys = parsed.transactions.map((transaction) => transaction.source_key);
      const { data: existingRows, error: existingError } = await supabase
        .from("bookkeeping_transactions")
        .select("source_key")
        .in("source_key", sourceKeys);

      if (existingError) throw new Error(existingError.message);

      const existingKeys = new Set((existingRows || []).map((row) => row.source_key));
      const newTransactions = parsed.transactions.filter(
        (transaction) => !existingKeys.has(transaction.source_key)
      );

      if (newTransactions.length > 0) {
        const { error } = await supabase.from("bookkeeping_transactions").insert(newTransactions);
        if (error) throw new Error(error.message);
      }

      notice = `Square Banking CSV import finished. Added ${newTransactions.length} rows. Skipped ${
        parsed.transactions.length - newTransactions.length
      } duplicate rows, ${parsed.skippedOld} pre-2026 rows, and ${parsed.skippedInvalid} invalid rows.`;
    }
  } catch (error) {
    redirectWithError(error);
  }

  redirectWithNotice(notice);
}

export async function bulkUpdateBookkeepingTransactions(formData: FormData) {
  await requireContentAgentAdmin();
  let savedCount = 0;

  try {
    const ids = formData.getAll("transaction_id").map((id) => String(id));
    if (ids.length === 0) throw new Error("No transactions were submitted.");

    const supabase = createSupabaseAdminClient();
    const updates = ids.map((id) => {
      const type = textValue(formData, `type:${id}`);
      const classification = textValue(formData, `classification:${id}`);

      if (!TYPES.has(type)) throw new Error("Invalid transaction type.");
      if (!CLASSIFICATIONS.has(classification)) throw new Error("Invalid classification.");

      return supabase
        .from("bookkeeping_transactions")
        .update({
          transaction_date: textValue(formData, `transaction_date:${id}`) || null,
          type,
          classification,
          category: textValue(formData, `category:${id}`) || null,
          description: textValue(formData, `description:${id}`) || null,
          amount: numberValue(formData, `amount:${id}`),
          payment_method: textValue(formData, `payment_method:${id}`) || null,
          mileage: numberValue(formData, `mileage:${id}`),
          mileage_deduction: numberValue(formData, `mileage_deduction:${id}`),
          receipt_status: textValue(formData, `receipt_status:${id}`) || null,
          receipt_location: textValue(formData, `receipt_location:${id}`) || null,
          notes: textValue(formData, `notes:${id}`) || null,
          reviewed: formData.get(`reviewed:${id}`) === "on",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    });

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);
    if (failed?.error) throw new Error(failed.error.message);

    savedCount = ids.length;
  } catch (error) {
    redirectWithError(error);
  }

  redirectWithNotice(`Saved ${savedCount} bookkeeping transactions.`);
}

export async function deleteSelectedBookkeepingTransactions(formData: FormData) {
  await requireContentAgentAdmin();
  let deletedCount = 0;

  try {
    const ids = formData.getAll("delete_transaction_id").map((id) => String(id));
    if (ids.length === 0) throw new Error("Select at least one transaction to delete.");

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("bookkeeping_transactions")
      .delete()
      .in("id", ids);

    if (error) throw new Error(error.message);
    deletedCount = ids.length;
  } catch (error) {
    redirectWithError(error);
  }

  redirectWithNotice(`Deleted ${deletedCount} bookkeeping transaction${deletedCount === 1 ? "" : "s"}.`);
}

export async function rebalanceBookkeepingBalances(formData: FormData) {
  await requireContentAgentAdmin();
  let notice = "";

  try {
    const squareTarget = numberValue(formData, "square_balance");
    const cashTarget = numberValue(formData, "cash_on_hand");
    const supabase = createSupabaseAdminClient();

    const { data, error: fetchError } = await supabase
      .from("bookkeeping_transactions")
      .select("type, classification, category, amount, payment_method, money_destination, source, imported_from")
      .gte("transaction_date", "2026-01-01")
      .limit(2000);

    if (fetchError) throw new Error(fetchError.message);

    const current = summarizeBalancesForAction(data || []);
    const squareDelta = Number((squareTarget - current.squareBalance).toFixed(2));
    const cashDelta = Number((cashTarget - current.cashOnHand).toFixed(2));
    const today = new Date().toISOString().slice(0, 10);
    const rows = [
      buildRebalanceRow("Square", squareTarget, squareDelta, today),
      buildRebalanceRow("Cash", cashTarget, cashDelta, today),
    ].filter((row) => Math.abs(row.amount) >= 0.01);

    if (rows.length > 0) {
      const { error } = await supabase.from("bookkeeping_transactions").insert(rows);
      if (error) throw new Error(error.message);
    }

    notice =
      rows.length > 0
        ? `Rebalanced books. Square adjustment: ${formatSignedMoney(squareDelta)}. Cash adjustment: ${formatSignedMoney(cashDelta)}.`
        : "Books already match those Square and cash balances.";
  } catch (error) {
    redirectWithError(error);
  }

  redirectWithNotice(notice);
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
        mileage: numberValue(formData, "mileage"),
        mileage_deduction: numberValue(formData, "mileage_deduction"),
        receipt_status: textValue(formData, "receipt_status") || null,
        receipt_location: textValue(formData, "receipt_location") || null,
        notes: textValue(formData, "notes") || null,
        reviewed: formData.get("reviewed") === "on",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw new Error(error.message);
  } catch (error) {
    redirectWithError(error);
  }

  redirectWithNotice("Saved bookkeeping transaction.");
}

type BalanceActionRow = {
  type: string;
  classification: string;
  category: string | null;
  amount: number;
  payment_method: string | null;
  money_destination: string | null;
  source: string;
  imported_from: string | null;
};

function summarizeBalancesForAction(rows: BalanceActionRow[]) {
  return rows.reduce(
    (totals, row) => {
      const label = `${row.payment_method || ""} ${row.money_destination || ""}`.toLowerCase();
      const amount = Number(row.amount || 0);
      if (isCashDepositBalanceRow(row)) {
        totals.squareBalance += amount;
        totals.cashOnHand -= amount;
        return totals;
      }
      if (label.includes("square")) totals.squareBalance += balanceEffectForAction(row, amount);
      if (label.includes("cash")) totals.cashOnHand += balanceEffectForAction(row, amount);
      return totals;
    },
    { squareBalance: 0, cashOnHand: 0 }
  );
}

function balanceEffectForAction(row: BalanceActionRow, amount: number) {
  if (row.source === "rebalance") return amount;
  if (row.classification === "ignore") return 0;
  if (isCashDepositBalanceRow(row)) return 0;
  if (row.classification === "owner_draw") return -amount;
  if (row.classification === "owner_contribution") return amount;
  if (row.type === "income") return amount;
  if (row.type === "expense" || row.type === "tax" || row.type === "transfer") return -amount;
  return 0;
}

function isCashDepositBalanceRow(row: BalanceActionRow) {
  const category = (row.category || "").toLowerCase();
  const importedFrom = (row.imported_from || "").toLowerCase();
  return (
    row.source === "cash_deposit" ||
    row.classification === "cash_deposit" ||
    category === "cash deposit" ||
    importedFrom.includes("cash deposit")
  );
}

function buildRebalanceRow(destination: "Square" | "Cash", target: number, amount: number, date: string) {
  return {
    transaction_date: date,
    type: "transfer",
    classification: "ignore",
    category: "Balance Rebalance",
    description: `Rebalanced available ${destination} balance to ${formatSignedMoney(target).replace("+", "")} on ${date}`,
    amount,
    payment_method: destination,
    source: "rebalance",
    source_key: `rebalance-${destination.toLowerCase()}-${date}-${Date.now()}`,
    imported_from: "Balance Rebalance",
    money_destination: destination,
    notes: "Opening 2026 balance correction so the ledger matches available funds going forward.",
    reviewed: true,
  };
}

function formatSignedMoney(value: number) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    signDisplay: "always",
  }).format(value);
  return formatted.replace("+-$", "-$");
}
