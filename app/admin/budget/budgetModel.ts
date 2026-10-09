export type Paycheck = {
  paycheck_date: string;
  projected_check: number | string | null;
  actual_check: number | string | null;
  period_status: string | null;
  planned_spending: number | string | null;
  actual_spending: number | string | null;
  reserve_change: number | string | null;
  running_cash_goal_pool: number | string | null;
  reconciled_checking_balance: number | string | null;
  review_required: boolean | null;
  review_reason: string | null;
  review_triggered_at: string | null;
  rolling_generated: boolean | null;
};

export type Expense = {
  id: string;
  due_date: string | null;
  assigned_paycheck: string | null;
  category: string | null;
  line_item: string | null;
  expense_type: string | null;
  frequency: string | null;
  planned_amount: number | string | null;
  vault_prefund_offset: number | string | null;
  actual_amount: number | string | null;
  status: string | null;
  reconciliation_status: string | null;
  notes: string | null;
  event_fund: string | null;
  future_expense_id: string | null;
  generated_recurring_id: string | null;
  forecast_generated: boolean | null;
  forecast_debt_id: string | null;
  forecast_suppressed: boolean | null;
};

export type FutureExpense = {
  id: string;
  event_fund: string | null;
  due_date: string | null;
  target_budget: number | string | null;
  planned_funding: number | string | null;
  actual_funding_spend: number | string | null;
  pre_vault_spending: number | string | null;
  remaining_to_plan: number | string | null;
  remaining_actual: number | string | null;
  status: string | null;
  notes: string | null;
  funding_start_paycheck: string | null;
  funding_deadline: string | null;
  auto_fund: boolean | null;
  repeat_annually: boolean | null;
  funding_deadline_rule: string | null;
  closed_at: string | null;
  closeout_amount: number | string | null;
  closeout_destination: string | null;
  closeout_destination_fund_id: string | null;
  closeout_assigned_paycheck: string | null;
};

export type BucketContribution = {
  future_expense_id: string | null;
  assigned_paycheck: string | null;
  planned_amount: number | string | null;
  status: string | null;
};

export type RecurringBill = {
  id: string;
  category: string | null;
  item: string | null;
  amount: number | string | null;
  frequency: string | null;
  monthly_equivalent: number | string | null;
  due_timing: string | null;
  payment_grace_days: number | string | null;
  active: boolean | null;
  notes: string | null;
  linked_debt_id: string | null;
};

export type ActualExpense = {
  id: string;
  spent_date: string;
  assigned_paycheck: string;
  category: string;
  description: string;
  amount: number | string;
  note: string | null;
  future_expense_id: string | null;
  planned_expense_id: string | null;
  debt_id: string | null;
  overage_source: "buffer" | "carryover" | null;
  buffer_coverage_amount: number | string | null;
  overage_amount: number | string | null;
  paid_before_vault_funded: boolean;
};

export type VaultTransfer = {
  id: string;
  future_expense_id: string;
  assigned_paycheck: string;
  transferred_on: string;
  amount: number | string;
  note: string | null;
};

export type IncomeEntry = {
  id: string;
  received_date: string;
  assigned_paycheck: string;
  source: string;
  amount: number | string;
  note: string | null;
  income_type: string | null;
};

export type Debt = {
  id: string;
  name: string;
  creditor: string | null;
  debt_type: string;
  current_balance: number | string;
  original_balance: number | string | null;
  apr: number | string | null;
  minimum_payment: number | string | null;
  payment_frequency: string | null;
  due_timing: string | null;
  payment_grace_days: number | string | null;
  term_end_date: string | null;
  promo_end_date: string | null;
  settlement_offer_amount: number | string | null;
  settlement_offer_expires: string | null;
  settlement_notes: string | null;
  linked_budget_line_item: string | null;
  priority_override: string | null;
  notes: string | null;
  active: boolean;
  payoff_status: string | null;
  paid_off_at: string | null;
  priority_rank: number | string | null;
  balance_estimated: boolean | null;
};

export type View = "home" | "plan" | "forecast" | "reviews" | "more";
export type Editor =
  | { type: "expense"; item?: Expense; paycheckDate?: string }
  | { type: "recurring"; item?: RecurringBill }
  | { type: "actual"; item?: ActualExpense; plannedExpenseId?: string; futureExpenseId?: string }
  | { type: "income"; item?: IncomeEntry }
  | { type: "debt"; item?: Debt }
  | { type: "paycheck" }
  | { type: "future"; item?: FutureExpense }
  | { type: "close-fund"; item: FutureExpense }
  | { type: "vault-transfer"; fundId: string }
  | null;

