"use client";

import { useEffect, useMemo, useState } from "react";
import { dateLabel, money, num } from "./budgetModel";

export type DeficitBufferOption = {
  expense_id: string;
  name: string;
  current_amount: number | string;
  already_spent: number | string;
  maximum_reduction: number | string;
  suggested_reduction: number | string;
};

export type DeficitBillOption = {
  expense_id: string;
  name: string;
  amount: number | string;
  due_date: string;
  next_paycheck: string;
  category: string;
};

export type DeficitPreview = {
  paycheck_date: string;
  remaining_after_plan: number | string;
  shortfall: number | string;
  requires_review: boolean;
  next_paycheck: string | null;
  next_period_remaining: number | string | null;
  buffer_options: DeficitBufferOption[];
  bills_near_next_paycheck: DeficitBillOption[];
};

type Choice = { type: "reduce_buffer" | "move_bill"; id: string } | null;

type Props = {
  preview: DeficitPreview | null;
  loading: boolean;
  saving: boolean;
  error: string;
  onClose: () => void;
  onApply: (type: "reduce_buffer" | "move_bill", expenseId: string, newAmount?: number) => Promise<void>;
};

function amountOrZero(value: number | string | null | undefined) {
  return num(value ?? 0);
}

function overdueDays(due: string, payday: string) {
  const a = Date.parse(due + "T00:00:00Z");
  const b = Date.parse(payday + "T00:00:00Z");
  return Math.max(0, Math.round((b - a) / 86400000));
}

