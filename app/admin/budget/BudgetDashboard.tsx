"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Paycheck = {
  paycheck_date: string;
  projected_check: number | string | null;
  actual_check: number | string | null;
  period_status: string | null;
  planned_spending: number | string | null;
  actual_spending: number | string | null;
  reserve_change: number | string | null;
  running_cash_goal_pool: number | string | null;
  checking_before_paycheck: number | string | null;
  review_required: boolean | null;
  review_reason: string | null;
  review_triggered_at: string | null;
};

type Expense = {
  id: string;
  due_date: string | null;
  assigned_paycheck: string | null;
  category: string | null;
  line_item: string | null;
  expense_type: string | null;
  frequency: string | null;
  planned_amount: number | string | null;
  actual_amount: number | string | null;
  status: string | null;
  notes: string | null;
  event_fund: string | null;
};

type Person = {
  name: string;
  default_discretionary: number | string;
};

type FutureExpense = {
  id: string;
  event_fund: string | null;
  due_date: string | null;
  target_budget: number | string | null;
  planned_funding: number | string | null;
  actual_funding_spend: number | string | null;
  remaining_to_plan: number | string | null;
  remaining_actual: number | string | null;
  status: string | null;
  notes: string | null;
  funding_start_paycheck: string | null;
  funding_deadline: string | null;
  auto_fund: boolean | null;
  repeat_annually: boolean | null;
  funding_deadline_rule: string | null;
};

type BucketContribution = {
  future_expense_id: string | null;
  assigned_paycheck: string | null;
  planned_amount: number | string | null;
  status: string | null;
};

type RecurringBill = {
  id: string;
  category: string | null;
  item: string | null;
  amount: number | string | null;
  frequency: string | null;
  monthly_equivalent: number | string | null;
  due_timing: string | null;
  active: boolean | null;
  notes: string | null;
};

type ActualExpense = {
  id: string;
  spent_date: string;
  assigned_paycheck: string;
  category: string;
  description: string;
  amount: number | string;
  note: string | null;
  future_expense_id: string | null;
};

type IncomeEntry = {
  id: string;
  received_date: string;
  assigned_paycheck: string;
  source: string;
  amount: number | string;
  note: string | null;
  income_type: string | null;
};

type View = "home" | "plan" | "forecast" | "reviews" | "more";
type Editor =
  | { type: "expense"; item?: Expense; paycheckDate?: string }
  | { type: "recurring"; item?: RecurringBill }
  | { type: "actual"; item?: ActualExpense }
  | { type: "income"; item?: IncomeEntry }
  | { type: "paycheck" }
  | { type: "future" }
  | null;

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

