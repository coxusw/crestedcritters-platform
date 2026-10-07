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
  emptyText,
}: {
  title: string;
  subtitle: string;
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
  onSpend?: (expense: Expense) => void;
  groupBy?: (expense: Expense) => string;
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
          {Array.from(groups.entries()).map(([group, rows]) => (
            <div
              key={group}
              className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-3.5 py-2">
                <span className="min-w-0 truncate text-[11px] font-black uppercase tracking-wide text-slate-500">
                  {group}
                </span>
                <strong className="shrink-0 text-xs text-slate-600">
                  {money(
                    rows.reduce(
                      (sum, expense) => sum + num(expense.planned_amount),
                      0
                    )
                  )}
                </strong>
              </div>
              {rows.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  onEdit={() => onEdit(expense)}
                  onSpend={onSpend ? () => onSpend(expense) : undefined}
                />
              ))}
            </div>
          ))}
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
