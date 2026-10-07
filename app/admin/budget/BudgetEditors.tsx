"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ActualExpense, BucketContribution, Debt, Expense, FutureExpense, IncomeEntry, Paycheck, Person, PlanTab, RecurringBill, PERSONAL_SPENDING_CATEGORIES, coalesceFundDeadline, dateLabel, expenseDisplayName, expensePlanGroup, isClosedFundStatus, money, monthlyEquivalent, normalizeSpendingCategory, num, paycheckCountsAsFunded, spendingCategoryForExpense, todayIso
} from "./budgetModel";
import { BudgetMeter, Field, Modal, PlanExpenseSection } from "./BudgetUi";

export function ForecastPaycheckModal({
  paycheck,
  expenses,
  loading,
  onClose,
  onAdd,
  onEdit,
}: {
  paycheck: Paycheck | null;
  expenses: Expense[];
  loading: boolean;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (item: Expense) => void;
}) {
  const [tab, setTab] = useState<PlanTab>("all");

  if (!paycheck) return null;

  const income = num(paycheck.actual_check) || num(paycheck.projected_check);
  const planned = num(paycheck.planned_spending);
  const available = income - planned;
  const activeExpenses = expenses.filter(
    (expense) =>
      expense.status !== "Cancelled" &&
      expense.status !== "Deferred"
  );
  const bills = activeExpenses.filter(
    (expense) => expensePlanGroup(expense) === "bills"
  );
  const sinking = activeExpenses.filter(
    (expense) => expensePlanGroup(expense) === "sinking"
  );
  const spending = activeExpenses.filter(
    (expense) => expensePlanGroup(expense) === "spending"
  );

  return (
    <Modal
      title={`Paycheck · ${dateLabel(paycheck.paycheck_date)}`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-3">
          <BudgetMeter label="Income" value={income} />
          <BudgetMeter label="Planned" value={planned} />
          <BudgetMeter label="Available" value={available} danger={available < 0} />
        </div>

        <button
          onClick={onAdd}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white"
        >
          + Add planned expense to this paycheck
        </button>

        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-slate-200 p-1">
          {[
            ["bills", "Bills", bills.length],
            ["sinking", "Sinking", sinking.length],
            ["spending", "Spending", spending.length],
            ["all", "All", activeExpenses.length],
          ].map(([value, label, count]) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setTab(value as PlanTab)}
              className={`min-w-0 rounded-xl px-1.5 py-2.5 text-[11px] font-black transition sm:text-sm ${
                tab === value
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              <span className="block truncate">{label}</span>
              <span className="mt-0.5 block text-[9px] font-bold text-slate-400">
                {count}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Loading paycheck plan…
          </p>
        ) : !activeExpenses.length ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Nothing is planned for this paycheck yet.
          </p>
        ) : (
          <div className="space-y-4">
            {(tab === "bills" || tab === "all") && (
              <PlanExpenseSection
                title="Bills"
                subtitle="Required bills, debt payments, collections, subscriptions, utilities, insurance, and other obligations."
                expenses={bills}
                groupBy={(expense) => expense.category || "Other bills"}
                onEdit={onEdit}
                emptyText="No bills are assigned to this paycheck."
              />
            )}

            {(tab === "sinking" || tab === "all") && (
              <PlanExpenseSection
                title="Sinking funds"
                subtitle="Money being set aside for a specific future goal or event."
                expenses={sinking}
                groupBy={(expense) =>
                  expense.event_fund || "Other sinking fund"
                }
                onEdit={onEdit}
                emptyText="No sinking-fund contributions are assigned to this paycheck."
              />
            )}

            {(tab === "spending" || tab === "all") && (
              <PlanExpenseSection
                title="Spending"
                subtitle="Chris and Jennifer discretionary, forgotten/unplanned buffer, vehicle fuel, and food."
                expenses={spending}
                onEdit={onEdit}
                emptyText="No day-to-day spending is assigned to this paycheck."
              />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function SinkingFundCloseoutModal({
  item,
  available,
  nextFund,
  saving,
  onClose,
  onSave,
}: {
  item: FutureExpense;
  available: number;
  nextFund: FutureExpense | null;
  saving: boolean;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [destination, setDestination] = useState("");

  return (
    <Modal
      title={`Close out · ${item.event_fund || "Sinking fund"}`}
      onClose={onClose}
    >
      <form onSubmit={onSave} className="space-y-3">
        <div className="rounded-2xl bg-slate-100 p-4">
          <p className="text-xs font-bold text-slate-500">Actually available</p>
          <p className="mt-1 text-2xl font-black">{money(available)}</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            Only money from received/finalized paychecks counts here. Any future
            unfunded contributions to this sinking fund will be cancelled when
            you close it.
          </p>
        </div>

        {available > 0 ? (
          <Field label="Where should the leftover go?">
            <select
              name="destination"
              required
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              className="budget-input"
            >
              <option value="" disabled>
                Choose a destination
              </option>
              <option value="buffer">
                Forgotten / unplanned expense buffer
              </option>
              <option value="discretionary">
                Discretionary spending — split evenly between Chris and Jennifer
              </option>
              {nextFund && (
                <option value="next_fund">
                  Next sinking fund — {nextFund.event_fund || "Future expense"}
                </option>
              )}
            </select>
          </Field>
        ) : (
          <input type="hidden" name="destination" value="none" />
        )}

        {available > 0 && nextFund && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
            The closest open sinking-fund deadline is{" "}
            <strong>{nextFund.event_fund || "Future expense"}</strong>
            {" · "}
            {dateLabel(coalesceFundDeadline(nextFund))}. Moving money there
            immediately counts it as funded and reduces later planned
            contributions by the same amount.
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
          Closing the fund preserves its spending history. Afterward it will
          appear under <strong>Closed · awaiting removal</strong> so you can
          remove it from view once you are satisfied with the closeout.
        </div>

        <button
          type="submit"
          disabled={saving || (available > 0 && !destination)}
          className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          {saving
            ? "Closing…"
            : available > 0
              ? `Close fund & reassign ${money(available)}`
              : "Close fund"}
        </button>
      </form>
    </Modal>
  );
}

export function FutureGoalEditor({
  currentPaycheck,
  paycheckDates,
  saving,
  onClose,
  onSave,
}: {
  currentPaycheck: string;
  paycheckDates: string[];
  saving: boolean;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [target, setTarget] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState(currentPaycheck);
  const [fundingDeadline, setFundingDeadline] = useState(currentPaycheck);

  useEffect(() => {
    if (!dueDate) return;
    const latestEligible =
      paycheckDates.filter(
        (date) => date >= startDate && date <= dueDate
      ).slice(-1)[0] || startDate;

    if (
      !fundingDeadline ||
      fundingDeadline < startDate ||
      fundingDeadline > dueDate
    ) {
      setFundingDeadline(latestEligible);
    }
  }, [dueDate, startDate, paycheckDates, fundingDeadline]);

  const eligiblePaychecks = paycheckDates.filter(
    (date) =>
      date >= startDate &&
      date <= fundingDeadline &&
      (!dueDate || date <= dueDate)
  );
  const estimatedContribution =
    target > 0 && dueDate && eligiblePaychecks.length
      ? target / eligiblePaychecks.length
      : 0;

  return (
    <Modal title="Add future goal" onClose={onClose}>
      <form onSubmit={onSave} className="space-y-3">
        <Field label="What are you planning for?">
          <input
            name="event_fund"
            required
            className="budget-input"
            placeholder="Christmas, birthday, soccer trip…"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Target amount">
            <input
              name="target_budget"
              required
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={target || ""}
              onChange={(event) =>
                setTarget(Number(event.target.value || 0))
              }
              className="budget-input"
              placeholder="0.00"
            />
          </Field>
          <Field label="Need it by">
            <input
              name="due_date"
              required
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="budget-input"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Start saving from">
            <select
              name="funding_start_paycheck"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="budget-input"
            >
              {paycheckDates
                .filter((date) => date >= currentPaycheck)
                .map((date) => (
                  <option key={date} value={date}>
                    {dateLabel(date)}
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Fully funded by">
            <select
              name="funding_deadline"
              value={fundingDeadline}
              onChange={(event) => setFundingDeadline(event.target.value)}
              className="budget-input"
            >
              {paycheckDates
                .filter(
                  (date) =>
                    date >= startDate && (!dueDate || date <= dueDate)
                )
                .map((date) => (
                  <option key={date} value={date}>
                    {dateLabel(date)}
                  </option>
                ))}
            </select>
          </Field>
        </div>

        {target > 0 && dueDate && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
            {eligiblePaychecks.length ? (
              <>
                <p className="text-xs font-bold">Automatic bucket preview</p>
                <p className="mt-1 text-xl font-black">
                  About {money(estimatedContribution)} per paycheck
                </p>
                <p className="mt-1 text-xs leading-5 text-blue-800">
                  Spread across {eligiblePaychecks.length} paycheck
                  {eligiblePaychecks.length === 1 ? "" : "s"}, ending with the{" "}
                  {dateLabel(fundingDeadline)} paycheck. The final contribution
                  is adjusted by pennies if needed so the total matches the
                  target exactly.
                </p>
              </>
            ) : (
              <p className="text-sm font-bold text-rose-700">
                Choose a due date after the selected starting paycheck.
              </p>
            )}
          </div>
        )}

        <Field label="Note (optional)">
          <textarea
            name="notes"
            className="budget-input min-h-20"
            placeholder="Optional details"
          />
        </Field>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          For trips, use one all-inclusive sinking fund for the whole trip.
          Hotel, fuel, food, tolls, parking, and other purchases can all be
          logged against this same fund as they happen.
        </div>

        <button
          type="submit"
          disabled={saving || !eligiblePaychecks.length}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          {saving ? "Creating bucket…" : "Create sinking-fund plan"}
        </button>
      </form>
    </Modal>
  );
}

export function PaycheckEditor({
  paycheck,
  saving,
  onClose,
  onSave,
}: {
  paycheck: Paycheck;
  saving: boolean;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const existingBalance =
    paycheck.reconciled_checking_balance == null
      ? ""
      : String(paycheck.reconciled_checking_balance);

  return (
    <Modal
      title={num(paycheck.actual_check) > 0 ? "Update paycheck" : "Enter paycheck"}
      onClose={onClose}
    >
      <form onSubmit={onSave} className="space-y-3">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
          Enter the checking balance <strong>after the paycheck has posted</strong>.
          That real bank balance becomes the starting point for this budget review.
        </div>

        <Field label="Actual paycheck amount">
          <input
            name="actual_check"
            required
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            defaultValue={
              num(paycheck.actual_check) || num(paycheck.projected_check) || ""
            }
            className="budget-input"
            placeholder="0.00"
          />
        </Field>

        <Field label="Current checking balance">
          <input
            name="reconciled_checking_balance"
            required
            type="number"
            inputMode="decimal"
            step="0.01"
            defaultValue={existingBalance}
            className="budget-input"
            placeholder="0.00"
          />
        </Field>

        <p className="text-[11px] leading-5 text-slate-500">
          Pay period: {dateLabel(paycheck.paycheck_date)}. Enter exactly what the
          bank shows after the deposit. The balance may be positive or negative.
        </p>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save paycheck & reconcile"}
        </button>
      </form>
    </Modal>
  );
}

export function IncomeEditor({
  item,
  currentPaycheck,
  paycheckDates,
  currentCheckingBalance,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  item?: IncomeEntry;
  currentPaycheck: string;
  paycheckDates: string[];
  currentCheckingBalance: number | null;
  saving: boolean;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onDelete?: () => void;
}) {
  return (
    <Modal
      title={item ? "Edit additional income" : "Add additional income"}
      onClose={onClose}
    >
      <form onSubmit={onSave} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Amount">
            <input
              name="amount"
              required
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              defaultValue={num(item?.amount) || ""}
              className="budget-input"
              placeholder="0.00"
            />
          </Field>

          <Field label="Date received">
            <input
              name="received_date"
              required
              type="date"
              defaultValue={item?.received_date || todayIso()}
              className="budget-input"
            />
          </Field>
        </div>

        <Field label="Income source">
          <input
            name="source"
            required
            defaultValue={item?.source || ""}
            className="budget-input"
            placeholder="Bonus, reimbursement, side income…"
          />
        </Field>

        <Field label="Budget period">
          <select
            name="assigned_paycheck"
            defaultValue={item?.assigned_paycheck || currentPaycheck}
            className="budget-input"
          >
            {paycheckDates.map((date) => (
              <option key={date} value={date}>
                {dateLabel(date)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Current checking balance">
          <input
            name="reconciled_checking_balance"
            required
            type="number"
            inputMode="decimal"
            step="0.01"
            defaultValue={
              currentCheckingBalance == null ? "" : currentCheckingBalance
            }
            className="budget-input"
            placeholder="0.00"
          />
        </Field>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
          Enter the balance the bank shows <strong>after this income is already posted</strong>.
          The budget will use that real balance as the new reconciliation starting point.
        </div>

        <Field label="Note (optional)">
          <textarea
            name="note"
            defaultValue={item?.note || ""}
            className="budget-input min-h-20"
            placeholder="Optional details"
          />
        </Field>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
          Saving additional income immediately triggers a budget review for the
          selected pay period. The review starts from the checking balance you
          entered, then looks ahead for shortfalls, early-payment opportunities,
          debt, and sinking funds.
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : item ? "Save income" : "Add income & review"}
        </button>

        {item && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 disabled:opacity-50"
          >
            Delete income entry
          </button>
        )}
      </form>
    </Modal>
  );
}

export function ActualExpenseEditor({
  item,
  currentPaycheck,
  paycheckDates,
  categories,
  comparisons,
  planExpenses,
  initialPlannedExpenseId,
  futureExpenses,
  bucketContributions,
  paychecks,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  item?: ActualExpense;
  currentPaycheck: string;
  paycheckDates: string[];
  categories: string[];
  comparisons: Array<{ category: string; planned: number; actual: number }>;
  planExpenses: Expense[];
  initialPlannedExpenseId?: string;
  futureExpenses: FutureExpense[];
  bucketContributions: BucketContribution[];
  paychecks: Paycheck[];
  saving: boolean;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onDelete?: () => void;
}) {
  const [selectedPlannedExpenseId, setSelectedPlannedExpenseId] = useState(
    item?.planned_expense_id || initialPlannedExpenseId || ""
  );
  const selectedPlannedExpense = planExpenses.find(
    (expense) => expense.id === selectedPlannedExpenseId
  );
  const [selectedCategory, setSelectedCategory] = useState(
    item?.category ||
      (selectedPlannedExpense
        ? spendingCategoryForExpense(selectedPlannedExpense) ||
          selectedPlannedExpense.category ||
          ""
        : "")
  );
  const selectableCategories =
    item?.category && !categories.includes(item.category)
      ? [item.category, ...categories]
      : categories;
  const personalCategories = selectableCategories.filter((category) =>
    PERSONAL_SPENDING_CATEGORIES.includes(
      normalizeSpendingCategory(category) as (typeof PERSONAL_SPENDING_CATEGORIES)[number]
    )
  );
  const budgetCategories = selectableCategories.filter(
    (category) =>
      !PERSONAL_SPENDING_CATEGORIES.includes(
        normalizeSpendingCategory(category) as (typeof PERSONAL_SPENDING_CATEGORIES)[number]
      )
  );
  const [enteredAmount, setEnteredAmount] = useState(num(item?.amount));
  const [description, setDescription] = useState(
    item?.description || selectedPlannedExpense?.line_item || ""
  );
  const [selectedBucketId, setSelectedBucketId] = useState(
    item?.future_expense_id || selectedPlannedExpense?.future_expense_id || ""
  );

  const plannedLineActualBefore = selectedPlannedExpense
    ? Math.max(
        0,
        num(selectedPlannedExpense.actual_amount) -
          (item?.planned_expense_id === selectedPlannedExpense.id
            ? num(item.amount)
            : 0)
      )
    : 0;
  const plannedLineRemainingBefore = selectedPlannedExpense
    ? num(selectedPlannedExpense.planned_amount) - plannedLineActualBefore
    : 0;
  const plannedLineAfter =
    plannedLineActualBefore + enteredAmount;
  const plannedLineOver =
    !!selectedPlannedExpense &&
    plannedLineAfter > num(selectedPlannedExpense.planned_amount) + 0.005;

  const summary = comparisons.find(
    (row) => row.category === selectedCategory
  );
  const plannedForCategory = summary?.planned || 0;
  const currentItemAmount =
    item && item.category === selectedCategory ? num(item.amount) : 0;
  const alreadyUsed = Math.max(0, summary?.actual || 0) - currentItemAmount;
  const remainingBefore = plannedForCategory - alreadyUsed;
  const remainingAfter = remainingBefore - enteredAmount;
  const overAfter = remainingAfter < 0;

  const openBuckets = futureExpenses.filter(
    (bucket) => !isClosedFundStatus(bucket.status)
  );

  const currentCycleAmount = (bucketId: string) =>
    bucketContributions
      .filter(
        (row) =>
          row.future_expense_id === bucketId &&
          row.assigned_paycheck === currentPaycheck &&
          row.status !== "Cancelled" &&
          row.status !== "Deferred"
      )
      .reduce((sum, row) => sum + num(row.planned_amount), 0);

  const nextPlannedPaycheck = (bucket: FutureExpense) => {
    const contributionDates = bucketContributions
      .filter(
        (row) =>
          row.future_expense_id === bucket.id &&
          !!row.assigned_paycheck &&
          row.assigned_paycheck > currentPaycheck &&
          row.status !== "Cancelled" &&
          row.status !== "Deferred"
      )
      .map((row) => row.assigned_paycheck as string)
      .sort();

    return (
      contributionDates[0] ||
      (bucket.funding_start_paycheck &&
      bucket.funding_start_paycheck > currentPaycheck
        ? bucket.funding_start_paycheck
        : null) ||
      bucket.due_date ||
      null
    );
  };

  const currentCycleBuckets = openBuckets
    .filter((bucket) => currentCycleAmount(bucket.id) > 0)
    .sort((a, b) => {
      const amountDiff = currentCycleAmount(b.id) - currentCycleAmount(a.id);
      if (amountDiff !== 0) return amountDiff;
      return (a.due_date || "9999-12-31").localeCompare(
        b.due_date || "9999-12-31"
      );
    });

  const upcomingBuckets = openBuckets
    .filter((bucket) => currentCycleAmount(bucket.id) <= 0)
    .sort((a, b) => {
      const dateCompare = (nextPlannedPaycheck(a) || "9999-12-31").localeCompare(
        nextPlannedPaycheck(b) || "9999-12-31"
      );
      if (dateCompare !== 0) return dateCompare;
      return (a.event_fund || "").localeCompare(b.event_fund || "");
    });

  const selectedBucket = futureExpenses.find(
    (bucket) => bucket.id === selectedBucketId
  );
  const fundedPaycheckDates = new Set(
    paychecks
      .filter(paycheckCountsAsFunded)
      .map((row) => row.paycheck_date)
  );
  const bucketFunded = selectedBucket
    ? bucketContributions
        .filter(
          (row) =>
            row.future_expense_id === selectedBucket.id &&
            row.status !== "Cancelled" &&
            row.status !== "Deferred" &&
            (isFundingCompleteStatus(row.status) ||
              (!!row.assigned_paycheck &&
                fundedPaycheckDates.has(row.assigned_paycheck)))
        )
        .reduce((sum, row) => sum + num(row.planned_amount), 0)
    : 0;
  const currentBucketItemAmount =
    item?.future_expense_id === selectedBucketId ? num(item?.amount) : 0;
  const bucketSpentBefore = selectedBucket
    ? Math.max(0, num(selectedBucket.actual_funding_spend)) -
      currentBucketItemAmount
    : 0;
  const bucketAvailableBefore = bucketFunded - bucketSpentBefore;
  const bucketAvailableAfter = bucketAvailableBefore - enteredAmount;
  const bucketOverAfter =
    !!selectedBucket && enteredAmount > 0 && bucketAvailableAfter < 0;

  return (
    <Modal title={item ? "Edit spending" : "Log spending"} onClose={onClose}>
      <form onSubmit={onSave} className="space-y-3">
        <Field label="Apply to planned bill / item (optional)">
          <select
            name="planned_expense_id"
            value={selectedPlannedExpenseId}
            onChange={(event) => {
              const nextId = event.target.value;
              setSelectedPlannedExpenseId(nextId);
              const planned = planExpenses.find(
                (expense) => expense.id === nextId
              );
              if (planned) {
                setSelectedCategory(
                  spendingCategoryForExpense(planned) ||
                    planned.category ||
                    "Other"
                );
                setSelectedBucketId(planned.future_expense_id || "");
                setDescription(planned.line_item || "");
              }
            }}
            className="budget-input"
          >
            <option value="">Not tied to a planned line</option>
            {planExpenses
              .filter(
                (expense) =>
                  expense.status !== "Cancelled" &&
                  expense.status !== "Deferred" &&
                  (expense.expense_type || "").toLowerCase() !== "sinking fund"
              )
              .map((expense) => (
                <option key={expense.id} value={expense.id}>
                  {expenseDisplayName(expense)} —{" "}
                  {money(num(expense.planned_amount))}
                </option>
              ))}
          </select>
        </Field>

        {selectedPlannedExpense && (
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <BudgetMeter
              label="Plan"
              value={num(selectedPlannedExpense.planned_amount)}
            />
            <BudgetMeter
              label="Spent"
              value={plannedLineActualBefore}
              danger={
                plannedLineActualBefore >
                num(selectedPlannedExpense.planned_amount)
              }
            />
            <BudgetMeter
              label="Remaining"
              value={plannedLineRemainingBefore}
              danger={plannedLineRemainingBefore < 0}
            />
          </div>
        )}

        <Field label="Budget item / spending type">
          <select
            name="category"
            required
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="budget-input"
          >
            {!selectedCategory && (
              <option value="" disabled>
                Choose where this spending belongs
              </option>
            )}
            {personalCategories.length > 0 && (
              <optgroup label="Personal / discretionary">
                {personalCategories.map((category) => (
                  <option key={category} value={normalizeSpendingCategory(category)}>
                    {normalizeSpendingCategory(category)}
                  </option>
                ))}
              </optgroup>
            )}
            {budgetCategories.length > 0 && (
              <optgroup label="Current budget">
                {budgetCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Field>

        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-3">
          <BudgetMeter label="Planned" value={plannedForCategory} />
          <BudgetMeter label="Already used" value={alreadyUsed} />
          <BudgetMeter
            label="Remaining"
            value={remainingBefore}
            danger={remainingBefore < 0}
          />
        </div>

        <Field label="Use sinking fund / bucket (optional)">
          <select
            name="future_expense_id"
            value={selectedBucketId}
            onChange={(event) => setSelectedBucketId(event.target.value)}
            className="budget-input"
          >
            <option value="">No bucket</option>
            {currentCycleBuckets.length > 0 && (
              <optgroup label="This pay cycle / current plan">
                {currentCycleBuckets.map((bucket) => (
                  <option key={bucket.id} value={bucket.id}>
                    {bucket.event_fund || "Future expense"} —{" "}
                    {money(currentCycleAmount(bucket.id))} this check
                  </option>
                ))}
              </optgroup>
            )}
            {upcomingBuckets.length > 0 && (
              <optgroup label="Upcoming / lower priority this cycle">
                {upcomingBuckets.map((bucket) => {
                  const nextDate = nextPlannedPaycheck(bucket);
                  return (
                    <option key={bucket.id} value={bucket.id}>
                      {bucket.event_fund || "Future expense"}
                      {nextDate ? ` — next ${dateLabel(nextDate)}` : ""}
                    </option>
                  );
                })}
              </optgroup>
            )}
          </select>
        </Field>

        {selectedBucket && (
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-3">
            <BudgetMeter label="Accumulated" value={bucketFunded} />
            <BudgetMeter label="Spent" value={bucketSpentBefore} />
            <BudgetMeter
              label="Available"
              value={bucketAvailableBefore}
              danger={bucketAvailableBefore < 0}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Field label="Amount">
            <input
              name="amount"
              required
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={enteredAmount || ""}
              onChange={(event) =>
                setEnteredAmount(Number(event.target.value || 0))
              }
              className="budget-input"
              placeholder="0.00"
            />
          </Field>
          <Field label="Date paid">
            <input
              name="spent_date"
              required
              type="date"
              defaultValue={item?.spent_date || todayIso()}
              className="budget-input"
            />
          </Field>
        </div>

        <Field label="What did you pay for?">
          <input
            name="description"
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="budget-input"
            placeholder="Gas, groceries, mortgage…"
          />
        </Field>

        <input
          type="hidden"
          name="assigned_paycheck"
          value={item?.assigned_paycheck || currentPaycheck}
        />

        {enteredAmount > 0 && (
          <div
            className={`rounded-xl border p-3 text-sm ${
              overAfter
                ? "border-amber-300 bg-amber-50 text-amber-950"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            <strong>
              Category after this expense:{" "}
              {overAfter
                ? `${money(Math.abs(remainingAfter))} over budget`
                : `${money(remainingAfter)} remaining`}
            </strong>
            {overAfter && (
              <span className="mt-1 block text-xs leading-5">
                You can still save it. You will be asked to confirm because it
                exceeds the category budget for this pay period.
              </span>
            )}
          </div>
        )}

        {selectedPlannedExpense && enteredAmount > 0 && (
          <div
            className={`rounded-xl border p-3 text-sm ${
              plannedLineOver
                ? "border-rose-300 bg-rose-50 text-rose-950"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            <strong>
              {expenseDisplayName(selectedPlannedExpense)} after this payment:{" "}
              {money(plannedLineAfter)} of{" "}
              {money(num(selectedPlannedExpense.planned_amount))} spent
            </strong>
            {plannedLineOver && (
              <span className="mt-1 block text-xs leading-5">
                This planned item will be{" "}
                {money(
                  plannedLineAfter -
                    num(selectedPlannedExpense.planned_amount)
                )}{" "}
                over plan.
              </span>
            )}
          </div>
        )}

        {selectedBucket && enteredAmount > 0 && (
          <div
            className={`rounded-xl border p-3 text-sm ${
              bucketOverAfter
                ? "border-amber-300 bg-amber-50 text-amber-950"
                : "border-blue-200 bg-blue-50 text-blue-950"
            }`}
          >
            <strong>
              {selectedBucket.event_fund || "Bucket"} after this expense:{" "}
              {bucketOverAfter
                ? `${money(Math.abs(bucketAvailableAfter))} negative`
                : `${money(bucketAvailableAfter)} available`}
            </strong>
            {bucketOverAfter && (
              <span className="mt-1 block text-xs leading-5">
                The bucket can go negative, but you will be asked to confirm
                before the expense is saved.
              </span>
            )}
          </div>
        )}

        <p className="text-[11px] text-slate-500">
          Pay period: {dateLabel(item?.assigned_paycheck || currentPaycheck)}
        </p>

        <Field label="Note (optional)">
          <textarea
            name="note"
            defaultValue={item?.note || ""}
            className="budget-input min-h-20"
            placeholder="Optional details"
          />
        </Field>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : item ? "Save spending" : "Log spending"}
        </button>

        {item && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 disabled:opacity-50"
          >
            Delete spending entry
          </button>
        )}
      </form>
    </Modal>
  );
}

export function ExpenseEditor({
  item,
  currentPaycheck,
  paycheckDates,
  saving,
  onClose,
  onSave,
  onCancelExpense,
}: {
  item?: Expense;
  currentPaycheck: string;
  paycheckDates: string[];
  saving: boolean;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onCancelExpense?: () => void;
}) {
  return (
    <Modal title={item ? "Edit planned expense" : "Add expense"} onClose={onClose}>
      <form onSubmit={onSave} className="space-y-3">
        <Field label="Expense name">
          <input
            name="line_item"
            required
            defaultValue={item?.line_item || ""}
            className="budget-input"
            placeholder="Expense name"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Amount">
            <input
              name="planned_amount"
              required
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              defaultValue={num(item?.planned_amount) || ""}
              className="budget-input"
            />
          </Field>
          <Field label="Due date">
            <input
              name="due_date"
              required
              type="date"
              defaultValue={item?.due_date || currentPaycheck}
              className="budget-input"
            />
          </Field>
        </div>

        <Field label="Paycheck paying it">
          <select
            name="assigned_paycheck"
            defaultValue={item?.assigned_paycheck || currentPaycheck}
            className="budget-input"
          >
            {paycheckDates.map((date) => (
              <option key={date} value={date}>
                {dateLabel(date)}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Category">
            <input
              name="category"
              defaultValue={item?.category || ""}
              className="budget-input"
              placeholder="Utilities, Vehicle…"
            />
          </Field>
          <Field label="Type">
            <select
              name="expense_type"
              defaultValue={item?.expense_type || "Required"}
              className="budget-input"
            >
              <option>Required</option>
              <option>Living</option>
              <option>Catch-up</option>
              <option>Reserve</option>
              <option>Sinking Fund</option>
              <option>Optional</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Frequency">
            <select
              name="frequency"
              defaultValue={item?.frequency || "One-time"}
              className="budget-input"
            >
              <option>One-time</option>
              <option>Monthly</option>
              <option>Biweekly</option>
              <option>Weekly</option>
              <option>Annual</option>
            </select>
          </Field>
          <Field label="Status">
            <select
              name="status"
              defaultValue={item?.status || "Planned"}
              className="budget-input"
            >
              <option>Planned</option>
              <option>Paid</option>
              <option>Deferred</option>
              <option>Cancelled</option>
            </select>
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            name="notes"
            defaultValue={item?.notes || ""}
            className="budget-input min-h-20"
            placeholder="Optional"
          />
        </Field>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : item ? "Save expense" : "Add to budget"}
        </button>

        {item && onCancelExpense && item.status !== "Cancelled" && (
          <button
            type="button"
            onClick={onCancelExpense}
            disabled={saving}
            className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 disabled:opacity-50"
          >
            Remove from plan
          </button>
        )}
      </form>
    </Modal>
  );
}

export function RecurringEditor({
  item,
  saving,
  onClose,
  onSave,
}: {
  item?: RecurringBill;
  saving: boolean;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal title={item ? "Edit recurring bill" : "Add recurring bill"} onClose={onClose}>
      <form onSubmit={onSave} className="space-y-3">
        <Field label="Bill name">
          <input
            name="item"
            required
            defaultValue={item?.item || ""}
            className="budget-input"
            placeholder="Mortgage, internet, gym…"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Amount">
            <input
              name="amount"
              required
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              defaultValue={num(item?.amount) || ""}
              className="budget-input"
            />
          </Field>
          <Field label="Category">
            <input
              name="category"
              defaultValue={item?.category || ""}
              className="budget-input"
              placeholder="Utilities"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Frequency">
            <select
              name="frequency"
              defaultValue={item?.frequency || "Monthly"}
              className="budget-input"
            >
              <option>Monthly</option>
              <option>Variable Monthly</option>
              <option>Biweekly</option>
              <option>Weekly</option>
              <option>Annual</option>
            </select>
          </Field>
          <Field label="Due / timing">
            <input
              name="due_timing"
              defaultValue={item?.due_timing || ""}
              className="budget-input"
              placeholder="8th of each month"
            />
          </Field>
        </div>

        <Field label="Planning grace (days)">
          <input
            name="payment_grace_days"
            type="number"
            inputMode="numeric"
            min="0"
            max="31"
            step="1"
            defaultValue={num(item?.payment_grace_days)}
            className="budget-input"
          />
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            Allows the forecast to use a paycheck this many days after the due date
            when that keeps a pay period from being overloaded. This is a planning
            rule only; it does not change the creditor&apos;s actual late-fee terms.
          </p>
        </Field>

        {!item && (
          <Field label="Next due date">
            <input
              name="next_due_date"
              type="date"
              required
              className="budget-input"
            />
          </Field>
        )}

        <Field label="Notes">
          <textarea
            name="notes"
            defaultValue={item?.notes || ""}
            className="budget-input min-h-20"
            placeholder="Optional"
          />
        </Field>

        {item ? (
          <label className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
            <input
              type="checkbox"
              name="update_future"
              defaultChecked
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <strong>Update current and future planned entries</strong>
              <span className="mt-1 block text-xs leading-5 text-blue-800">
                Use this when a bill changes permanently, such as lowering Xfinity.
              </span>
            </span>
          </label>
        ) : (
          <label className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
            <input
              type="checkbox"
              name="create_occurrences"
              defaultChecked
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <strong>Add it to future paycheck plans</strong>
              <span className="mt-1 block text-xs leading-5 text-blue-800">
                Creates the upcoming occurrences through the current budget forecast.
              </span>
            </span>
          </label>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          {saving
            ? "Saving…"
            : item
              ? "Save recurring bill"
              : "Add recurring bill"}
        </button>
      </form>
    </Modal>
  );
}

export function DebtEditor({
  item,
  budgetItems,
  saving,
  onClose,
  onSave,
  onArchive,
  onConfirmPaid,
}: {
  item?: Debt;
  budgetItems: Array<{
    value: string;
    label: string;
    group: string;
  }>;
  saving: boolean;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onArchive?: () => void;
  onConfirmPaid?: () => void;
}) {
  const [debtType, setDebtType] = useState(item?.debt_type || "Other");
  const [apr, setApr] = useState(
    item?.apr == null ? "" : String(item.apr)
  );
  const isCollection =
    debtType.toLowerCase().includes("collection");

  return (
    <Modal title={item ? "Edit debt" : "Add debt"} onClose={onClose}>
      <form onSubmit={onSave} className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          Add the facts you know. Leave APR blank when it is unknown; enter{" "}
          <strong>0</strong> only when the debt truly has no interest. The
          paycheck review uses these details to decide which balances deserve
          extra money first.
        </div>

        <Field label="Debt name">
          <input
            name="name"
            required
            defaultValue={item?.name || ""}
            className="budget-input"
            placeholder="Capital One, XbotGo, Discover collection…"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Creditor / collector">
            <input
              name="creditor"
              defaultValue={item?.creditor || ""}
              className="budget-input"
              placeholder="Optional"
            />
          </Field>
          <Field label="Debt type">
            <select
              name="debt_type"
              value={debtType}
              onChange={(event) => setDebtType(event.target.value)}
              className="budget-input"
            >
              {[
                "Credit card",
                "Installment / BNPL",
                "Collection",
                "Student loan",
                "Auto loan",
                "Mortgage",
                "Personal loan",
                "Medical",
                "Other",
              ].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Current balance owed">
            <input
              name="current_balance"
              required
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              defaultValue={num(item?.current_balance) || ""}
              className="budget-input"
              placeholder="0.00"
            />
          </Field>
          <Field label="Original balance (optional)">
            <input
              name="original_balance"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              defaultValue={
                item?.original_balance == null
                  ? ""
                  : num(item.original_balance)
              }
              className="budget-input"
              placeholder="0.00"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="APR / interest rate">
            <input
              name="apr"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={apr}
              onChange={(event) => setApr(event.target.value)}
              className="budget-input"
              placeholder="Blank = unknown"
            />
          </Field>
          <Field label="Minimum / required payment">
            <input
              name="minimum_payment"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              defaultValue={
                item?.minimum_payment == null
                  ? ""
                  : num(item.minimum_payment)
              }
              className="budget-input"
              placeholder="0.00"
            />
          </Field>
        </div>

        {apr.trim() !== "" && Number(apr) === 0 ? (
          <p className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
            Recorded as 0% interest. Unless there is a deadline or settlement
            opportunity, the review will usually keep this behind debt that is
            actively charging interest.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Field label="Payment frequency">
            <select
              name="payment_frequency"
              defaultValue={item?.payment_frequency || ""}
              className="budget-input"
            >
              <option value="">Not specified</option>
              <option value="Weekly">Weekly</option>
              <option value="Biweekly">Every 2 weeks</option>
              <option value="Monthly">Monthly</option>
              <option value="One-time">No repeating minimum</option>
            </select>
          </Field>
          <Field label="Due timing / terms">
            <input
              name="due_timing"
              defaultValue={item?.due_timing || ""}
              className="budget-input"
              placeholder="15th, every paycheck, arrangement…"
            />
          </Field>
        </div>

        <Field label="Planning grace (days)">
          <input
            name="payment_grace_days"
            type="number"
            inputMode="numeric"
            min="0"
            max="31"
            step="1"
            defaultValue={num(item?.payment_grace_days)}
            className="budget-input"
          />
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            The forecast may use a paycheck this many days after the due date.
            This is only a budget-planning window and does not change the
            lender&apos;s actual late-fee or delinquency rules.
          </p>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Payoff / term end date">
            <input
              name="term_end_date"
              type="date"
              defaultValue={item?.term_end_date || ""}
              className="budget-input"
            />
          </Field>
          <Field label="Promo / 0% ends">
            <input
              name="promo_end_date"
              type="date"
              defaultValue={item?.promo_end_date || ""}
              className="budget-input"
            />
          </Field>
        </div>

        <Field label="Linked recurring / planned payment (optional)">
          <select
            name="linked_budget_line_item"
            defaultValue={item?.linked_budget_line_item || ""}
            className="budget-input"
          >
            <option value="">Not linked</option>
            {Array.from(new Set(budgetItems.map((option) => option.group))).map(
              (group) => (
                <optgroup key={group} label={group}>
                  {budgetItems
                    .filter((option) => option.group === group)
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </optgroup>
              )
            )}
          </select>
          <p className="mt-1.5 text-[11px] leading-5 text-slate-500">
            This only links the debt to an existing recurring or planned payment.
            It does not add another expense to the paycheck.
          </p>
        </Field>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-black text-amber-950">
            Settlement offer {isCollection ? "(common for collections)" : "(optional)"}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label="Offer amount">
              <input
                name="settlement_offer_amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                defaultValue={
                  item?.settlement_offer_amount == null
                    ? ""
                    : num(item.settlement_offer_amount)
                }
                className="budget-input"
                placeholder="0.00"
              />
            </Field>
            <Field label="Offer expires">
              <input
                name="settlement_offer_expires"
                type="date"
                defaultValue={item?.settlement_offer_expires || ""}
                className="budget-input"
              />
            </Field>
          </div>
          <div className="mt-2">
            <Field label="Settlement details">
              <textarea
                name="settlement_notes"
                defaultValue={item?.settlement_notes || ""}
                className="budget-input min-h-20"
                placeholder="Offer terms, paid-in-full wording, phone quote, etc."
              />
            </Field>
          </div>
        </div>

        <Field label="Notes">
          <textarea
            name="notes"
            defaultValue={item?.notes || ""}
            className="budget-input min-h-24"
            placeholder="Anything else the review should know"
          />
        </Field>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : item ? "Save debt" : "Add debt"}
        </button>

        {item &&
          item.payoff_status === "Paid off - awaiting confirmation" &&
          onConfirmPaid ? (
            <button
              type="button"
              onClick={onConfirmPaid}
              disabled={saving}
              className="w-full rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-3 text-sm font-black text-emerald-900 disabled:opacity-50"
            >
              Confirm paid off & remove
            </button>
          ) : item && onArchive ? (
            <button
              type="button"
              onClick={onArchive}
              disabled={saving}
              className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 disabled:opacity-50"
            >
              Mark paid off
            </button>
          ) : null}
      </form>
    </Modal>
  );
}