export const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

export const dateLabel = (value: string | null) => {
  if (!value) return "TBD";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const coalesceFundDeadline = (item: FutureExpense) =>
  item.funding_deadline || item.due_date || "9999-12-31";

export const num = (value: number | string | null | undefined) => Number(value || 0);

export const isFundingCompleteStatus = (value: string | null | undefined) =>
  ["funded", "received", "finalized", "completed", "closed", "paid", "settled"].includes(
    (value || "").trim().toLowerCase()
  );

export const paycheckCountsAsFunded = (row: Paycheck) =>
  num(row.actual_check) > 0 || isFundingCompleteStatus(row.period_status);

export const todayIso = () => {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
};

export const addDays = (iso: string, days: number) => {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

export const addMonths = (iso: string, months: number) => {
  const [year, month, day] = iso.split("-").map(Number);
  const target = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0
  ).getDate();
  target.setDate(Math.min(day, lastDay));
  return [
    target.getFullYear(),
    String(target.getMonth() + 1).padStart(2, "0"),
    String(target.getDate()).padStart(2, "0"),
  ].join("-");
};

export const monthlyEquivalent = (amount: number, frequency: string) => {
  if (frequency === "Weekly") return (amount * 52) / 12;
  if (frequency === "Biweekly") return (amount * 26) / 12;
  if (frequency === "Annual") return amount / 12;
  return amount;
};

export const normalizeSpendingCategory = (value: string | null | undefined) =>
  (value || "").trim();

export const spendingCategoryForExpense = (expense: Expense) => {
  if (expense.status === "Cancelled" || expense.status === "Deferred") return "";

  const lineItem = (expense.line_item || "").trim();
  const expenseType = (expense.expense_type || "").trim().toLowerCase();
  const normalizedLineItem = lineItem.toLowerCase();

  if (
    !lineItem ||
    expense.future_expense_id ||
    expenseType.includes("sinking") ||
    expenseType.includes("forecast debt") ||
    normalizedLineItem.includes("sinking fund")
  ) {
    return "";
  }

  return normalizeSpendingCategory(lineItem);
};

export type PlanTab = "bills" | "sinking" | "spending" | "all";
export type PlanGroup = Exclude<PlanTab, "all">;

export const isClosedFundStatus = (value: string | null | undefined) =>
  ["closed", "completed", "cancelled", "removed"].includes(
    (value || "").trim().toLowerCase()
  );

export const expensePlanGroup = (expense: Expense): PlanGroup => {
  const line = (expense.line_item || "").trim().toLowerCase();
  const category = (expense.category || "").trim().toLowerCase();
  const type = (expense.expense_type || "").trim().toLowerCase();

  if (
    expense.future_expense_id ||
    type.includes("sinking") ||
    category === "sinking fund" ||
    line.includes("sinking fund")
  ) {
    return "sinking";
  }

  if (
    line.includes("forgotten / unplanned expense buffer") ||
    category === "fuel" ||
    category === "groceries" ||
    category === "food" ||
    line.includes("vehicle fuel") ||
    line.includes("grocer") ||
    line === "food"
  ) {
    return "spending";
  }

  return "bills";
};

// Compare the real obligation due date with the paycheck assigned to cover it.
// A planning grace period is not an extension of the actual due date.
export const paymentTimingDelayDays = (expense: Expense): number => {
  if (
    !expense.due_date ||
    !expense.assigned_paycheck ||
    expense.status === "Cancelled" ||
    expense.status === "Deferred" ||
    expense.forecast_suppressed ||
    expensePlanGroup(expense) !== "bills" ||
    num(expense.planned_amount) - num(expense.actual_amount) <= 0.005
  ) {
    return 0;
  }
  const parseUtcDay = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  const due = parseUtcDay(expense.due_date);
  const assigned = parseUtcDay(expense.assigned_paycheck);
  return Number.isFinite(assigned - due)
    ? Math.max(0, Math.round((assigned - due) / 86400000))
    : 0;
};

export const expenseDisplayName = (expense: Expense) =>
  expense.line_item || "Unnamed expense";
