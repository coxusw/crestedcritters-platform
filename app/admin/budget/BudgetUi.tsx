"use client";

import type { ReactNode } from "react";
import {
  ActualExpense,
  Expense,
  RecurringBill,
  dateLabel,
  expenseDisplayName,
  money,
  num,
  paymentTimingDelayDays,
} from "./budgetModel";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4">
      <div
        className="w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl bg-white px-4 pt-4 shadow-2xl sm:rounded-3xl"
        style={{
          maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - 0.5rem)",
          paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))",
          scrollPaddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">{title}</h2>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-xl font-black"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
      <style jsx global>{`
        .budget-input {
          width: 100%;
          border: 1px solid rgb(203 213 225);
          border-radius: 0.75rem;
          background: white;
          padding: 0.75rem;
          font-size: 16px;
          color: rgb(15 23 42);
          outline: none;
        }
        .budget-input:focus {
          border-color: rgb(37 99 235);
          box-shadow: 0 0 0 3px rgb(219 234 254);
        }
      `}</style>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs font-black text-slate-600">
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export function BudgetMeter({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div>
      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <strong
        className={`mt-1 block text-sm ${
          danger ? "text-rose-600" : "text-slate-950"
        }`}
      >
        {money(value)}
      </strong>
    </div>
  );
}

