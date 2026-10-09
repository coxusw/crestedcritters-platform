"use client";

import type { FormEvent } from "react";
import type { FutureExpense } from "./budgetModel";
import { dateLabel, money, todayIso } from "./budgetModel";
import { Modal } from "./BudgetUi";

export default function VaultTransferModal({
  fund, paycheckDate, remaining, error, saving, onClose, onSave,
}: {
  fund: FutureExpense;
  paycheckDate: string;
  remaining: number;
  error?: string;
  saving: boolean;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal title="Confirm vault transfer" onClose={onClose}>
      <form onSubmit={onSave} className="space-y-3">
        {error ? (
          <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm font-bold text-rose-800">
            {error}
          </div>
        ) : null}
        <div className="rounded-xl bg-slate-100 p-3 text-sm leading-5 text-slate-700">
          Move the money in your bank app first. This only records the transfer in your budget; it cannot move bank funds.
        </div>
        <p className="text-sm font-black text-slate-900">
          Into vault: {fund.event_fund || "Sinking fund"}
        </p>
        <p className="text-xs text-slate-500">
          {dateLabel(paycheckDate)} paycheck · {money(remaining)} still planned to transfer
        </p>
        <label className="block text-sm font-bold text-slate-700">
          Amount actually transferred
          <input name="amount" type="number" inputMode="decimal" required min="0.01" max={remaining.toFixed(2)} step="0.01"
            defaultValue={remaining.toFixed(2)} className="budget-input mt-1" />
        </label>
        <label className="block text-sm font-bold text-slate-700">
          Date transferred
          <input name="transferred_on" type="date" required defaultValue={todayIso()} className="budget-input mt-1" />
        </label>
        <label className="block text-sm font-bold text-slate-700">
          Note (optional)
          <input name="note" type="text" maxLength={160} placeholder="Bank vault transfer" className="budget-input mt-1" />
        </label>
        <button disabled={saving || remaining < 0.01} type="submit" className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
          {saving ? "Saving…" : "Confirm transfer completed"}
        </button>
      </form>
    </Modal>
  );
}