export default function DeficitReviewModal({
  preview,
  loading,
  saving,
  error,
  onClose,
  onApply,
}: Props) {
  const [choice, setChoice] = useState<Choice>(null);
  const [newAmount, setNewAmount] = useState("");
  const [understandLate, setUnderstandLate] = useState(false);

  useEffect(() => {
    setChoice(null);
    setNewAmount("");
    setUnderstandLate(false);
  }, [preview?.paycheck_date, preview?.remaining_after_plan]);

  const buffer = useMemo(
    () => choice?.type === "reduce_buffer"
      ? preview?.buffer_options?.find((x) => x.expense_id === choice.id)
      : undefined,
    [choice, preview]
  );
  const bill = useMemo(
    () => choice?.type === "move_bill"
      ? preview?.bills_near_next_paycheck?.find((x) => x.expense_id === choice.id)
      : undefined,
    [choice, preview]
  );

  const current = amountOrZero(preview?.remaining_after_plan);
  const next = amountOrZero(preview?.next_period_remaining);
  const parsedAmount = Number(newAmount);
  const validAmount = buffer && newAmount.trim() !== ""
    && Number.isFinite(parsedAmount)
    && parsedAmount >= amountOrZero(buffer.already_spent)
    && parsedAmount >= 0
    && parsedAmount < amountOrZero(buffer.current_amount);
  const difference = buffer && validAmount
    ? amountOrZero(buffer.current_amount) - parsedAmount
    : bill ? amountOrZero(bill.amount) : 0;
  const canApply = !loading && !saving
    && (choice?.type === "reduce_buffer" ? Boolean(validAmount)
      : choice?.type === "move_bill" ? Boolean(bill && understandLate) : false);

  return (
    <div role="presentation" className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/70 p-0 sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-label="Resolve paycheck deficit" className="flex max-h-[95dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-950 p-4 text-white sm:p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-200">Paycheck deficit review</p>
            <h2 className="mt-1 text-xl font-black">
              {preview ? dateLabel(preview.paycheck_date) : "Checking the forecast"}
            </h2>
            <p className="mt-1 text-xs text-slate-300">Your choices are not saved until you confirm.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl bg-white/15 px-3 py-2 text-sm font-black text-white" aria-label="Close deficit review">✕</button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-6 sm:p-5">
          {loading || !preview ? (
            <div className="py-6 text-center">
              <p className="text-sm text-slate-600">Checking the budget and available options…</p>
              {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800">{error}</p>}
            </div>
          ) : (
            <>
              <div className={"rounded-2xl border p-4 " + (current < -0.005 ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50")}>
                <p className="text-xs font-black text-slate-600">Cash after this paycheck's plan</p>
                <strong className={"mt-1 block text-2xl font-black " + (current < -0.005 ? "text-rose-800" : "text-emerald-800")}>{money(current)}</strong>
                {current < -0.005 ? (
                  <p className="mt-1 text-xs leading-5 text-rose-900">The plan needs {money(amountOrZero(preview.shortfall))} more cash to break even. Choose an adjustment below, or keep it unchanged.</p>
                ) : (
                  <p className="mt-1 text-sm font-bold text-emerald-800">This paycheck no longer has a shortfall.</p>
                )}
                {preview.next_paycheck && (
                  <p className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-700">
                    Following paycheck ({dateLabel(preview.next_paycheck)}): {money(next)} forecast remaining
                  </p>
                )}
              </div>

              {current < -0.005 && (
                <>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">1. Reduce an unplanned-expense buffer</h3>
                    <p className="mt-1 text-xs text-slate-600">Change only the selected paycheck's planned buffer, not earlier spending or its recurring template.</p>
                    <div className="mt-2 space-y-2">
                      {(preview.buffer_options || []).map((item) => (
                        <button
                          key={item.expense_id}
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            const suggested = Math.max(amountOrZero(item.already_spent),
                              amountOrZero(item.current_amount) - amountOrZero(item.suggested_reduction));
                            setChoice({ type: "reduce_buffer", id: item.expense_id });
                            setNewAmount(suggested.toFixed(2));
                            setUnderstandLate(false);
                          }}
                          className={"w-full rounded-xl border p-3 text-left text-sm " + (choice?.type === "reduce_buffer" && choice.id === item.expense_id ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white")}
                        >
                          <span className="block font-black text-slate-900">{item.name}</span>
                          <span className="mt-1 block text-xs text-slate-600">{money(amountOrZero(item.current_amount))} budgeted · Suggested reduction {money(amountOrZero(item.suggested_reduction))}</span>
                        </button>
                      ))}
                      {preview.buffer_options?.length === 0 && <p className="text-xs text-slate-500">No remaining buffer allocation is available to lower.</p>}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-slate-900">2. Move an eligible bill to the next paycheck</h3>
                    <p className="mt-1 text-xs text-slate-600">Only unpaid bills due close to the next payday are shown. The real due date stays unchanged, so moving one may cause a late fee, service interruption, or other consequences.</p>
                    <div className="mt-2 space-y-2">
                      {(preview.bills_near_next_paycheck || []).map((item) => (
                        <button
                          key={item.expense_id}
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setChoice({ type: "move_bill", id: item.expense_id });
                            setUnderstandLate(false);
                          }}
                          className={"w-full rounded-xl border p-3 text-left " + (choice?.type === "move_bill" && choice.id === item.expense_id ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white")}
                        >
                          <span className="flex items-center justify-between gap-3 text-sm font-black text-slate-900">
                            <span>{item.name}</span><span>{money(amountOrZero(item.amount))}</span>
                          </span>
                          <span className="mt-1 block text-xs text-rose-700">Due {dateLabel(item.due_date)} · Next check {dateLabel(item.next_paycheck)} ({overdueDays(item.due_date,item.next_paycheck)} days late)</span>
                        </button>
                      ))}
                      {preview.bills_near_next_paycheck?.length === 0 && <p className="text-xs text-slate-500">No eligible unpaid bills are close to the next payday.</p>}
                    </div>
                  </div>

                  {choice && (
                    <section className="rounded-2xl border border-blue-300 bg-blue-50 p-4">
                      <h3 className="text-sm font-black text-blue-950">Review your choice</h3>
                      {buffer && (
                        <label className="mt-3 block text-xs font-black text-slate-700">
                          New buffer amount for this paycheck
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min={amountOrZero(buffer.already_spent)}
                            max={amountOrZero(buffer.current_amount)}
                            value={newAmount}
                            onChange={(event) => setNewAmount(event.target.value)}
                            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900"
                          />
                          <span className="mt-1 block text-xs font-normal">Amount already spent cannot be reduced.</span>
                        </label>
                      )}
                      {bill && (
                        <label className="mt-3 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-950">
                          <input type="checkbox" checked={understandLate} onChange={(event) => setUnderstandLate(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>I understand that {bill.name} remains due {dateLabel(bill.due_date)} and funding it on {dateLabel(bill.next_paycheck)} could be late. I will check the consequences with the provider.</span>
                        </label>
                      )}
                      {difference > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-lg bg-white p-2">
                            <span className="block text-slate-500">This paycheck after change</span>
                            <strong className={(current + difference < 0 ? "text-rose-700" : "text-emerald-700") + " text-base"}>{money(current + difference)}</strong>
                          </div>
                          <div className="rounded-lg bg-white p-2">
                            <span className="block text-slate-500">Next paycheck after change</span>
                            <strong className={(next + (bill ? 0 : difference) < 0 ? "text-rose-700" : "text-emerald-700") + " text-base"}>{money(next + (bill ? 0 : difference))}</strong>
                          </div>
                        </div>
                      )}
                      {bill && (
                        <p className="mt-2 text-[11px] font-bold leading-4 text-amber-900">
                          The next paycheck will carry this extra bill, but its cumulative balance after both paychecks should not change solely from the move.
                        </p>
                      )}
                      <p className="mt-2 text-[11px] leading-4 text-slate-600">These are estimates. Saving will recalculate the entire actual plan and future forecast.</p>
                      <button
                        type="button"
                        disabled={!canApply}
                        onClick={() => {
                          if (choice?.type === "reduce_buffer" && validAmount) {
                            void onApply("reduce_buffer", choice.id, parsedAmount);
                          } else if (choice?.type === "move_bill" && bill && understandLate) {
                            void onApply("move_bill", choice.id);
                          }
                        }}
                        className="mt-3 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving ? "Recalculating…" : buffer ? "Confirm buffer change & recalculate" : "Confirm bill move & recalculate"}
                      </button>
                    </section>
                  )}
                </>
              )}

              {error && (
                <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-bold text-rose-800">{error}</p>
              )}
            </>
          )}
        </div>
        <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
          <button type="button" onClick={onClose} disabled={saving} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-800 disabled:opacity-50">
            {preview && amountOrZero(preview.shortfall) > 0 ? "Keep current plan for now" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