const dateLabel = (value: string | null) => {
  if (!value) return "TBD";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const num = (value: number | string | null | undefined) => Number(value || 0);

const isFundingCompleteStatus = (value: string | null | undefined) =>
  ["funded", "received", "finalized", "completed", "closed", "paid", "settled"].includes(
    (value || "").trim().toLowerCase()
  );

const paycheckCountsAsFunded = (row: Paycheck) =>
  num(row.actual_check) > 0 || isFundingCompleteStatus(row.period_status);

const todayIso = () => {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
};

const addDays = (iso: string, days: number) => {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const addMonths = (iso: string, months: number) => {
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

const monthlyEquivalent = (amount: number, frequency: string) => {
  if (frequency === "Weekly") return (amount * 52) / 12;
  if (frequency === "Biweekly") return (amount * 26) / 12;
  if (frequency === "Annual") return amount / 12;
  return amount;
};

export default function BudgetDashboard() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [view, setView] = useState<View>("home");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [paycheck, setPaycheck] = useState<Paycheck | null>(null);
  const [paychecks, setPaychecks] = useState<Paycheck[]>([]);
  const [paycheckDates, setPaycheckDates] = useState<string[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [forecastDate, setForecastDate] = useState<string | null>(null);
  const [forecastExpenses, setForecastExpenses] = useState<Expense[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastTab, setForecastTab] = useState<"paychecks" | "sinking">("paychecks");
  const [expandedBucketId, setExpandedBucketId] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [futureExpenses, setFutureExpenses] = useState<FutureExpense[]>([]);
  const [bucketContributions, setBucketContributions] = useState<BucketContribution[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [actualExpenses, setActualExpenses] = useState<ActualExpense[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [futurePlanExpenses, setFuturePlanExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [chrisApproved, setChrisApproved] = useState(false);
  const [jenApproved, setJenApproved] = useState(false);

  async function loadData(showSpinner = false) {
    if (showSpinner) setLoading(true);
    setError("");

    if (window.location.hostname !== "admin.crestedcritters.com") {
      window.location.replace("https://admin.crestedcritters.com/budget");
      return;
    }

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      window.location.replace("/login");
      return;
    }

    const { data: adminProfile } = await supabase
      .from("admin_profiles")
      .select("id")
      .eq("id", authData.user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!adminProfile) {
      window.location.replace("/login");
      return;
    }

    const localToday = todayIso();

    const { data: allPaychecks, error: paychecksError } = await supabase
      .from("budget_paychecks")
      .select("paycheck_date,projected_check,actual_check,period_status,planned_spending,actual_spending,reserve_change,running_cash_goal_pool,checking_before_paycheck,review_required,review_reason,review_triggered_at")
      .order("paycheck_date", { ascending: true });

    if (paychecksError) {
      setError(paychecksError.message);
      setLoading(false);
      return;
    }

    const paychecks = (allPaychecks || []) as Paycheck[];
    const selected =
      paychecks.find((row) => row.paycheck_date >= localToday) ||
      paychecks[paychecks.length - 1] ||
      null;

    if (!selected) {
      setError("No paycheck periods were found.");
      setLoading(false);
      return;
    }

    const [
      expenseResult,
      peopleResult,
      futureResult,
      recurringResult,
      actualResult,
      categoryResult,
      bucketContributionResult,
      incomeResult,
      futurePlanResult,
    ] = await Promise.all([
        supabase
          .from("budget_expenses")
          .select("id,due_date,assigned_paycheck,category,line_item,expense_type,frequency,planned_amount,actual_amount,status,notes,event_fund")
          .eq("assigned_paycheck", selected.paycheck_date)
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("planned_amount", { ascending: false, nullsFirst: false }),
        supabase
          .from("budget_people")
          .select("name,default_discretionary")
          .eq("active", true)
          .order("name", { ascending: true }),
        supabase
          .from("budget_future_expenses")
          .select("id,event_fund,due_date,target_budget,planned_funding,actual_funding_spend,remaining_to_plan,remaining_actual,status,notes,funding_start_paycheck,funding_deadline,auto_fund,repeat_annually,funding_deadline_rule")
          .order("due_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("budget_recurring_bills")
          .select("id,category,item,amount,frequency,monthly_equivalent,due_timing,active,notes")
          .eq("active", true)
          .order("category", { ascending: true })
          .order("item", { ascending: true }),
        supabase
          .from("budget_actual_expenses")
          .select("id,spent_date,assigned_paycheck,category,description,amount,note,future_expense_id,created_at")
          .eq("assigned_paycheck", selected.paycheck_date)
          .order("spent_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("budget_categories")
          .select("name")
          .eq("active", true)
          .order("name", { ascending: true }),
        supabase
          .from("budget_expenses")
          .select("future_expense_id,assigned_paycheck,planned_amount,status")
          .not("future_expense_id", "is", null)
          .order("assigned_paycheck", { ascending: true }),
        supabase
          .from("budget_income_entries")
          .select("id,received_date,assigned_paycheck,source,amount,note,income_type")
          .eq("assigned_paycheck", selected.paycheck_date)
          .order("received_date", { ascending: false }),
        supabase
          .from("budget_expenses")
          .select("id,due_date,assigned_paycheck,category,line_item,expense_type,frequency,planned_amount,actual_amount,status,notes,event_fund")
          .gte("assigned_paycheck", selected.paycheck_date)
          .neq("status", "Cancelled")
          .order("assigned_paycheck", { ascending: true })
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("planned_amount", { ascending: false, nullsFirst: false }),
      ]);

    const firstError =
      expenseResult.error ||
      peopleResult.error ||
      futureResult.error ||
      recurringResult.error ||
      actualResult.error ||
      categoryResult.error ||
      bucketContributionResult.error ||
      incomeResult.error ||
      futurePlanResult.error;

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setPaycheck(selected);
    setPaychecks(paychecks);
    setPaycheckDates(paychecks.map((row) => row.paycheck_date));
    setExpenses((expenseResult.data || []) as Expense[]);
    setPeople((peopleResult.data || []) as Person[]);
    setFutureExpenses((futureResult.data || []) as FutureExpense[]);
    setBucketContributions((bucketContributionResult.data || []) as BucketContribution[]);
    setRecurringBills((recurringResult.data || []) as RecurringBill[]);
    setActualExpenses((actualResult.data || []) as ActualExpense[]);
    setIncomeEntries((incomeResult.data || []) as IncomeEntry[]);
    setFuturePlanExpenses((futurePlanResult.data || []) as Expense[]);
    setCategories(
      (categoryResult.data || [])
        .map((row: { name: string }) => row.name)
        .filter(Boolean)
    );
    setLoading(false);
  }

  useEffect(() => {
    void loadData(true);
  }, []);

  async function openForecastPaycheck(date: string) {
    setForecastDate(date);
    setForecastLoading(true);
    setError("");

    const { data, error: forecastError } = await supabase
      .from("budget_expenses")
      .select("id,due_date,assigned_paycheck,category,line_item,expense_type,frequency,planned_amount,actual_amount,status,notes,event_fund")
      .eq("assigned_paycheck", date)
      .neq("status", "Cancelled")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("planned_amount", { ascending: false, nullsFirst: false });

    if (forecastError) {
      setError(forecastError.message);
      setForecastExpenses([]);
    } else {
      setForecastExpenses((data || []) as Expense[]);
    }
    setForecastLoading(false);
  }

  async function saveFutureGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paycheck || editor?.type !== "future") return;

    setSaving(true);
    setNotice("");
    setError("");

    const data = new FormData(event.currentTarget);
    const eventFund = String(data.get("event_fund") || "").trim();
    const targetBudget = Number(data.get("target_budget") || 0);
    const dueDate = String(data.get("due_date") || "");
    const fundingDeadline = String(
      data.get("funding_deadline") || dueDate
    );
    const startPaycheck = String(
      data.get("funding_start_paycheck") || paycheck.paycheck_date
    );
    const notes = String(data.get("notes") || "").trim() || null;

    if (!eventFund || targetBudget <= 0 || !dueDate) {
      setError("Enter a goal name, target amount, and due date.");
      setSaving(false);
      return;
    }

    const fundingDates = paycheckDates.filter(
      (date) => date >= startPaycheck && date <= fundingDeadline
    );

    if (!fundingDates.length) {
      setError(
        "There are no paycheck dates between the selected start date and due date."
      );
      setSaving(false);
      return;
    }

    const totalCents = Math.round(targetBudget * 100);
    const baseCents = Math.floor(totalCents / fundingDates.length);
    const remainderCents = totalCents % fundingDates.length;
    const contributions = fundingDates.map((date, index) => ({
      date,
      amount: (baseCents + (index < remainderCents ? 1 : 0)) / 100,
    }));

    const { data: goal, error: goalError } = await supabase
      .from("budget_future_expenses")
      .insert({
        event_fund: eventFund,
        due_date: dueDate,
        target_budget: targetBudget,
        planned_funding: targetBudget,
        actual_funding_spend: 0,
        remaining_to_plan: 0,
        remaining_actual: targetBudget,
        status: "Funding",
        notes,
        funding_start_paycheck: startPaycheck,
        funding_deadline: fundingDeadline,
        auto_fund: true,
      })
      .select("id")
      .single();

    if (goalError || !goal) {
      setError(goalError?.message || "Could not create the future goal.");
      setSaving(false);
      return;
    }

    await supabase
      .from("budget_categories")
      .upsert({ name: "Sinking Fund", active: true }, { onConflict: "name" });

    const rows = contributions.map((contribution) => ({
      due_date: contribution.date,
      assigned_paycheck: contribution.date,
      category: "Sinking Fund",
      line_item: `${eventFund} sinking fund`,
      expense_type: "Sinking Fund",
      frequency: "Biweekly",
      planned_amount: contribution.amount,
      status: "Planned",
      notes: notes || `Auto-funded for ${eventFund}, due ${dueDate}.`,
      event_fund: eventFund,
      future_expense_id: goal.id,
    }));

    const { error: contributionError } = await supabase
      .from("budget_expenses")
      .insert(rows);

    if (contributionError) {
      await supabase.from("budget_future_expenses").delete().eq("id", goal.id);
      setError(
        `The goal could not be funded across paychecks: ${contributionError.message}`
      );
      setSaving(false);
      return;
    }

    setEditor(null);
    setView("forecast");
    setNotice(
      `${eventFund} added. ${money(targetBudget)} is now spread across ${fundingDates.length} paycheck${fundingDates.length === 1 ? "" : "s"}.`
    );
    await loadData();
    setSaving(false);
  }

  async function savePaycheckEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paycheck || editor?.type !== "paycheck") return;

    setSaving(true);
    setNotice("");
    setError("");

    const data = new FormData(event.currentTarget);
    const actualCheck = Number(data.get("actual_check") || 0);
    const checkingBalanceRaw = String(data.get("checking_balance") ?? "").trim();
    const checkingBalance = Number(checkingBalanceRaw);

    if (
      actualCheck <= 0 ||
      checkingBalanceRaw === "" ||
      !Number.isFinite(checkingBalance)
    ) {
      setError("Enter the paycheck amount and the current checking balance.");
      setSaving(false);
      return;
    }

    const { error: paycheckError } = await supabase
      .from("budget_paychecks")
      .update({
        actual_check: actualCheck,
        checking_before_paycheck: checkingBalance,
        period_status: "Received",
        review_required: true,
        review_reason: "Paycheck received and checking balance reconciled",
        review_triggered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("paycheck_date", paycheck.paycheck_date);

    if (paycheckError) {
      setError(paycheckError.message);
      setSaving(false);
      return;
    }

    const { error: recalcError } = await supabase.rpc(
      "recalculate_budget_paychecks"
    );

    if (recalcError) {
      setError(
        `Paycheck was saved, but the budget totals could not be refreshed: ${recalcError.message}`
      );
      setSaving(false);
      return;
    }

    setEditor(null);
    setView("reviews");
    setNotice(
      "Paycheck and current checking balance saved. Budget review refreshed from the real bank balance."
    );
    await loadData();
    setSaving(false);
  }

  async function saveIncomeEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paycheck || editor?.type !== "income") return;

    setSaving(true);
    setNotice("");
    setError("");

    const data = new FormData(event.currentTarget);
    const checkingBalanceRaw = String(data.get("checking_balance") ?? "").trim();
    const checkingBalance = Number(checkingBalanceRaw);
    const payload = {
      received_date: String(data.get("received_date") || todayIso()),
      assigned_paycheck: String(
        data.get("assigned_paycheck") || paycheck.paycheck_date
      ),
      source: String(data.get("source") || "").trim(),
      amount: Number(data.get("amount") || 0),
      note: String(data.get("note") || "").trim() || null,
      income_type: "Additional",
    };

    if (
      !payload.source ||
      payload.amount <= 0 ||
      checkingBalanceRaw === "" ||
      !Number.isFinite(checkingBalance)
    ) {
      setError(
        "Enter an income source, an amount greater than $0, and the current checking balance."
      );
      setSaving(false);
      return;
    }

    const result = editor.item
      ? await supabase
          .from("budget_income_entries")
          .update(payload)
          .eq("id", editor.item.id)
      : await supabase.from("budget_income_entries").insert(payload);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    const { error: balanceError } = await supabase
      .from("budget_paychecks")
      .update({
        checking_before_paycheck: checkingBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("paycheck_date", payload.assigned_paycheck);

    if (balanceError) {
      setError(
        `Income was saved, but the checking balance could not be reconciled: ${balanceError.message}`
      );
      setSaving(false);
      return;
    }

    setEditor(null);
    setView("reviews");
    setNotice(
      editor.item
        ? "Additional income and checking balance updated. Budget review refreshed."
        : "Additional income logged with the current checking balance. Budget review triggered."
    );
    await loadData();
    setSaving(false);
  }

  async function deleteIncomeEntry(item: IncomeEntry) {
    if (!window.confirm(`Delete ${item.source} income of ${money(num(item.amount))}?`)) {
      return;
    }

    setSaving(true);
    setError("");

    const { error: deleteError } = await supabase
      .from("budget_income_entries")
      .delete()
      .eq("id", item.id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setEditor(null);
      setView("reviews");
      setNotice("Additional income removed. Budget review refreshed.");
      await loadData();
    }
    setSaving(false);
  }

  async function markReviewComplete() {
    if (!paycheck) return;

    setSaving(true);
    setError("");

    const { error: reviewError } = await supabase
      .from("budget_paychecks")
      .update({
        review_required: false,
        review_reason: null,
        review_triggered_at: null,
      })
      .eq("paycheck_date", paycheck.paycheck_date);

    if (reviewError) {
      setError(reviewError.message);
    } else {
      setNotice("Budget review marked complete.");
      await loadData();
    }
    setSaving(false);
  }

  async function saveActualExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paycheck || editor?.type !== "actual") return;

    setNotice("");
    setError("");

    const data = new FormData(event.currentTarget);
    const category = String(data.get("category") || "Other").trim() || "Other";
    const futureExpenseId =
      String(data.get("future_expense_id") || "").trim() || null;

    const payload = {
      spent_date: String(data.get("spent_date") || todayIso()),
      assigned_paycheck: String(
        data.get("assigned_paycheck") || paycheck.paycheck_date
      ),
      category,
      description: String(data.get("description") || "").trim(),
      amount: Number(data.get("amount") || 0),
      note: String(data.get("note") || "").trim() || null,
      future_expense_id: futureExpenseId,
    };

    if (!payload.description || payload.amount <= 0) {
      setError("Enter what you paid for and an amount greater than $0.");
      return;
    }

    const warnings: string[] = [];

    const categoryBudget = categoryComparison.find(
      (row) => row.category === category
    );
    const plannedForCategory = categoryBudget?.planned || 0;
    const currentItemAmount =
      editor.item && editor.item.category === category
        ? num(editor.item.amount)
        : 0;
    const usedBefore =
      Math.max(0, categoryBudget?.actual || 0) - currentItemAmount;
    const categoryRemainingBefore = plannedForCategory - usedBefore;

    if (payload.amount > categoryRemainingBefore) {
      const afterTotal = usedBefore + payload.amount;
      const overBy = Math.max(0, afterTotal - plannedForCategory);
      warnings.push(
        plannedForCategory > 0
          ? `${category} will be ${money(overBy)} over its ${money(
              plannedForCategory
            )} budget for this pay period.`
          : `${category} has no planned budget for this pay period, so this expense will be over budget.`
      );
    }

    if (futureExpenseId) {
      const bucket = futureExpenses.find(
        (item) => item.id === futureExpenseId
      );

      if (bucket) {
        const fundedThrough = bucketFundedThrough(
          bucket.id,
          "9999-12-31"
        );
        const currentBucketAmount =
          editor.item?.future_expense_id === bucket.id
            ? num(editor.item.amount)
            : 0;
        const spentBefore =
          Math.max(0, num(bucket.actual_funding_spend)) -
          currentBucketAmount;
        const availableBefore = fundedThrough - spentBefore;

        if (payload.amount > availableBefore) {
          const negativeBy = payload.amount - availableBefore;
          warnings.push(
            `${bucket.event_fund || "This bucket"} will go ${money(
              negativeBy
            )} negative after this purchase.`
          );
        }
      }
    }

    if (
      warnings.length &&
      !window.confirm(
        `${warnings.join("\n\n")}\n\nProceed anyway?`
      )
    ) {
      return;
    }

    setSaving(true);

    const result = editor.item
      ? await supabase
          .from("budget_actual_expenses")
          .update(payload)
          .eq("id", editor.item.id)
      : await supabase.from("budget_actual_expenses").insert(payload);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setEditor(null);
    setNotice(editor.item ? "Spending entry updated." : "Spending logged.");
    await loadData();
    setSaving(false);
  }

  async function deleteActualExpense(item: ActualExpense) {
    if (!window.confirm(`Delete "${item.description}" for ${money(num(item.amount))}?`)) return;

    setSaving(true);
    setError("");

    const { error: deleteError } = await supabase
      .from("budget_actual_expenses")
      .delete()
      .eq("id", item.id);

    if (deleteError) setError(deleteError.message);
    else {
      setEditor(null);
      setNotice("Spending entry deleted.");
      await loadData();
    }
    setSaving(false);
  }

  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paycheck || editor?.type !== "expense") return;

    setSaving(true);
    setNotice("");
    setError("");

    const data = new FormData(event.currentTarget);
    const editorPaycheck = editor.paycheckDate || paycheck.paycheck_date;
    const payload = {
      line_item: String(data.get("line_item") || "").trim(),
      planned_amount: Number(data.get("planned_amount") || 0),
      due_date: String(data.get("due_date") || editorPaycheck),
      assigned_paycheck: String(
        data.get("assigned_paycheck") || editorPaycheck
      ),
      category: String(data.get("category") || "Other"),
      expense_type: String(data.get("expense_type") || "Required"),
      frequency: String(data.get("frequency") || "One-time"),
      status: String(data.get("status") || "Planned"),
      notes: String(data.get("notes") || "").trim() || null,
    };

    if (!payload.line_item || payload.planned_amount < 0) {
      setError("Enter an expense name and a valid amount.");
      setSaving(false);
      return;
    }

    await supabase
      .from("budget_categories")
      .upsert({ name: payload.category, active: true }, { onConflict: "name" });

    const result = editor.item
      ? await supabase
          .from("budget_expenses")
          .update(payload)
          .eq("id", editor.item.id)
      : await supabase.from("budget_expenses").insert(payload);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    const savedPaycheck = payload.assigned_paycheck;
    setEditor(null);
    setNotice(editor.item ? "Expense updated." : "Expense added.");
    await loadData();
    if (view === "forecast") {
      await openForecastPaycheck(savedPaycheck);
    }
    setSaving(false);
  }

  async function cancelExpense(expense: Expense) {
    if (!window.confirm(`Remove "${expense.line_item}" from the plan?`)) return;

    setSaving(true);
    setError("");

    const { error: updateError } = await supabase
      .from("budget_expenses")
      .update({ status: "Cancelled" })
      .eq("id", expense.id);

    if (updateError) setError(updateError.message);
    else {
      setEditor(null);
      setNotice("Expense removed from the plan.");
      await loadData();
    }
    setSaving(false);
  }

  function assignedPaycheckForDueDate(dueDate: string) {
    const prior = paycheckDates.filter((date) => date <= dueDate);
    return prior[prior.length - 1] || paycheckDates[0] || dueDate;
  }

  function buildRecurringDates(
    firstDueDate: string,
    frequency: string,
    horizon: string
  ) {
    const dates: string[] = [];
    let next = firstDueDate;
    let guard = 0;

    while (next <= horizon && guard < 200) {
      dates.push(next);
      if (frequency === "Weekly") next = addDays(next, 7);
      else if (frequency === "Biweekly") next = addDays(next, 14);
      else if (frequency === "Annual") next = addMonths(next, 12);
      else next = addMonths(next, 1);
      guard += 1;
    }
    return dates;
  }

  async function saveRecurring(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paycheck || editor?.type !== "recurring") return;

    setSaving(true);
    setNotice("");
    setError("");

    const data = new FormData(event.currentTarget);
    const amount = Number(data.get("amount") || 0);
    const item = String(data.get("item") || "").trim();
    const category = String(data.get("category") || "Other");
    const frequency = String(data.get("frequency") || "Monthly");
    const dueTiming = String(data.get("due_timing") || "").trim() || "TBD";
    const notes = String(data.get("notes") || "").trim() || null;
    const updateFuture = data.get("update_future") === "on";
    const createOccurrences = data.get("create_occurrences") === "on";
    const nextDueDate = String(data.get("next_due_date") || "");

    if (!item || amount < 0) {
      setError("Enter a recurring bill name and a valid amount.");
      setSaving(false);
      return;
    }

    const recurringPayload = {
      item,
      amount,
      category,
      frequency,
      monthly_equivalent: monthlyEquivalent(amount, frequency),
      due_timing: dueTiming,
      active: true,
      notes,
    };

    await supabase
      .from("budget_categories")
      .upsert({ name: category, active: true }, { onConflict: "name" });

    const oldName = editor.item?.item || item;

    const result = editor.item
      ? await supabase
          .from("budget_recurring_bills")
          .update(recurringPayload)
          .eq("id", editor.item.id)
      : await supabase.from("budget_recurring_bills").insert(recurringPayload);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    if (editor.item && updateFuture) {
      const { error: futureError } = await supabase
        .from("budget_expenses")
        .update({
          line_item: item,
          planned_amount: amount,
          category,
          frequency,
        })
        .eq("line_item", oldName)
        .eq("status", "Planned")
        .gte("assigned_paycheck", paycheck.paycheck_date);

      if (futureError) {
        setError(
          `Recurring bill saved, but future planned entries could not be updated: ${futureError.message}`
        );
        setSaving(false);
        return;
      }
    }

    if (!editor.item && createOccurrences && nextDueDate) {
      const lastPaycheck = paycheckDates[paycheckDates.length - 1];
      const horizon = lastPaycheck ? addDays(lastPaycheck, 14) : nextDueDate;
      const dueDates = buildRecurringDates(nextDueDate, frequency, horizon);

      if (dueDates.length) {
        const occurrenceRows = dueDates.map((dueDate) => ({
          due_date: dueDate,
          assigned_paycheck: assignedPaycheckForDueDate(dueDate),
          category,
          line_item: item,
          expense_type: "Required",
          frequency,
          planned_amount: amount,
          status: "Planned",
          notes: "Generated from recurring bill in Budget Lab.",
        }));

        const { error: occurrenceError } = await supabase
          .from("budget_expenses")
          .insert(occurrenceRows);

        if (occurrenceError) {
          setError(
            `Recurring bill saved, but its planned occurrences could not be generated: ${occurrenceError.message}`
          );
          setSaving(false);
          return;
        }
      }
    }

    setEditor(null);
    setNotice(editor.item ? "Recurring bill updated." : "Recurring bill added.");
    await loadData();
    setSaving(false);
  }

  const expectedPaycheck = num(paycheck?.projected_check);
  const basePaycheckIncome =
    num(paycheck?.actual_check) || expectedPaycheck;
  const additionalIncome = incomeEntries.reduce(
    (sum, item) => sum + num(item.amount),
    0
  );
  const income = basePaycheckIncome + additionalIncome;
  const extraAboveBaseline = Math.max(0, income - expectedPaycheck);
  const planned = num(paycheck?.planned_spending);
  const checkingBalance =
    paycheck?.checking_before_paycheck == null
      ? null
      : num(paycheck.checking_before_paycheck);
  const reconciliationAdjustment =
    checkingBalance == null ? 0 : checkingBalance - income;
  const availableExtra =
    checkingBalance == null ? income - planned : checkingBalance - planned;

  const categoryComparison = useMemo(() => {
    const map = new Map<
      string,
      { category: string; planned: number; actual: number }
    >();

    for (const expense of expenses) {
      if (expense.status === "Cancelled" || expense.status === "Deferred") continue;
      const category = expense.category || "Other";
      const row = map.get(category) || { category, planned: 0, actual: 0 };
      row.planned += num(expense.planned_amount);
      map.set(category, row);
    }

    for (const item of actualExpenses) {
      const category = item.category || "Other";
      const row = map.get(category) || { category, planned: 0, actual: 0 };
      row.actual += num(item.amount);
      map.set(category, row);
    }

    return Array.from(map.values()).sort((a, b) =>
      a.category.localeCompare(b.category)
    );
  }, [expenses, actualExpenses]);

  const fundedPaycheckDates = useMemo(
    () =>
      new Set(
        paychecks
          .filter(paycheckCountsAsFunded)
          .map((row) => row.paycheck_date)
      ),
    [paychecks]
  );

  const contributionCountsAsFunded = (row: BucketContribution) =>
    isFundingCompleteStatus(row.status) ||
    (!!row.assigned_paycheck && fundedPaycheckDates.has(row.assigned_paycheck));

  const bucketFundedThrough = (bucketId: string, throughPaycheck: string) =>
    bucketContributions
      .filter(
        (row) =>
          row.future_expense_id === bucketId &&
          !!row.assigned_paycheck &&
          row.assigned_paycheck <= throughPaycheck &&
          row.status !== "Cancelled" &&
          row.status !== "Deferred" &&
          contributionCountsAsFunded(row)
      )
      .reduce((sum, row) => sum + num(row.planned_amount), 0);

  const allocationSuggestions = useMemo(() => {
    if (!paycheck) return [];

    const suggestions: Array<{
      kind: "shortfall" | "debt" | "bucket" | "future";
      title: string;
      detail: string;
      amount: number;
    }> = [];

    let remaining = Math.max(0, availableExtra);
    if (remaining <= 0) return suggestions;

    const futureChecks = paychecks.filter(
      (row) => row.paycheck_date > paycheck.paycheck_date
    );

    for (const row of futureChecks) {
      if (remaining <= 0) break;
      const projected = num(row.projected_check);
      const futurePlanned = num(row.planned_spending);
      const shortfall = Math.max(0, futurePlanned - projected);
      if (shortfall <= 0) continue;

      const amount = Math.min(remaining, shortfall);
      suggestions.push({
        kind: "shortfall",
        title: `Protect the ${dateLabel(row.paycheck_date)} paycheck`,
        detail: `That paycheck is currently projected ${money(
          shortfall
        )} short. Holding this amount now keeps the future plan from going negative.`,
        amount,
      });
      remaining -= amount;
    }

    const futureDebt = futurePlanExpenses
      .filter((item) => {
        if (!item.assigned_paycheck || item.assigned_paycheck <= paycheck.paycheck_date) {
          return false;
        }
        if (item.status === "Cancelled" || item.status === "Deferred") {
          return false;
        }
        if (num(item.planned_amount) <= 0) return false;

        const category = (item.category || "").toLowerCase();
        const type = (item.expense_type || "").toLowerCase();
        const name = (item.line_item || "").toLowerCase();

        return (
          category.includes("debt") ||
          category.includes("collection") ||
          type.includes("catch-up") ||
          name.includes("loan") ||
          name.includes("collection")
        );
      })
      .sort((a, b) => {
        const dateCompare = (a.assigned_paycheck || "").localeCompare(
          b.assigned_paycheck || ""
        );
        if (dateCompare !== 0) return dateCompare;
        return num(b.planned_amount) - num(a.planned_amount);
      });

    for (const item of futureDebt.slice(0, 4)) {
      if (remaining <= 0) break;
      const plannedAmount = num(item.planned_amount);
      const amount = Math.min(remaining, plannedAmount);
      suggestions.push({
        kind: "debt",
        title: `Pay toward ${item.line_item || "future debt"} early`,
        detail: `Currently planned for ${dateLabel(
          item.assigned_paycheck
        )}. Paying some or all early would free that future paycheck.`,
        amount,
      });
      remaining -= amount;
    }

    const bucketsByDeadline = [...futureExpenses]
      .filter((item) => item.status !== "Completed")
      .sort((a, b) =>
        (a.funding_deadline || a.due_date || "9999-12-31").localeCompare(
          b.funding_deadline || b.due_date || "9999-12-31"
        )
      );

    for (const bucket of bucketsByDeadline) {
      if (remaining <= 0) break;

      const funded = bucketContributions
        .filter(
          (row) =>
            row.future_expense_id === bucket.id &&
            row.status !== "Cancelled" &&
            row.status !== "Deferred" &&
            contributionCountsAsFunded(row)
        )
        .reduce((sum, row) => sum + num(row.planned_amount), 0);

      const needed = Math.max(0, num(bucket.target_budget) - funded);
      if (needed <= 0) continue;

      const amount = Math.min(remaining, needed);
      suggestions.push({
        kind: "bucket",
        title: `Add more to ${bucket.event_fund || "sinking fund"}`,
        detail: `Currently accumulated ${money(funded)} of ${money(
          num(bucket.target_budget)
        )}. Extra funding now reduces what later paychecks need to contribute.`,
        amount,
      });
      remaining -= amount;
    }

    const futureRequired = futurePlanExpenses
      .filter((item) => {
        if (!item.assigned_paycheck || item.assigned_paycheck <= paycheck.paycheck_date) {
          return false;
        }
        if (item.status === "Cancelled" || item.status === "Deferred") {
          return false;
        }
        if (num(item.planned_amount) <= 0) return false;
        const type = (item.expense_type || "").toLowerCase();
        return !type.includes("sinking") && !type.includes("optional");
      })
      .sort((a, b) => {
        const dateCompare = (a.assigned_paycheck || "").localeCompare(
          b.assigned_paycheck || ""
        );
        if (dateCompare !== 0) return dateCompare;
        return num(b.planned_amount) - num(a.planned_amount);
      });

    for (const item of futureRequired.slice(0, 4)) {
      if (remaining <= 0) break;
      const amount = Math.min(remaining, num(item.planned_amount));
      suggestions.push({
        kind: "future",
        title: `Prepay or set aside for ${item.line_item || "future expense"}`,
        detail: `This is currently planned for ${dateLabel(
          item.assigned_paycheck
        )} at ${money(num(item.planned_amount))}.`,
        amount,
      });
      remaining -= amount;
    }

    return suggestions;
  }, [
    paycheck,
    availableExtra,
    paychecks,
    futurePlanExpenses,
    futureExpenses,
    bucketContributions,
    fundedPaycheckDates,
  ]);

  const discretionaryRows = expenses.filter((expense) =>
    (expense.line_item || "").toLowerCase().includes("discretionary spending")
  );
  const discretionaryTotal = discretionaryRows.reduce(
    (sum, expense) => sum + num(expense.planned_amount),
    0
  );
  const currentEach =
    people.length > 0
      ? people.reduce(
          (sum, person) => sum + num(person.default_discretionary),
          0
        ) / people.length
      : 200;

  const basePlanWithoutDiscretionary = planned - discretionaryTotal;
  const baseExtra = income - basePlanWithoutDiscretionary;
  const suggestedEach =
    availableExtra >= 0
      ? currentEach
      : Math.max(
          0,
          Math.min(currentEach, Math.floor(baseExtra / 2 / 25) * 25)
        );
  const suggestedExtra =
    income - basePlanWithoutDiscretionary - suggestedEach * 2;

  const reviewText = useMemo(() => {
    if (!paycheck) return "";
    if (availableExtra >= 250) {
      return `This paycheck leaves ${money(
        availableExtra
      )} after the current plan, including ${money(
        currentEach
      )} each for Chris and Jen. No discretionary cut is needed based on the current numbers.`;
    }
    if (availableExtra >= 0) {
      return `The plan fits, but only ${money(
        availableExtra
      )} remains. The current ${money(
        currentEach
      )} each is possible, but the review should consider whether some of that would be better held as cushion.`;
    }
    if (baseExtra < 0) {
      return `The current plan is ${money(
        Math.abs(availableExtra)
      )} short. Even reducing both discretionary allowances to $0 would still leave the core plan ${money(
        Math.abs(baseExtra)
      )} short, so another planned expense also needs to move, shrink, or be deferred.`;
    }
    return `The current plan is ${money(
      Math.abs(availableExtra)
    )} short with ${money(
      currentEach
    )} each in discretionary spending. A temporary allowance of about ${money(
      suggestedEach
    )} each would bring this paycheck back inside the available income.`;
  }, [availableExtra, baseExtra, currentEach, paycheck, suggestedEach]);

  const normalExpenses = expenses.filter(
    (expense) =>
      !(expense.line_item || "").toLowerCase().includes("discretionary spending")
  );

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-emerald-300" />
          <p className="mt-4 text-sm font-bold text-slate-300">
            Loading your budget…
          </p>
        </div>
      </main>
    );
  }

  if (error && !paycheck) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-400/20 bg-red-400/10 p-5">
          <p className="font-black text-red-200">Budget data could not load.</p>
          <p className="mt-2 text-sm text-red-100/80">{error}</p>
          <Link
            href="/admin"
            className="mt-4 inline-block rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-950"
          >
            Back to Admin
          </Link>
        </div>
      </main>
    );
  }

  if (!paycheck) return null;

  return (
    <main className="min-h-screen bg-slate-100 pb-28 text-slate-950">
      <div className="mx-auto max-w-xl">
        <header className="sticky top-0 z-30 bg-gradient-to-br from-slate-950 to-blue-950 px-4 pb-4 pt-5 text-white shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link
                href="/admin"
                className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300"
              >
                ← Crested Critters Admin
              </Link>
              <h1 className="mt-2 text-2xl font-black">Household Budget</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditor({ type: "income" })}
                className="rounded-xl bg-blue-300 px-3 py-2 text-sm font-black text-blue-950"
              >
                + Income
              </button>
              <button
                onClick={() => setEditor({ type: "actual" })}
                className="rounded-xl bg-emerald-300 px-3 py-2 text-sm font-black text-emerald-950"
              >
                + Spend
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-4 p-3 sm:p-4">
          {notice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
              {notice}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
              {error}
            </div>
          )}

          {view === "home" && (
            <>
              <section className="rounded-3xl bg-gradient-to-br from-slate-950 to-blue-900 p-5 text-white shadow-xl">
                <div>
                  <p className="text-xs text-slate-300">Next paycheck</p>
                  <h2 className="mt-1 text-xl font-black">
                    {dateLabel(paycheck.paycheck_date)}
                  </h2>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Total income" value={money(income)} />
                  <Stat label="Planned" value={money(planned)} />
                  <Stat
                    label="Checking balance"
                    value={
                      checkingBalance == null
                        ? "Not entered"
                        : money(checkingBalance)
                    }
                  />
                  <Stat
                    label="Available after plan"
                    value={money(availableExtra)}
                    highlight
                    danger={availableExtra < 0}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-slate-300">
                  <span>
                    Base {money(basePaycheckIncome)}
                    {additionalIncome > 0
                      ? ` + ${money(additionalIncome)} additional income`
                      : ""} · Includes {money(currentEach)} each for Chris + Jen
                    {checkingBalance == null
                      ? " · Checking not reconciled yet"
                      : ` · Reconciliation ${money(reconciliationAdjustment)}`}
                  </span>
                  <strong
                    className={
                      availableExtra < 0 ? "text-rose-300" : "text-emerald-300"
                    }
                  >
                    {availableExtra < 0 ? "Needs adjustment" : "On plan"}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={() => setEditor({ type: "paycheck" })}
                  className="mt-4 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-black text-white"
                >
                  {num(paycheck.actual_check) > 0
                    ? "Update paycheck & checking balance"
                    : "Enter paycheck & checking balance"}
                </button>
              </section>

              <section>
                <div className="mb-2 px-1">
                  <h2 className="text-lg font-black">Personal spending</h2>
                  <p className="text-xs text-slate-500">
                    Default allowance. Any change requires both approvals.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {people.map((person) => (
                    <PersonCard
                      key={person.name}
                      name={person.name}
                      amount={num(person.default_discretionary)}
                    />
                  ))}
                </div>
              </section>

              <button
                onClick={() => setView("reviews")}
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200"
              >
                <div>
                  <p className="font-black">Budget review</p>
                  <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">
                    {reviewText}
                  </p>
                </div>
                <span className="text-xl text-blue-600">›</span>
              </button>

              <section>
                <div className="mb-2 flex items-end justify-between px-1">
                  <div>
                    <h2 className="text-lg font-black">Recent spending</h2>
                    <p className="text-xs text-slate-500">
                      Actual purchases and payments logged this pay period.
                    </p>
                  </div>
                  <button
                    onClick={() => setEditor({ type: "actual" })}
                    className="text-sm font-black text-emerald-700"
                  >
                    + Spend
                  </button>
                </div>
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                  {actualExpenses.length ? (
                    actualExpenses.slice(0, 5).map((item) => (
                      <ActualExpenseRow
                        key={item.id}
                        item={item}
                        bucketName={
                          futureExpenses.find(
                            (bucket) => bucket.id === item.future_expense_id
                          )?.event_fund || undefined
                        }
                        onEdit={() => setEditor({ type: "actual", item })}
                      />
                    ))
                  ) : (
                    <p className="p-4 text-sm text-slate-500">
                      Nothing logged yet for this pay period.
                    </p>
                  )}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-end justify-between px-1">
                  <div>
                    <h2 className="text-lg font-black">Coming up</h2>
                    <p className="text-xs text-slate-500">
                      Expenses assigned to this paycheck.
                    </p>
                  </div>
                  <button
                    onClick={() => setView("plan")}
                    className="text-sm font-black text-blue-600"
                  >
                    See all
                  </button>
                </div>
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                  {normalExpenses.slice(0, 6).map((expense) => (
                    <ExpenseRow
                      key={expense.id}
                      expense={expense}
                      onEdit={() => setEditor({ type: "expense", item: expense })}
                    />
                  ))}
                </div>
              </section>
            </>
          )}

          {view === "plan" && (
            <>
              <div className="flex items-end justify-between gap-3">
                <SectionTitle
                  title="Plan"
                  subtitle={`Everything assigned to the ${dateLabel(
                    paycheck.paycheck_date
                  )} paycheck.`}
                />
                <button
                  onClick={() => setEditor({ type: "expense" })}
                  className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-sm font-black text-white"
                >
                  + Planned
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-900 p-3 text-white">
                <MiniStat label="Income" value={money(income)} />
                <MiniStat label="Planned" value={money(planned)} />
                <MiniStat label="Extra" value={money(availableExtra)} />
              </div>

              <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                {expenses.map((expense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    onEdit={() => setEditor({ type: "expense", item: expense })}
                  />
                ))}
              </div>
            </>
          )}

          {view === "reviews" && (
            <>
              <SectionTitle
                title="Paycheck Review"
                subtitle="Built from the live budget data."
              />

              <article className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <ReviewStat label="Normal check" value={money(expectedPaycheck)} />
                  <ReviewStat label="Actual/base check" value={money(basePaycheckIncome)} />
                  <ReviewStat label="Additional income" value={money(additionalIncome)} />
                  <ReviewStat label="Total income" value={money(income)} />
                  <ReviewStat
                    label="Checking balance"
                    value={
                      checkingBalance == null
                        ? "Not entered"
                        : money(checkingBalance)
                    }
                  />
                  <ReviewStat
                    label="Reconciliation"
                    value={
                      checkingBalance == null
                        ? "Pending"
                        : money(reconciliationAdjustment)
                    }
                  />
                  <ReviewStat label="Planned" value={money(planned)} />
                  <ReviewStat label="Available after plan" value={money(availableExtra)} />
                </div>

                <button
                  type="button"
                  onClick={() => setEditor({ type: "paycheck" })}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800"
                >
                  {num(paycheck.actual_check) > 0
                    ? "Update paycheck & current checking balance"
                    : "Enter paycheck & current checking balance"}
                </button>

                {paycheck.review_required && (
                  <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-blue-950">
                          Review triggered
                        </p>
                        <p className="mt-1 text-xs leading-5 text-blue-800">
                          {paycheck.review_reason || "Income changed for this pay period."}
                        </p>
                      </div>
                      <span className="rounded-full bg-blue-600 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                        New
                      </span>
                    </div>
                  </div>
                )}

                {additionalIncome > 0 && (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-emerald-950">
                          Additional income this period
                        </p>
                        <p className="mt-1 text-xs text-emerald-800">
                          {money(extraAboveBaseline)} above the normal projected paycheck.
                        </p>
                      </div>
                      <button
                        onClick={() => setEditor({ type: "income" })}
                        className="text-xs font-black text-emerald-800"
                      >
                        + Income
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {incomeEntries.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setEditor({ type: "income", item })}
                          className="flex w-full items-center justify-between gap-3 rounded-xl bg-white p-3 text-left ring-1 ring-emerald-100"
                        >
                          <span>
                            <strong className="block text-sm">{item.source}</strong>
                            <span className="text-[11px] text-slate-500">
                              {dateLabel(item.received_date)}
                              {item.note ? ` · ${item.note}` : ""}
                            </span>
                          </span>
                          <strong className="text-sm">{money(num(item.amount))}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {availableExtra > 0 && (
                  <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-violet-950">
                          What could the extra money do?
                        </p>
                        <p className="mt-1 text-xs leading-5 text-violet-800">
                          These are suggestions only. Nothing is moved until you change the plan.
                        </p>
                      </div>
                      <strong className="text-lg text-violet-950">
                        {money(availableExtra)}
                      </strong>
                    </div>

                    <div className="mt-3 space-y-2">
                      {allocationSuggestions.length ? (
                        allocationSuggestions.map((suggestion, index) => (
                          <div
                            key={`${suggestion.kind}-${index}-${suggestion.title}`}
                            className="rounded-xl bg-white p-3 ring-1 ring-violet-100"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-black text-slate-950">
                                  {suggestion.title}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                  {suggestion.detail}
                                </p>
                              </div>
                              <strong className="shrink-0 text-sm text-violet-700">
                                {money(suggestion.amount)}
                              </strong>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-xl bg-white p-3 text-sm text-slate-500">
                          No specific future obligation needs the surplus right now. Keeping it as cushion/reserve is reasonable.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-900 font-black text-white">
                    ✦
                  </div>
                  <div>
                    <p className="text-sm font-black">Review note</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {reviewText}
                    </p>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-200 pt-5">
                  <div className="mb-5">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-sm font-black">Budget vs actual</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Actual spending logged during this paycheck period.
                        </p>
                      </div>
                      <button
                        onClick={() => setEditor({ type: "actual" })}
                        className="text-xs font-black text-emerald-700"
                      >
                        + Spend
                      </button>
                    </div>
                    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
                        <span>Category</span>
                        <span>Plan</span>
                        <span>Spent</span>
                        <span>Left</span>
                      </div>
                      {categoryComparison.map((row) => (
                        <div
                          key={row.category}
                          className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-t border-slate-100 px-3 py-2.5 text-xs"
                        >
                          <span className="font-bold">{row.category}</span>
                          <span>{money(row.planned)}</span>
                          <span
                            className={
                              row.actual > row.planned && row.planned > 0
                                ? "font-black text-rose-600"
                                : "font-black text-slate-900"
                            }
                          >
                            {money(row.actual)}
                          </span>
                          <span
                            className={
                              row.planned - row.actual < 0
                                ? "font-black text-rose-600"
                                : "font-black text-emerald-700"
                            }
                          >
                            {row.planned - row.actual < 0
                              ? `-${money(Math.abs(row.planned - row.actual))}`
                              : money(row.planned - row.actual)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-slate-500">
                        Suggested allowance
                      </p>
                      <p className="mt-1 text-3xl font-black">
                        {money(suggestedEach)}
                        <span className="ml-1 text-xs font-bold text-slate-500">
                          each
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">
                        Extra after suggestion
                      </p>
                      <p
                        className={`text-xl font-black ${
                          suggestedExtra < 0
                            ? "text-rose-600"
                            : "text-slate-950"
                        }`}
                      >
                        {money(suggestedExtra)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                    A discretionary change is not applied until{" "}
                    <strong>both Chris and Jen</strong> approve the same amount.
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <ApprovalButton
                      name="Chris"
                      approved={chrisApproved}
                      onClick={() => setChrisApproved((value) => !value)}
                    />
                    <ApprovalButton
                      name="Jen"
                      approved={jenApproved}
                      onClick={() => setJenApproved((value) => !value)}
                    />
                  </div>

                  <button
                    disabled={
                      !chrisApproved ||
                      !jenApproved ||
                      suggestedEach === currentEach
                    }
                    className="mt-3 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300 disabled:text-slate-500"
                  >
                    {suggestedEach === currentEach
                      ? "No change recommended"
                      : chrisApproved && jenApproved
                        ? `Ready to apply ${money(suggestedEach)} each`
                        : "Waiting for both approvals"}
                  </button>

                  {paycheck.review_required && (
                    <button
                      onClick={() => void markReviewComplete()}
                      disabled={saving}
                      className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Mark budget review complete"}
                    </button>
                  )}
                </div>
              </article>
            </>
          )}

          {view === "forecast" && (
            <>
              <SectionTitle
                title="Forecast"
                subtitle="Look ahead by paycheck and keep planned money separate from money you actually have."
              />

              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-200 p-1">
                <button
                  type="button"
                  onClick={() => setForecastTab("paychecks")}
                  className={`rounded-xl px-3 py-2.5 text-sm font-black transition ${
                    forecastTab === "paychecks"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  Upcoming paychecks
                </button>
                <button
                  type="button"
                  onClick={() => setForecastTab("sinking")}
                  className={`rounded-xl px-3 py-2.5 text-sm font-black transition ${
                    forecastTab === "sinking"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  Sinking funds
                </button>
              </div>

              {forecastTab === "paychecks" ? (
                <section>
                  <div className="mb-2 px-1">
                    <h3 className="text-lg font-black">Upcoming paychecks</h3>
                    <p className="text-xs leading-5 text-slate-500">
                      Tap any paycheck to see exactly what is currently planned for it.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {paychecks
                      .filter((row) => row.paycheck_date >= paycheck.paycheck_date)
                      .map((row) => {
                        const forecastIncome =
                          num(row.actual_check) || num(row.projected_check);
                        const forecastPlanned = num(row.planned_spending);
                        const forecastAvailable =
                          forecastIncome - forecastPlanned;

                        return (
                          <button
                            key={row.paycheck_date}
                            onClick={() =>
                              void openForecastPaycheck(row.paycheck_date)
                            }
                            className="w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-black">
                                  {dateLabel(row.paycheck_date)}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-500">
                                  Income {money(forecastIncome)} · Planned{" "}
                                  {money(forecastPlanned)}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <strong
                                  className={
                                    forecastAvailable < 0
                                      ? "block text-sm text-rose-600"
                                      : "block text-sm text-emerald-700"
                                  }
                                >
                                  {money(forecastAvailable)}
                                </strong>
                                <span className="text-[10px] text-slate-500">
                                  available
                                </span>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                              <span>
                                Running pool{" "}
                                {money(num(row.running_cash_goal_pool))}
                              </span>
                              <strong className="text-blue-600">View plan ›</strong>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </section>
              ) : (
                <>
                  <div className="flex items-end justify-between gap-3 px-1">
                    <div>
                      <h3 className="text-lg font-black">Sinking funds</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Only money from a received/finalized paycheck counts as funded.
                        Future paycheck allocations stay planned until then.
                      </p>
                    </div>
                    <button
                      onClick={() => setEditor({ type: "future" })}
                      className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-sm font-black text-white"
                    >
                      + Future goal
                    </button>
                  </div>

                  <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                    {futureExpenses.filter((item) => item.status !== "Completed").length ? (
                      futureExpenses
                        .filter((item) => item.status !== "Completed")
                        .map((item) => {
                          const funded = bucketFundedThrough(
                            item.id,
                            "9999-12-31"
                          );
                          const totalPlanned = bucketContributions
                            .filter(
                              (row) =>
                                row.future_expense_id === item.id &&
                                row.status !== "Cancelled" &&
                                row.status !== "Deferred"
                            )
                            .reduce(
                              (sum, row) => sum + num(row.planned_amount),
                              0
                            );
                          const plannedFuture = Math.max(0, totalPlanned - funded);
                          const spent = num(item.actual_funding_spend);
                          const available = funded - spent;
                          const target = num(item.target_budget);
                          const progress =
                            target > 0
                              ? Math.max(
                                  0,
                                  Math.min(100, (funded / target) * 100)
                                )
                              : 0;
                          const expanded = expandedBucketId === item.id;

                          return (
                            <div
                              key={item.id}
                              className="border-b border-slate-100 last:border-0"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedBucketId((current) =>
                                    current === item.id ? null : item.id
                                  )
                                }
                                className="w-full px-4 py-4 text-left text-sm font-black"
                              >
                                {item.event_fund || "Future expense"}
                              </button>

                              {expanded && (
                                <div className="border-t border-slate-100 bg-slate-50 px-4 pb-4 pt-3">
                                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                                    <BudgetMeter label="Target" value={target} />
                                    <BudgetMeter label="Funded" value={funded} />
                                    <BudgetMeter
                                      label="Available"
                                      value={available}
                                      danger={available < 0}
                                    />
                                    <BudgetMeter label="Spent" value={spent} />
                                    <BudgetMeter
                                      label="Planned future"
                                      value={plannedFuture}
                                    />
                                  </div>

                                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                                    <div
                                      className="h-full rounded-full bg-blue-600"
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>

                                  <p className="mt-3 text-[11px] leading-5 text-slate-500">
                                    Due {dateLabel(item.due_date)} · Fund by{" "}
                                    {dateLabel(item.funding_deadline || item.due_date)}
                                  </p>

                                  {available < 0 && (
                                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">
                                      This fund is {money(Math.abs(available))} negative.
                                      Future planned contributions do not cover the current
                                      negative balance until that income is actually received.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                    ) : (
                      <p className="p-4 text-sm text-slate-500">
                        No future goals yet.
                      </p>
                    )}
                  </section>
                </>
              )}
            </>
          )}

          {view === "more" && (
            <>
              <SectionTitle
                title="More"
                subtitle="Recurring bills, goals, and future expenses."
              />

              <div className="grid grid-cols-2 gap-2">
                <CountCard
                  label="Active recurring bills"
                  value={String(recurringBills.length)}
                />
                <CountCard
                  label="Future funds"
                  value={String(futureExpenses.length)}
                />
              </div>

              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <h3 className="font-black">Next future expenses</h3>
                <div className="mt-3 space-y-3">
                  {futureExpenses.slice(0, 6).map((item) => (
                    <div
                      key={`${item.event_fund}-${item.due_date}`}
                      className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-black">{item.event_fund}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {dateLabel(item.due_date)} · {item.status || "Open"}
                        </p>
                      </div>
                      <strong className="text-sm">
                        {money(num(item.target_budget))}
                      </strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-black">Recurring bills</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Edit a bill once and optionally update its future planned entries.
                    </p>
                  </div>
                  <button
                    onClick={() => setEditor({ type: "recurring" })}
                    className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-sm font-black text-white"
                  >
                    + Recurring
                  </button>
                </div>

                <div className="mt-3 space-y-1">
                  {recurringBills.map((bill) => (
                    <RecurringRow
                      key={bill.id}
                      bill={bill}
                      onEdit={() => setEditor({ type: "recurring", item: bill })}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto grid max-w-xl grid-cols-5 border-t border-slate-200 bg-white/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        {[
          ["home", "⌂", "Home"],
          ["plan", "▤", "Plan"],
          ["forecast", "◫", "Forecast"],
          ["reviews", "✦", "Reviews"],
          ["more", "•••", "More"],
        ].map(([target, icon, label]) => (
          <button
            key={target}
            onClick={() => setView(target as View)}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-black ${
              view === target ? "text-blue-600" : "text-slate-500"
            }`}
          >
            <span className="text-xl">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {forecastDate && (
        <ForecastPaycheckModal
          paycheck={paychecks.find((row) => row.paycheck_date === forecastDate) || null}
          expenses={forecastExpenses}
          loading={forecastLoading}
          onClose={() => setForecastDate(null)}
          onAdd={() => {
            const date = forecastDate;
            setForecastDate(null);
            setEditor({ type: "expense", paycheckDate: date });
          }}
          onEdit={(item) => {
            const date = forecastDate;
            setForecastDate(null);
            setEditor({ type: "expense", item, paycheckDate: date });
          }}
        />
      )}

      {editor?.type === "future" && (
        <FutureGoalEditor
          currentPaycheck={paycheck.paycheck_date}
          paycheckDates={paycheckDates}
          saving={saving}
          onClose={() => setEditor(null)}
          onSave={saveFutureGoal}
        />
      )}

      {editor?.type === "paycheck" && (
        <PaycheckEditor
          paycheck={paycheck}
          saving={saving}
          onClose={() => setEditor(null)}
          onSave={savePaycheckEntry}
        />
      )}

      {editor?.type === "income" && (
        <IncomeEditor
          item={editor.item}
          currentPaycheck={paycheck.paycheck_date}
          paycheckDates={paycheckDates}
          currentCheckingBalance={checkingBalance}
          saving={saving}
          onClose={() => setEditor(null)}
          onSave={saveIncomeEntry}
          onDelete={
            editor.item ? () => deleteIncomeEntry(editor.item!) : undefined
          }
        />
      )}

      {editor?.type === "actual" && (
        <ActualExpenseEditor
          item={editor.item}
          currentPaycheck={paycheck.paycheck_date}
          paycheckDates={paycheckDates}
          categories={categories}
          comparisons={categoryComparison}
          futureExpenses={futureExpenses}
          bucketContributions={bucketContributions}
          paychecks={paychecks}
          saving={saving}
          onClose={() => setEditor(null)}
          onSave={saveActualExpense}
          onDelete={
            editor.item ? () => deleteActualExpense(editor.item!) : undefined
          }
        />
      )}

      {editor?.type === "expense" && (
        <ExpenseEditor
          item={editor.item}
          currentPaycheck={editor.paycheckDate || paycheck.paycheck_date}
          paycheckDates={paycheckDates}
          saving={saving}
          onClose={() => setEditor(null)}
          onSave={saveExpense}
          onCancelExpense={editor.item ? () => cancelExpense(editor.item!) : undefined}
        />
      )}

      {editor?.type === "recurring" && (
        <RecurringEditor
          item={editor.item}
          saving={saving}
          onClose={() => setEditor(null)}
          onSave={saveRecurring}
        />
      )}
    </main>
  );
}

function ForecastPaycheckModal({
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
  if (!paycheck) return null;

  const income = num(paycheck.actual_check) || num(paycheck.projected_check);
  const planned = num(paycheck.planned_spending);
  const available = income - planned;

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

        <div>
          <p className="mb-2 text-sm font-black">Current plan</p>
          {loading ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              Loading paycheck plan…
            </p>
          ) : expenses.length ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              {expenses.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  onEdit={() => onEdit(expense)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              Nothing is planned for this paycheck yet.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function FutureGoalEditor({
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

function PaycheckEditor({
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
    paycheck.checking_before_paycheck == null
      ? ""
      : String(paycheck.checking_before_paycheck);

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
            name="checking_balance"
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

function IncomeEditor({
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
            name="checking_balance"
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

function ActualExpenseEditor({
  item,
  currentPaycheck,
  paycheckDates,
  categories,
  comparisons,
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
  futureExpenses: FutureExpense[];
  bucketContributions: BucketContribution[];
  paychecks: Paycheck[];
  saving: boolean;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onDelete?: () => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState(
    item?.category || categories[0] || "Other"
  );
  const [enteredAmount, setEnteredAmount] = useState(num(item?.amount));
  const [selectedBucketId, setSelectedBucketId] = useState(
    item?.future_expense_id || ""
  );

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
        <Field label="Category">
          <select
            name="category"
            required
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="budget-input"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
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
            {futureExpenses
              .filter((bucket) => bucket.status !== "Completed")
              .map((bucket) => (
                <option key={bucket.id} value={bucket.id}>
                  {bucket.event_fund || "Future expense"}
                </option>
              ))}
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
            defaultValue={item?.description || ""}
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

function ExpenseEditor({
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

function RecurringEditor({
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

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl">
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-black text-slate-600">
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function BudgetMeter({
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

function Stat({
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

function PersonCard({ name, amount }: { name: string; amount: number }) {
  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-bold text-slate-500">{name}</p>
      <p className="mt-1 text-xl font-black">{money(amount)}</p>
      <p className="text-[10px] text-slate-400">this pay period</p>
    </article>
  );
}

function ExpenseRow({
  expense,
  onEdit,
}: {
  expense: Expense;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-3.5 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-black">
          {expense.line_item || "Unnamed expense"}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {dateLabel(expense.due_date)}
          {expense.category ? ` · ${expense.category}` : ""}
          {expense.status ? ` · ${expense.status}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <strong className="block text-sm">
          {money(num(expense.actual_amount) || num(expense.planned_amount))}
        </strong>
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

function ActualExpenseRow({
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

function RecurringRow({
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

function SectionTitle({
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-[10px] text-slate-400">{label}</span>
      <strong className="mt-1 block text-sm">{value}</strong>
    </div>
  );
}

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2.5">
      <span className="block text-[10px] text-slate-500">{label}</span>
      <strong className="mt-1 block text-sm">{value}</strong>
    </div>
  );
}

function ApprovalButton({
  name,
  approved,
  onClick,
}: {
  name: string;
  approved: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-3 text-left ${
        approved
          ? "border-emerald-300 bg-emerald-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <span className="block text-xs text-slate-500">{name}</span>
      <strong className={approved ? "text-emerald-700" : "text-slate-950"}>
        {approved ? "Approved ✓" : "Approve"}
      </strong>
    </button>
  );
}

function CountCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