export function Stat({
  label,
  value,
  highlight,
  danger,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3 ${
        highlight
          ? "bg-blue-400/20 ring-1 ring-blue-300/20"
          : "bg-white/10"
      }`}
    >
      <span className="block text-[10px] text-slate-300">{label}</span>
      <strong
        className={`mt-1 block text-base sm:text-lg ${
          danger ? "text-rose-300" : ""
        }`}
      >
        {value}
      </strong>
    </div>
  );
}

export function PlanExpenseSection({
  title,
  subtitle,
  expenses,
  onEdit,
  onSpend,
  groupBy,
  groupSpentBy,
  groupTransferredBy,
  onGroupTransfer,
  emptyText,
}: {
  title: string;
  subtitle: string;
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
  onSpend?: (expense: Expense) => void;
  groupBy?: (expense: Expense) => string;
  groupSpentBy?: (group: string) => number;
  groupTransferredBy?: (group: string) => number;
  onGroupTransfer?: (group: string) => void;
  emptyText: string;
}) {
  const subtotal = expenses.reduce(
    (sum, expense) => sum + num(expense.planned_amount),
    0
  );
  const groups = new Map<string, Expense[]>();

  if (groupBy) {
    for (const expense of expenses) {
      const key = groupBy(expense) || "Other";
      groups.set(key, [...(groups.get(key) || []), expense]);
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h3 className="text-base font-black">{title}</h3>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
            {subtitle}
          </p>
        </div>
        <strong className="shrink-0 text-sm">{money(subtotal)}</strong>
      </div>

      {!expenses.length ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          {emptyText}
        </p>
      ) : groupBy ? (
        <div className="space-y-2">
          {Array.from(groups.entries()).map(([group, rows]) => {
            const groupPlanned = rows.reduce(
              (sum, expense) => sum + num(expense.planned_amount),
              0
            );
            const rowSpent = rows.reduce(
              (sum, expense) => sum + num(expense.actual_amount),
              0
            );
            const groupSpent = groupSpentBy ? groupSpentBy(group) : rowSpent;
            const groupTransferred = groupTransferredBy ? groupTransferredBy(group) : 0;
            const unassignedGroupSpend = Math.max(0, groupSpent - rowSpent);

            return (
              <div
                key={group}
                className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-3.5 py-2">
                  <span className="min-w-0 truncate text-[11px] font-black uppercase tracking-wide text-slate-500">
                    {group}
                  </span>
                  {groupTransferredBy ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-right">
                        <strong className="block text-xs text-slate-700">
                          {money(groupTransferred)} / {money(groupPlanned)}
                        </strong>
                        <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">
                          Moved to vault / Plan
                        </span>
                      </div>
                      {onGroupTransfer && groupTransferred < groupPlanned - 0.005 ? (
                        <button type="button" onClick={() => onGroupTransfer(group)} className="rounded-lg bg-emerald-600 px-2 py-2 text-[11px] font-black text-white">
                          Transfer
                        </button>
                      ) : null}
                    </div>
                  ) : groupSpentBy ? (
                    <div className="shrink-0 text-right">
                      <strong className="block text-xs text-slate-700">
                        {money(groupSpent)} / {money(groupPlanned)}
                      </strong>
                      <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">
                        Spent / Plan
                      </span>
                    </div>
                  ) : (
                    <strong className="shrink-0 text-xs text-slate-600">
                      {money(groupPlanned)}
                    </strong>
                  )}
                </div>
                {rows.map((expense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    onEdit={() => onEdit(expense)}
                    onSpend={onSpend ? () => onSpend(expense) : undefined}
                  />
                ))}
                {groupSpentBy && unassignedGroupSpend > 0.005 ? (
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-amber-50/60 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-slate-700">
                        Other spending from this fund
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        Not tied to a specific planned line
                      </p>
                    </div>
                    <strong className="shrink-0 text-xs text-amber-800">
                      {money(unassignedGroupSpend)}
                    </strong>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {expenses.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              onEdit={() => onEdit(expense)}
              onSpend={onSpend ? () => onSpend(expense) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function PaymentTimingAlerts({
  expenses,
  onEdit,
}: {
  expenses: Expense[];
  onEdit?: (expense: Expense) => void;
}) {
  const latePlanned = expenses
    .filter((expense) => paymentTimingDelayDays(expense) > 0)
    .sort((a, b) =>
      (a.due_date || "").localeCompare(b.due_date || "") ||
      (a.assigned_paycheck || "").localeCompare(b.assigned_paycheck || "")
    );

  if (latePlanned.length === 0) return null;

  const total = latePlanned.reduce(
    (sum, expense) =>
      sum + Math.max(0, num(expense.planned_amount) - num(expense.actual_amount)),
    0
  );

  return (
    <details className="group rounded-xl border border-slate-200 bg-white text-slate-700">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="text-sm text-amber-600">⚠</span>
          <span className="text-xs font-bold">
            {latePlanned.length} payment{latePlanned.length === 1 ? "" : "s"} scheduled after due date
          </span>
        </span>
        <span className="shrink-0 text-[11px] font-bold text-blue-600 group-open:hidden">Review ›</span>
        <span className="hidden shrink-0 text-[11px] font-bold text-blue-600 group-open:inline">Close ⌃</span>
      </summary>
      <div className="space-y-2 border-t border-slate-100 px-3 py-3">
        <p className="text-[11px] leading-4 text-slate-600">
          {money(total)} still planned for these bills. Check their actual due dates;
          a planning grace period does not waive late fees.
        </p>
        {latePlanned.map((expense) => {
          const days = paymentTimingDelayDays(expense);
          return (
            <div key={expense.id} className="flex items-start justify-between gap-3 rounded-xl bg-white p-2.5">
              <div className="min-w-0">
                <p className="text-xs font-black">{expenseDisplayName(expense)}</p>
                <p className="mt-1 text-[11px] leading-4 text-rose-700">
                  Due {dateLabel(expense.due_date)} · Planned from {dateLabel(expense.assigned_paycheck)} ({days} day{days === 1 ? "" : "s"} after due)
                </p>
              </div>
              <div className="shrink-0 text-right">
                <strong className="block text-xs">{money(Math.max(0, num(expense.planned_amount) - num(expense.actual_amount)))}</strong>
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(expense)}
                    className="mt-1 text-xs font-bold text-blue-700"
                  >
                    Review
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <p className="text-[11px] leading-4 text-slate-500">
          These are timing alerts, not confirmation of a fee or missed payment.
          Verify the actual dates with each biller before changing the plan.
        </p>
      </div>
    </details>
  );
}

export function ExpenseRow({
  expense,
  onEdit,
  onSpend,
}: {
  expense: Expense;
  onEdit: () => void;
  onSpend?: () => void;
}) {
  const planned = num(expense.planned_amount);
  const spent = num(expense.actual_amount);
  const reconciliationStatus =
    expense.status === "Cancelled"
      ? "Canceled"
      : expense.status === "Deferred"
        ? "Moved"
        : expense.reconciliation_status ||
          (spent <= 0
            ? "Unpaid"
            : spent + 0.005 < planned
              ? "Partial"
              : "Paid");
  const overPlan = spent > planned + 0.005;
  const plannedAfterDueDays = paymentTimingDelayDays(expense);

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-3.5 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-black">
          {expenseDisplayName(expense)}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {dateLabel(expense.due_date)}
          {expense.category ? ` · ${expense.category}` : ""}
          {` · ${reconciliationStatus}`}
        </p>
        <p className="mt-1 text-[11px] font-bold text-slate-500">
          Plan {money(planned)} ·{" "}
          <span className={overPlan ? "text-rose-600" : "text-emerald-700"}>
            Spent {money(spent)}
          </span>
        </p>
        {plannedAfterDueDays > 0 && (
          <p className="mt-1 text-[11px] font-black leading-4 text-rose-700">
            ⚠ Scheduled {dateLabel(expense.assigned_paycheck)} — {plannedAfterDueDays} day{plannedAfterDueDays === 1 ? "" : "s"} after due date
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <strong className={`block text-sm ${
          overPlan ? "text-rose-600" : "text-emerald-700"
        }`}>
          {money(spent)} / {money(planned)}
        </strong>
        <div className="mt-1 flex items-center justify-end gap-2">
          {onSpend && expense.status !== "Cancelled" && expense.status !== "Deferred" ? (
            <button
              type="button"
              onClick={onSpend}
              className="text-xs font-black text-emerald-700"
            >
              Spend
            </button>
          ) : null}
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-black text-blue-600"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

export function ActualExpenseRow({
  item,
  bucketName,
  onEdit,
}: {
  item: ActualExpense;
  bucketName?: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-3.5 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-black">{item.description}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {dateLabel(item.spent_date)} · {item.category}
          {bucketName ? ` · Bucket: ${bucketName}` : ""}
          {item.note ? ` · ${item.note}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <strong className="block text-sm">{money(num(item.amount))}</strong>
        <button
          onClick={onEdit}
          className="mt-1 text-xs font-black text-blue-600"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

export function RecurringRow({
  bill,
  onEdit,
}: {
  bill: RecurringBill;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-black">{bill.item}</p>
        <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
          {bill.category || "Other"} · {bill.frequency || "Recurring"} ·{" "}
          {bill.due_timing || "Timing TBD"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <strong className="block text-sm">{money(num(bill.amount))}</strong>
        <button
          onClick={onEdit}
          className="mt-1 text-xs font-black text-blue-600"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="px-1">
      <h2 className="text-xl font-black">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
    </div>
  );
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-[10px] text-slate-400">{label}</span>
      <strong className="mt-1 block text-sm">{value}</strong>
    </div>
  );
}

export function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2.5">
      <span className="block text-[10px] text-slate-500">{label}</span>
      <strong className="mt-1 block text-sm">{value}</strong>
    </div>
  );
}

export function CountCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
