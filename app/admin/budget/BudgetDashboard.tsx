"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  ActualExpense,
  BucketContribution,
  Debt,
  Editor,
  Expense,
  FutureExpense,
  IncomeEntry,
  Paycheck,
  PlanTab,
  RecurringBill,
  View,
  addDays,
  addMonths,
  coalesceFundDeadline,
  dateLabel,
  expenseDisplayName,
  expensePlanGroup,
  isClosedFundStatus,
  isFundingCompleteStatus,
  money,
  monthlyEquivalent,
  normalizeSpendingCategory,
  num,
  paycheckCountsAsFunded,
  spendingCategoryForExpense,
  todayIso,
} from "./budgetModel";
import {
  ActualExpenseEditor,
  DebtEditor,
  ExpenseEditor,
  ForecastPaycheckModal,
  FutureGoalEditor,
  IncomeEditor,
  PaycheckEditor,
  RecurringEditor,
  SinkingFundCloseoutModal,
} from "./BudgetEditors";
import DeficitReviewModal, { type DeficitPreview } from "./DeficitReviewModal";
import {
  ActualExpenseRow,
  BudgetMeter,
  ExpenseRow,
  CountCard,
  MiniStat,
  PaymentTimingAlerts,
  PlanExpenseSection,
  RecurringRow,
  ReviewStat,
  SectionTitle,
  Stat,
} from "./BudgetUi";


export default function BudgetDashboard() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [view, setView] = useState<View>("home");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deficitDate, setDeficitDate] = useState<string | null>(null);
  const [deficitPreview, setDeficitPreview] = useState<DeficitPreview | null>(null);
  const [deficitLoading, setDeficitLoading] = useState(false);
  const [deficitSaving, setDeficitSaving] = useState(false);
  const [deficitError, setDeficitError] = useState("");
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
  const [planTab, setPlanTab] = useState<PlanTab>("all");
  const [moreTab, setMoreTab] = useState<"debts" | "recurring" | "future">("debts");
  const [expandedBucketId, setExpandedBucketId] = useState<string | null>(null);
  const [futureExpenses, setFutureExpenses] = useState<FutureExpense[]>([]);
  const [bucketContributions, setBucketContributions] = useState<BucketContribution[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [actualExpenses, setActualExpenses] = useState<ActualExpense[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [futurePlanExpenses, setFuturePlanExpenses] = useState<Expense[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [draggedDebtId, setDraggedDebtId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

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

    // Keep at least one full year of paycheck cycles visible. The database job
    // runs daily so each passed biweekly cycle automatically extends the plan
    // another two weeks, maintaining the one-year look-ahead.
    const { error: horizonError } = await supabase.rpc("refresh_budget_rolling_horizon", {
      p_reference_date: localToday,
    });

    if (horizonError) {
      setError(horizonError.message);
      setLoading(false);
      return;
    }

    const { error: autoFundError } = await supabase.rpc(
      "refresh_budget_auto_fund_plans",
      { p_reference_date: localToday }
    );

    if (autoFundError) {
      setError(autoFundError.message);
      setLoading(false);
      return;
    }

    const { error: allocationError } = await supabase.rpc(
      "refresh_budget_forecast_surplus_allocations",
      { p_reference_date: localToday }
    );

    if (allocationError) {
      setError(allocationError.message);
      setLoading(false);
      return;
    }

    const { data: allPaychecks, error: paychecksError } = await supabase
      .from("budget_paychecks")
      .select("paycheck_date,projected_check,actual_check,period_status,planned_spending,actual_spending,reserve_change,running_cash_goal_pool,reconciled_checking_balance,review_required,review_reason,review_triggered_at,rolling_generated")
      .order("paycheck_date", { ascending: true });

    if (paychecksError) {
      setError(paychecksError.message);
      setLoading(false);
      return;
    }

    const paychecks = (allPaychecks || []) as Paycheck[];
    const selected =
      paychecks.find(
        (row) => row.paycheck_date >= localToday && row.rolling_generated
      ) ||
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
      futureResult,
      recurringResult,
      actualResult,
      bucketContributionResult,
      incomeResult,
      futurePlanResult,
      debtResult,
    ] = await Promise.all([
      supabase
        .from("budget_expenses")
        .select("id,due_date,assigned_paycheck,category,line_item,expense_type,frequency,planned_amount,actual_amount,status,reconciliation_status,notes,event_fund,future_expense_id,generated_recurring_id,forecast_generated,forecast_debt_id,forecast_suppressed")
        .eq("assigned_paycheck", selected.paycheck_date)
        .eq("forecast_suppressed", false)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("planned_amount", { ascending: false, nullsFirst: false }),
      supabase
        .from("budget_future_expenses")
        .select("id,event_fund,due_date,target_budget,planned_funding,actual_funding_spend,remaining_to_plan,remaining_actual,status,notes,funding_start_paycheck,funding_deadline,auto_fund,repeat_annually,funding_deadline_rule,closed_at,closeout_amount,closeout_destination,closeout_destination_fund_id,closeout_assigned_paycheck")
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("budget_recurring_bills")
        .select("id,category,item,amount,frequency,monthly_equivalent,due_timing,payment_grace_days,active,notes,linked_debt_id")
        .eq("active", true)
        .order("category", { ascending: true })
        .order("item", { ascending: true }),
      supabase
        .from("budget_actual_expenses")
        .select("id,spent_date,assigned_paycheck,category,description,amount,note,future_expense_id,planned_expense_id,debt_id,created_at")
        .eq("assigned_paycheck", selected.paycheck_date)
        .order("spent_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("budget_expenses")
        .select("future_expense_id,assigned_paycheck,planned_amount,status")
        .not("future_expense_id", "is", null)
        .eq("forecast_suppressed", false)
        .order("assigned_paycheck", { ascending: true }),
      supabase
        .from("budget_income_entries")
        .select("id,received_date,assigned_paycheck,source,amount,note,income_type")
        .eq("assigned_paycheck", selected.paycheck_date)
        .order("received_date", { ascending: false }),
      supabase
        .from("budget_expenses")
        .select("id,due_date,assigned_paycheck,category,line_item,expense_type,frequency,planned_amount,actual_amount,status,reconciliation_status,notes,event_fund,future_expense_id,generated_recurring_id,forecast_generated,forecast_debt_id,forecast_suppressed")
        .gte("assigned_paycheck", selected.paycheck_date)
        .neq("status", "Cancelled")
        .eq("forecast_suppressed", false)
        .order("assigned_paycheck", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("planned_amount", { ascending: false, nullsFirst: false }),
      supabase
        .from("budget_debts")
        .select("id,name,creditor,debt_type,current_balance,original_balance,apr,minimum_payment,payment_frequency,due_timing,payment_grace_days,term_end_date,promo_end_date,settlement_offer_amount,settlement_offer_expires,settlement_notes,linked_budget_line_item,priority_override,notes,active,payoff_status,paid_off_at,priority_rank,balance_estimated")
        .eq("active", true)
        .order("name", { ascending: true }),
    ]);

    const firstError =
      expenseResult.error ||
      futureResult.error ||
      recurringResult.error ||
      actualResult.error ||
      bucketContributionResult.error ||
      incomeResult.error ||
      futurePlanResult.error ||
      debtResult.error;

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const visiblePaychecks = paychecks.filter(
      (row) => !!row.rolling_generated || num(row.actual_check) > 0
    );

    setPaycheck(selected);
    setPaychecks(visiblePaychecks);
    setPaycheckDates(visiblePaychecks.map((row) => row.paycheck_date));
    setExpenses((expenseResult.data || []) as Expense[]);
    setFutureExpenses((futureResult.data || []) as FutureExpense[]);
    setBucketContributions((bucketContributionResult.data || []) as BucketContribution[]);
    setRecurringBills((recurringResult.data || []) as RecurringBill[]);
    setActualExpenses((actualResult.data || []) as ActualExpense[]);
    setIncomeEntries((incomeResult.data || []) as IncomeEntry[]);
    setFuturePlanExpenses((futurePlanResult.data || []) as Expense[]);
    setDebts((debtResult.data || []) as Debt[]);
    const currentBudgetItems = Array.from(
      new Set(
        ((expenseResult.data || []) as Expense[])
          .map(spendingCategoryForExpense)
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    setCategories(currentBudgetItems);
    setLoading(false);
  }

  useEffect(() => {
    void loadData(true);
  }, []);


  async function openDeficitReviewForDate(date: string) {
    setDeficitDate(date);
    setDeficitPreview(null);
    setDeficitError("");
    setDeficitLoading(true);

    const { data, error: previewError } = await supabase.rpc(
      "budget_deficit_review_preview",
      { p_paycheck_date: date }
    );

    if (previewError) {
      setDeficitError(previewError.message);
    } else {
      setDeficitPreview((data || null) as DeficitPreview | null);
    }
    setDeficitLoading(false);
  }

  // Look beyond the newly received paycheck; the next paycheck might be short.
  async function openUpcomingDeficitAfterIncome(startDate: string) {
    const { data, error: deficitQueryError } = await supabase
      .from("budget_paychecks")
      .select("paycheck_date,running_cash_goal_pool")
      .gte("paycheck_date", startDate)
      .order("paycheck_date", { ascending: true })
      .limit(4);

    if (deficitQueryError) {
      setError("Income saved, but deficit review could not be loaded: " + deficitQueryError.message);
      return;
    }

    const firstShortfall = (data || []).find(
      (row) => num(row.running_cash_goal_pool) < -0.005
    );
    if (firstShortfall) {
      await openDeficitReviewForDate(firstShortfall.paycheck_date);
    }
  }

  async function applyDeficitDecision(
    action: "reduce_buffer" | "move_bill",
    expenseId: string,
    newAmount?: number
  ) {
    if (!deficitDate) return;
    setDeficitSaving(true);
    setDeficitError("");

    const { data, error: decisionError } = await supabase.rpc(
      "budget_apply_deficit_decision",
      {
        p_paycheck_date: deficitDate,
        p_action: action,
        p_expense_id: expenseId,
        p_new_amount: newAmount ?? null,
      }
    );

    if (decisionError) {
      setDeficitError(decisionError.message);
      setDeficitSaving(false);
      return;
    }

    const result = data as {
      current_paycheck?: DeficitPreview;
      next_paycheck?: DeficitPreview | null;
    } | null;

    await loadData();
    if (forecastDate) await openForecastPaycheck(forecastDate);
    setNotice("Decision saved. The paycheck plan and forward forecast were recalculated.");

    const current = result?.current_paycheck;
    const following = result?.next_paycheck;
    if (current?.requires_review) {
      setDeficitPreview(current);
    } else if (following?.requires_review) {
      setDeficitDate(following.paycheck_date);
      setDeficitPreview(following);
    } else {
      setDeficitDate(null);
      setDeficitPreview(null);
    }
    setDeficitSaving(false);
  }

  async function openForecastPaycheck(date: string) {
    setForecastDate(date);
    setForecastLoading(true);
    setError("");

    const { data, error: forecastError } = await supabase
      .from("budget_expenses")
      .select("id,due_date,assigned_paycheck,category,line_item,expense_type,frequency,planned_amount,actual_amount,status,reconciliation_status,notes,event_fund,future_expense_id,generated_recurring_id,forecast_generated,forecast_debt_id,forecast_suppressed")
      .eq("assigned_paycheck", date)
      .neq("status", "Cancelled")
      .eq("forecast_suppressed", false)
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
    const existing = editor.item;
    const isEditing = !!existing;
    const eventFund = String(data.get("event_fund") || "").trim();
    const targetRaw = String(data.get("target_budget") || "").trim();
    const targetBudget = targetRaw ? Number(targetRaw) : null;
    const dueDate = String(data.get("due_date") || "").trim() || null;
    const autoFund = data.get("auto_fund") === "on";
    const startPaycheck =
      String(
        data.get("funding_start_paycheck") ||
          existing?.funding_start_paycheck ||
          paycheck.paycheck_date
      ).trim() || paycheck.paycheck_date;
    const fundingDeadline =
      String(
        data.get("funding_deadline") ||
          existing?.funding_deadline ||
          dueDate ||
          ""
      ).trim() || null;
    const notes = String(data.get("notes") || "").trim() || null;

    if (!eventFund) {
      setError("Enter a sinking-fund name.");
      setSaving(false);
      return;
    }

    if (!isEditing && (!targetBudget || targetBudget <= 0 || !dueDate)) {
      setError("Enter a goal name, target amount, and due date.");
      setSaving(false);
      return;
    }

    if (
      autoFund &&
      (!targetBudget ||
        targetBudget <= 0 ||
        !dueDate ||
        !fundingDeadline)
    ) {
      setError(
        "Automatic funding needs a target amount, due date, and funding deadline."
      );
      setSaving(false);
      return;
    }

    if (
      autoFund &&
      fundingDeadline &&
      fundingDeadline < startPaycheck
    ) {
      setError(
        "The funding deadline must be on or after the starting paycheck."
      );
      setSaving(false);
      return;
    }

    const nextStatus =
      targetBudget && targetBudget > 0 && dueDate
        ? existing?.status === "Need budget"
          ? "Funding"
          : existing?.status || "Funding"
        : existing?.status === "Priority"
          ? "Priority"
          : "Need budget";

    const payload = {
      event_fund: eventFund,
      due_date: dueDate,
      target_budget: targetBudget,
      status: nextStatus,
      notes,
      funding_start_paycheck: autoFund ? startPaycheck : existing?.funding_start_paycheck || null,
      funding_deadline: autoFund ? fundingDeadline : existing?.funding_deadline || dueDate,
      auto_fund: autoFund,
    };

    let goalId = existing?.id || null;

    if (existing) {
      const { error: goalError } = await supabase
        .from("budget_future_expenses")
        .update(payload)
        .eq("id", existing.id);

      if (goalError) {
        setError(goalError.message || "Could not update the sinking fund.");
        setSaving(false);
        return;
      }
    } else {
      const { data: createdGoal, error: goalError } = await supabase
        .from("budget_future_expenses")
        .insert({
          ...payload,
          planned_funding: 0,
          actual_funding_spend: 0,
          remaining_to_plan: targetBudget || 0,
          remaining_actual: targetBudget || 0,
        })
        .select("id")
        .single();

      if (goalError || !createdGoal) {
        setError(
          goalError?.message || "Could not create the future goal."
        );
        setSaving(false);
        return;
      }

      goalId = createdGoal.id;
    }

    await supabase
      .from("budget_categories")
      .upsert({ name: "Sinking Fund", active: true }, { onConflict: "name" });

    const { error: horizonError } = await supabase.rpc(
      "refresh_budget_rolling_horizon",
      { p_reference_date: todayIso() }
    );

    if (horizonError) {
      setError(
        `Sinking fund saved, but the rolling forecast could not refresh: ${horizonError.message}`
      );
      setSaving(false);
      return;
    }

    const { error: autoFundError } = await supabase.rpc(
      "refresh_budget_auto_fund_plans",
      { p_reference_date: todayIso() }
    );

    if (autoFundError) {
      setError(
        `Sinking fund saved, but its future funding plan could not refresh: ${autoFundError.message}`
      );
      setSaving(false);
      return;
    }

    const { error: allocationError } = await supabase.rpc(
      "refresh_budget_forecast_surplus_allocations",
      { p_reference_date: todayIso() }
    );

    if (allocationError) {
      setError(
        `Sinking fund saved, but the surplus forecast could not refresh: ${allocationError.message}`
      );
      setSaving(false);
      return;
    }

    setEditor(null);
    setView("forecast");
    setForecastTab("sinking");
    setExpandedBucketId(goalId);

    if (isEditing) {
      setNotice(
        autoFund
          ? `${eventFund} updated. Future unfunded contributions were recalculated without changing money from already received paychecks.`
          : `${eventFund} updated. Existing planned contributions were left in place because automatic funding is off.`
      );
    } else {
      setNotice(
        `${eventFund} added. Future contributions are planned automatically and remain unfunded until each paycheck is received.`
      );
    }

    await loadData();
    setSaving(false);
  }

  async function closeSinkingFund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paycheck || editor?.type !== "close-fund") return;

    setSaving(true);
    setNotice("");
    setError("");

    const data = new FormData(event.currentTarget);
    const destination = String(data.get("destination") || "none");

    const { data: closeout, error: closeError } = await supabase.rpc(
      "close_budget_sinking_fund",
      {
        p_fund_id: editor.item.id,
        p_destination: destination,
        p_assigned_paycheck: paycheck.paycheck_date,
      }
    );

    if (closeError) {
      setError(closeError.message);
      setSaving(false);
      return;
    }

    const result = (closeout || {}) as {
      leftover?: number | string;
      destination?: string;
      destination_fund_name?: string | null;
    };
    const leftover = num(result.leftover);

    setEditor(null);
    setNotice(
      leftover > 0
        ? `${editor.item.event_fund || "Sinking fund"} closed with ${money(
            leftover
          )} moved ${
            result.destination === "buffer"
                ? "to the forgotten / unplanned expense buffer"
                : result.destination === "next_fund"
                  ? `to ${result.destination_fund_name || "the next sinking fund"}`
                  : "out of the fund"
          }.`
        : `${editor.item.event_fund || "Sinking fund"} closed with no money left to reassign.`
    );
    await loadData();
    setSaving(false);
  }

  async function removeClosedSinkingFund(item: FutureExpense) {
    if (
      !window.confirm(
        `Remove "${item.event_fund || "this sinking fund"}" from view? Historical spending and closeout transfers will stay preserved.`
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");

    const { error: removeError } = await supabase
      .from("budget_future_expenses")
      .update({
        status: "Removed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .eq("status", "Closed");

    if (removeError) {
      setError(removeError.message);
    } else {
      setEditor(null);
      setNotice("Closed sinking fund removed from view. Its historical closeout transfer is preserved.");
      await loadData();
    }
    setSaving(false);
  }

  async function deleteBudgetSetupItem(
    itemType: "recurring" | "future" | "debt",
    itemId: string,
    label: string
  ) {
    const detail =
      itemType === "recurring"
        ? "This permanently deletes the recurring bill and its generated future plan entries. Logged spending history stays intact."
        : itemType === "future"
          ? "This permanently deletes the sinking fund and its planned contributions. Logged spending history stays intact."
          : "This permanently deletes the debt, its linked recurring payment setup, and future debt-plan entries. Logged spending history stays intact.";

    if (!window.confirm(`Delete "${label}"?\n\n${detail}`)) return;

    setSaving(true);
    setError("");
    setNotice("");

    const { error: deleteError } = await supabase.rpc(
      "delete_budget_setup_item",
      {
        p_item_type: itemType,
        p_item_id: itemId,
        p_reference_date: todayIso(),
      }
    );

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    setEditor(null);
    setNotice(
      `${label} deleted from the budget. Existing logged transactions were left in history.`
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
    const checkingBalanceRaw = String(data.get("reconciled_checking_balance") ?? "").trim();
    const checkingBalance = Number(checkingBalanceRaw);
    const checkingBalanceTiming = String(
      data.get("checking_balance_timing") || "after"
    );
    const reconciledCheckingBalance =
      checkingBalanceTiming === "before"
        ? checkingBalance + actualCheck
        : checkingBalance;

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
        reconciled_checking_balance: reconciledCheckingBalance,
        period_status: "Received",
        review_required: true,
        review_reason:
          checkingBalanceTiming === "before"
            ? "Paycheck confirmed before deposit; current checking balance projected forward with the deposit"
            : "Paycheck received and checking balance reconciled",
        review_triggered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("paycheck_date", paycheck.paycheck_date);

    if (paycheckError) {
      setError(paycheckError.message);
      setSaving(false);
      return;
    }

    const { error: horizonError } = await supabase.rpc(
      "refresh_budget_rolling_horizon",
      { p_reference_date: paycheck.paycheck_date }
    );

    if (horizonError) {
      setError(
        `Paycheck was saved, but the next rolling forecast period could not be generated: ${horizonError.message}`
      );
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

    const { error: surplusError } = await supabase.rpc(
      "refresh_budget_forecast_surplus_allocations",
      { p_reference_date: paycheck.paycheck_date }
    );

    if (surplusError) {
      setError(
        `Paycheck was saved, but the plan could not be fully reworked: ${surplusError.message}`
      );
      setSaving(false);
      return;
    }

    setEditor(null);
    setView("reviews");
    setNotice(
      checkingBalanceTiming === "before"
        ? "Paycheck saved. The budget added the paycheck to the current pre-deposit checking balance."
        : "Paycheck and current checking balance saved. Budget review refreshed from the real bank balance."
    );
    await loadData();
    await openUpcomingDeficitAfterIncome(paycheck.paycheck_date);
    setSaving(false);
  }

  async function saveIncomeEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paycheck || editor?.type !== "income") return;

    setSaving(true);
    setNotice("");
    setError("");

    const data = new FormData(event.currentTarget);
    const checkingBalanceRaw = String(data.get("reconciled_checking_balance") ?? "").trim();
    const checkingBalance = Number(checkingBalanceRaw);
    const checkingBalanceTiming = String(
      data.get("checking_balance_timing") || "after"
    );
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
    const reconciledCheckingBalance =
      checkingBalanceTiming === "before"
        ? checkingBalance + payload.amount
        : checkingBalance;

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
        reconciled_checking_balance: reconciledCheckingBalance,
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

    const { error: incomeRecalcError } = await supabase.rpc(
      "recalculate_budget_paychecks"
    );

    if (incomeRecalcError) {
      setError(
        `Income was saved, but the budget totals could not be refreshed: ${incomeRecalcError.message}`
      );
      setSaving(false);
      return;
    }

    const { error: incomeSurplusError } = await supabase.rpc(
      "refresh_budget_forecast_surplus_allocations",
      { p_reference_date: payload.assigned_paycheck }
    );

    if (incomeSurplusError) {
      setError(
        `Income was saved, but the plan could not be fully reworked: ${incomeSurplusError.message}`
      );
      setSaving(false);
      return;
    }

    setEditor(null);
    setView("reviews");
    setNotice(
      editor.item
        ? "Additional income and checking balance updated. Budget review refreshed."
        : checkingBalanceTiming === "before"
          ? "Additional income logged. The budget added it to the pre-deposit checking balance."
          : "Additional income logged with the current checking balance. Budget review triggered."
    );
    await loadData();
    await openUpcomingDeficitAfterIncome(payload.assigned_paycheck);
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

  async function saveDebt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editor?.type !== "debt") return;

    setSaving(true);
    setNotice("");
    setError("");

    const data = new FormData(event.currentTarget);
    const numberOrNull = (name: string) => {
      const raw = String(data.get(name) ?? "").trim();
      if (!raw) return null;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    };
    const textOrNull = (name: string) =>
      String(data.get(name) ?? "").trim() || null;

    const payload = {
      name: String(data.get("name") || "").trim(),
      creditor: textOrNull("creditor"),
      debt_type: String(data.get("debt_type") || "Other"),
      current_balance: Number(data.get("current_balance") || 0),
      original_balance: numberOrNull("original_balance"),
      apr: numberOrNull("apr"),
      minimum_payment: numberOrNull("minimum_payment"),
      payment_frequency: textOrNull("payment_frequency"),
      due_timing: textOrNull("due_timing"),
      payment_grace_days: Math.max(
        0,
        Math.min(31, Math.trunc(numberOrNull("payment_grace_days") ?? 0))
      ),
      term_end_date: textOrNull("term_end_date"),
      promo_end_date: textOrNull("promo_end_date"),
      settlement_offer_amount: numberOrNull("settlement_offer_amount"),
      settlement_offer_expires: textOrNull("settlement_offer_expires"),
      settlement_notes: textOrNull("settlement_notes"),
      linked_budget_line_item: textOrNull("linked_budget_line_item"),
      priority_override: String(data.get("priority_override") || "Auto"),
      priority_rank:
        editor.item?.priority_rank == null
          ? debts.filter((debt) => debt.active).length + 1
          : num(editor.item.priority_rank),
      notes: textOrNull("notes"),
      active: true,
      updated_at: new Date().toISOString(),
      ...(!editor.item ||
      Math.abs(
        Number(data.get("current_balance") || 0) -
          num(editor.item.current_balance)
      ) > 0.005
        ? {
            tracking_start_balance: Number(data.get("current_balance") || 0),
            tracking_start_date: todayIso(),
            tracking_start_at: new Date().toISOString(),
            balance_estimated: false,
          }
        : {}),
    };

    if (!payload.name || payload.current_balance < 0) {
      setError("Enter a debt name and a valid current balance.");
      setSaving(false);
      return;
    }

    const result = editor.item
      ? await supabase
          .from("budget_debts")
          .update(payload)
          .eq("id", editor.item.id)
      : await supabase.from("budget_debts").insert(payload);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    if (editor.item?.id) {
      const { error: rollingError } = await supabase.rpc(
        "refresh_budget_debt_schedule",
        {
          p_debt_id: editor.item.id,
          p_reference_date: todayIso(),
        }
      );

      if (rollingError) {
        setError(
          `Debt saved, but its forecast schedule could not be refreshed: ${rollingError.message}`
        );
        setSaving(false);
        return;
      }
    }

    setEditor(null);
    setNotice(editor.item ? "Debt details updated." : "Debt added.");
    await loadData();
    setSaving(false);
  }

  async function archiveDebt(item: Debt) {
    if (
      !window.confirm(
        `Mark "${item.name}" paid off? It will stay in the debt list as paid off until you confirm it.`
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");

    const { error: paidError } = await supabase.rpc(
      "mark_budget_debt_paid",
      { p_debt_id: item.id }
    );

    if (paidError) {
      setError(paidError.message);
    } else {
      setEditor(null);
      setNotice(
        `${item.name} is marked paid off and is waiting for your confirmation before removal.`
      );
      await loadData();
    }
    setSaving(false);
  }

  async function confirmDebtPaid(item: Debt) {
    if (
      !window.confirm(
        `Confirm "${item.name}" is fully paid? This removes it from the debt list. Payment history stays in the budget.`
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");

    const { error: confirmError } = await supabase.rpc(
      "confirm_budget_debt_paid",
      { p_debt_id: item.id }
    );

    if (confirmError) {
      setError(confirmError.message);
    } else {
      setEditor(null);
      setNotice(`${item.name} confirmed paid and removed from tracked debts.`);
      await loadData();
    }
    setSaving(false);
  }

  const orderedActiveDebts = () =>
    debts
      .filter(
        (debt) =>
          debt.active &&
          debt.payoff_status === "Active" &&
          num(debt.current_balance) > 0
      )
      .slice()
      .sort(
        (a, b) =>
          (num(a.priority_rank) || 9999) - (num(b.priority_rank) || 9999) ||
          a.name.localeCompare(b.name)
      );

  async function persistDebtPriority(nextOrder: Debt[]) {
    const ids = nextOrder.map((debt) => debt.id);
    const rankById = new Map(ids.map((id, index) => [id, index + 1]));

    setDebts((current) =>
      current.map((debt) =>
        rankById.has(debt.id)
          ? { ...debt, priority_rank: rankById.get(debt.id)! }
          : debt
      )
    );

    const { error: priorityError } = await supabase.rpc(
      "set_budget_debt_priority",
      { p_debt_ids: ids }
    );

    if (priorityError) {
      setError(
        `Debt priority could not be saved: ${priorityError.message}`
      );
      await loadData();
      return;
    }

    setNotice("Debt payoff priority updated.");
    await loadData();
  }

  function reorderDebtPriority(sourceId: string, targetId: string) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const ordered = orderedActiveDebts();
    const sourceIndex = ordered.findIndex((debt) => debt.id === sourceId);
    const targetIndex = ordered.findIndex((debt) => debt.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const [moved] = ordered.splice(sourceIndex, 1);
    ordered.splice(targetIndex, 0, moved);
    void persistDebtPriority(ordered);
  }

  function moveDebtPriorityStep(debtId: string, direction: -1 | 1) {
    const ordered = orderedActiveDebts();
    const index = ordered.findIndex((debt) => debt.id === debtId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;

    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    void persistDebtPriority(ordered);
  }

  async function saveActualExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paycheck || editor?.type !== "actual") return;

    setNotice("");
    setError("");

    const data = new FormData(event.currentTarget);
    const plannedExpenseId =
      String(data.get("planned_expense_id") || "").trim() || null;
    const linkedPlan = plannedExpenseId
      ? expenses.find((expense) => expense.id === plannedExpenseId) || null
      : null;
    const category =
      String(
        data.get("category") ||
          (linkedPlan ? spendingCategoryForExpense(linkedPlan) || linkedPlan.category : "") ||
          "Other"
      ).trim() || "Other";
    const futureExpenseId =
      String(data.get("future_expense_id") || linkedPlan?.future_expense_id || "").trim() ||
      null;
    const linkedRecurring = linkedPlan?.generated_recurring_id
      ? recurringBills.find(
          (bill) => bill.id === linkedPlan.generated_recurring_id
        ) || null
      : null;
    const linkedDebtId =
      linkedPlan?.forecast_debt_id ||
      linkedRecurring?.linked_debt_id ||
      (linkedPlan
        ? debts.find(
            (debt) => debt.linked_budget_line_item === linkedPlan.line_item
          )?.id || null
        : null);

    const payload = {
      spent_date: String(data.get("spent_date") || todayIso()),
      assigned_paycheck: String(
        data.get("assigned_paycheck") || paycheck.paycheck_date
      ),
      category,
      description:
        String(data.get("description") || "").trim() ||
        linkedPlan?.line_item ||
        "",
      amount: Number(data.get("amount") || 0),
      note: String(data.get("note") || "").trim() || null,
      future_expense_id: futureExpenseId,
      planned_expense_id: plannedExpenseId,
      debt_id: linkedDebtId,
    };

    if (!payload.description || payload.amount <= 0) {
      setError("Enter what you paid for and an amount greater than $0.");
      return;
    }

    const warnings: string[] = [];

    if (linkedPlan) {
      const currentLinkedAmount =
        editor.item?.planned_expense_id === linkedPlan.id
          ? num(editor.item.amount)
          : 0;
      const usedBefore =
        Math.max(0, num(linkedPlan.actual_amount)) - currentLinkedAmount;
      const plannedAmount = num(linkedPlan.planned_amount);
      const remainingBefore = plannedAmount - usedBefore;

      if (payload.amount > remainingBefore) {
        const afterTotal = usedBefore + payload.amount;
        const overBy = Math.max(0, afterTotal - plannedAmount);
        warnings.push(
          `${linkedPlan.line_item || "This planned item"} will be ${money(overBy)} over its ${money(
            plannedAmount
          )} planned amount for this pay period.`
        );
      }
    } else if (!futureExpenseId) {
      const categoryBudget = spendingComparison.find(
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
    const generated = Boolean(
      expense.generated_recurring_id ||
        expense.future_expense_id ||
        expense.forecast_generated
    );

    const message = generated
      ? `Remove this generated occurrence of "${expense.line_item}" from the plan? The source recurring bill, sinking fund, or forecast rule will remain.`
      : `Permanently delete "${expense.line_item}" from the budget?`;

    if (!window.confirm(message)) return;

    setSaving(true);
    setError("");

    const result = generated
      ? await supabase
          .from("budget_expenses")
          .update({ status: "Cancelled" })
          .eq("id", expense.id)
      : await supabase
          .from("budget_expenses")
          .delete()
          .eq("id", expense.id);

    if (result.error) {
      setError(result.error.message);
    } else {
      setEditor(null);
      setNotice(
        generated
          ? "Generated occurrence removed from this plan."
          : "Expense permanently deleted from the budget."
      );
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
    const rawGraceDays = Number(data.get("payment_grace_days") || 0);
    const paymentGraceDays = Number.isFinite(rawGraceDays)
      ? Math.max(0, Math.min(31, Math.trunc(rawGraceDays)))
      : 0;
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
      payment_grace_days: paymentGraceDays,
      active: true,
      notes,
      ...(!editor.item && createOccurrences && nextDueDate
        ? {
            generation_enabled: true,
            generation_anchor_date: nextDueDate,
            generation_line_item: item,
            generation_expense_type: "Required",
          }
        : {}),
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

    if (
      (!editor.item && createOccurrences && nextDueDate) ||
      (editor.item && updateFuture)
    ) {
      const { error: rollingError } = await supabase.rpc(
        "refresh_budget_rolling_horizon",
        { p_reference_date: todayIso() }
      );

      if (rollingError) {
        setError(
          `Recurring bill saved, but the rolling paycheck window could not be refreshed: ${rollingError.message}`
        );
        setSaving(false);
        return;
      }
    }

    setEditor(null);
    setNotice(
      editor.item
        ? "Recurring bill updated."
        : createOccurrences && nextDueDate
          ? "Recurring bill added to the rolling one-year forecast."
          : "Recurring bill added."
    );
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
    paycheck?.reconciled_checking_balance == null
      ? null
      : num(paycheck.reconciled_checking_balance);
  const reconciliationAdjustment =
    checkingBalance == null ? 0 : checkingBalance - income;
  const cashAvailable = checkingBalance == null ? income : checkingBalance;
  const availableExtra = cashAvailable - planned;

  const currentCloseoutTransfers = useMemo(
    () =>
      futureExpenses.filter(
        (item) =>
          isClosedFundStatus(item.status) &&
          item.closeout_assigned_paycheck === paycheck?.paycheck_date &&
          num(item.closeout_amount) > 0
      ),
    [futureExpenses, paycheck?.paycheck_date]
  );

  const bufferCloseoutBonus = useMemo(
    () =>
      currentCloseoutTransfers
        .filter((item) => item.closeout_destination === "buffer")
        .reduce((sum, item) => sum + num(item.closeout_amount), 0),
    [currentCloseoutTransfers]
  );

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
      const spendingCategory =
        normalizeSpendingCategory(item.category) || "Other";
      const matchingPlan = expenses.find(
        (expense) =>
          spendingCategoryForExpense(expense) === spendingCategory
      );
      const category = matchingPlan?.category || item.category || "Other";
      const row = map.get(category) || { category, planned: 0, actual: 0 };
      row.actual += num(item.amount);
      map.set(category, row);
    }

    return Array.from(map.values()).sort((a, b) =>
      a.category.localeCompare(b.category)
    );
  }, [expenses, actualExpenses]);

  const spendingComparison = useMemo(() => {
    const map = new Map<
      string,
      { category: string; planned: number; actual: number }
    >();

    for (const expense of expenses) {
      const category = spendingCategoryForExpense(expense);
      if (!category) continue;

      const row = map.get(category) || { category, planned: 0, actual: 0 };
      row.planned += num(expense.planned_amount);
      map.set(category, row);
    }

    for (const item of actualExpenses) {
      const category =
        normalizeSpendingCategory(item.category) || "Other";
      const row = map.get(category) || { category, planned: 0, actual: 0 };
      row.actual += num(item.amount);
      map.set(category, row);
    }

    if (bufferCloseoutBonus > 0) {
      const category = "Forgotten / unplanned expense buffer";
      const row = map.get(category) || { category, planned: 0, actual: 0 };
      row.planned += bufferCloseoutBonus;
      map.set(category, row);
    }

    return Array.from(map.values());
  }, [expenses, actualExpenses, bufferCloseoutBonus]);

  const debtSignals = useMemo(() => {
    const today = todayIso();
    const daysUntil = (date: string | null) => {
      if (!date) return null;
      const start = new Date(`${today}T12:00:00`).getTime();
      const end = new Date(`${date}T12:00:00`).getTime();
      return Math.ceil((end - start) / 86400000);
    };

    return debts
      .filter(
        (debt) =>
          debt.active &&
          debt.payoff_status === "Active" &&
          num(debt.current_balance) > 0
      )
      .map((debt) => {
        const balance = num(debt.current_balance);
        const apr =
          debt.apr == null || String(debt.apr).trim() === ""
            ? null
            : num(debt.apr);
        const settlement = num(debt.settlement_offer_amount);
        const settlementSavings =
          settlement > 0 && settlement < balance ? balance - settlement : 0;
        const settlementDays = daysUntil(debt.settlement_offer_expires);
        const termDays = daysUntil(debt.term_end_date);
        const promoDays = daysUntil(debt.promo_end_date);

        let score = 0;
        const reasons: string[] = [];

        if (debt.priority_override === "High") score += 10000;
        if (debt.priority_override === "Low") score -= 10000;

        if (settlementSavings > 0) {
          score += 2500 + Math.min(1500, settlementSavings / 2);
          reasons.push(
            `Settlement offer could reduce the balance by ${money(settlementSavings)}${debt.settlement_offer_expires ? ` and expires ${dateLabel(debt.settlement_offer_expires)}` : ""}.`
          );
          if (settlementDays != null && settlementDays <= 45) score += 1200;
        }

        if (apr != null && apr > 0) {
          score += apr * 100;
          reasons.push(
            `${apr.toFixed(2)}% APR means carrying this balance keeps adding interest.`
          );
        } else if (apr === 0) {
          reasons.push("No interest is currently recorded on this debt.");
        } else {
          reasons.push("Interest rate is unknown, so the payoff ranking is less certain.");
        }

        if (promoDays != null && promoDays >= 0 && promoDays <= 90) {
          score += 900;
          reasons.push(`Promotional rate ends ${dateLabel(debt.promo_end_date)}.`);
        }

        if (termDays != null && termDays >= 0) {
          if (termDays <= 60) score += 1200;
          else if (termDays <= 180) score += 500;
          reasons.push(`Recorded payoff/term date is ${dateLabel(debt.term_end_date)}.`);
        }

        if (apr === 0 && !debt.term_end_date && settlementSavings <= 0) {
          score -= 250;
          reasons.push(
            "No interest or deadline is recorded. Extra-payment priority follows your saved debt order."
          );
        }

        return { debt, score, reasons };
      })
      .sort(
        (a, b) =>
          (num(a.debt.priority_rank) || 9999) -
            (num(b.debt.priority_rank) || 9999) ||
          a.debt.name.localeCompare(b.debt.name)
      );
  }, [debts]);

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

  const bucketIncomingCloseouts = (
    bucketId: string,
    throughPaycheck = "9999-12-31"
  ) =>
    futureExpenses
      .filter(
        (item) =>
          item.closeout_destination === "next_fund" &&
          item.closeout_destination_fund_id === bucketId &&
          !!item.closeout_assigned_paycheck &&
          item.closeout_assigned_paycheck <= throughPaycheck &&
          num(item.closeout_amount) > 0
      )
      .reduce((sum, item) => sum + num(item.closeout_amount), 0);

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
      .reduce((sum, row) => sum + num(row.planned_amount), 0) +
    bucketIncomingCloseouts(bucketId, throughPaycheck);

  const allocationSuggestions = useMemo(() => {
    if (!paycheck) return [];

    const suggestions: Array<{
      kind: "shortfall" | "dealership" | "emergency" | "debt";
      title: string;
      detail: string;
      amount: number;
    }> = [];

    // Keep the first $500 unassigned. Extra money above that follows the same
    // milestone order used by the rolling forecast.
    let remaining = Math.max(0, availableExtra - 500);
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
        )} short. Holding this amount prevents the known plan from going negative.`,
        amount,
      });
      remaining -= amount;
    }

    const dealershipItems = futurePlanExpenses
      .filter((item) => {
        if (
          !item.assigned_paycheck ||
          item.assigned_paycheck <= paycheck.paycheck_date
        ) {
          return false;
        }
        if (item.status === "Cancelled" || item.status === "Deferred") {
          return false;
        }
        if (num(item.planned_amount) <= 0) return false;
        return (item.line_item || "")
          .toLowerCase()
          .includes("dealership deferred down payment");
      })
      .sort((a, b) =>
        (a.assigned_paycheck || "").localeCompare(b.assigned_paycheck || "")
      );

    for (const item of dealershipItems) {
      if (remaining <= 0) break;
      const amount = Math.min(remaining, num(item.planned_amount));
      suggestions.push({
        kind: "dealership",
        title: `Finish ${item.line_item || "dealership down payment"}`,
        detail: `This is currently planned for ${dateLabel(
          item.assigned_paycheck
        )}. The emergency-fund milestone comes immediately after it.`,
        amount,
      });
      remaining -= amount;
    }

    const emergencyFund = futureExpenses.find((item) =>
      (item.event_fund || "").toLowerCase().includes("emergency fund")
    );

    if (remaining > 0 && emergencyFund && emergencyFund.status !== "Completed") {
      const funded = bucketContributions
        .filter(
          (row) =>
            row.future_expense_id === emergencyFund.id &&
            row.status !== "Cancelled" &&
            row.status !== "Deferred" &&
            contributionCountsAsFunded(row)
        )
        .reduce((sum, row) => sum + num(row.planned_amount), 0);
      const spent = num(emergencyFund.actual_funding_spend);
      const availableInFund = funded - spent;
      const target = num(emergencyFund.target_budget);
      const needed = Math.max(0, target - availableInFund);

      if (needed > 0) {
        const amount = Math.min(remaining, needed);
        suggestions.push({
          kind: "emergency",
          title: `Build Emergency Fund to ${money(target)}`,
          detail: `Currently ${money(
            Math.max(0, availableInFund)
          )} is actually funded. Future planned contributions do not become available until the paycheck is received.`,
          amount,
        });
        remaining -= amount;
      }
    }

    const regularDebtTargets = debtSignals.filter(
      ({ debt }) =>
        !["auto loan", "mortgage"].includes(
          (debt.debt_type || "").trim().toLowerCase()
        )
    );

    const jeepTarget = debtSignals.find(
      ({ debt }) =>
        (debt.debt_type || "").trim().toLowerCase() === "auto loan" &&
        (debt.name || "").toLowerCase().includes("jeep")
    );

    const vanTarget = debtSignals.find(
      ({ debt }) =>
        (debt.debt_type || "").trim().toLowerCase() === "auto loan" &&
        ((debt.name || "").toLowerCase().includes("van") ||
          (debt.name || "").toLowerCase().includes("pacifica"))
    );

    const debtTargets = regularDebtTargets.length
      ? regularDebtTargets
      : jeepTarget
        ? [jeepTarget]
        : vanTarget
          ? [vanTarget]
          : [];

    for (const debtTarget of debtTargets) {
      if (remaining <= 0) break;

      const balance = num(debtTarget.debt.current_balance);
      if (balance <= 0) continue;

      const amount = Math.min(remaining, balance);
      suggestions.push({
        kind: "debt",
        title: `Extra payment — ${debtTarget.debt.name}`,
        detail:
          debtTarget.reasons[0] ||
          "Minimum payment remains in the regular paycheck plan; this is extra principal/payoff money.",
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
    debtSignals,
  ]);

  const activePlanExpenses = expenses.filter(
    (expense) =>
      expense.status !== "Cancelled" &&
      expense.status !== "Deferred"
  );
  const planBills = activePlanExpenses.filter(
    (expense) => expensePlanGroup(expense) === "bills"
  );
  const planSinking = activePlanExpenses.filter(
    (expense) => expensePlanGroup(expense) === "sinking"
  );
  const planSpending = activePlanExpenses.filter(
    (expense) => expensePlanGroup(expense) === "spending"
  );
  // Show near-term date mismatches even if the bill is funded from a later paycheck.
  // Do not silently reassign the obligation: some delayed payments are intentional.
  const upcomingPaymentTiming = futurePlanExpenses.filter(
    (expense) =>
      !!expense.due_date &&
      !!expense.assigned_paycheck &&
      expense.due_date <= addDays(paycheck?.paycheck_date || todayIso(), 60) &&
      expense.assigned_paycheck >= (paycheck?.paycheck_date || todayIso()) &&
      expense.status !== "Deferred" &&
      expense.status !== "Cancelled"
  );

  const sinkingFundNameForExpense = (expense: Expense) =>
    expense.event_fund ||
    futureExpenses.find((item) => item.id === expense.future_expense_id)
      ?.event_fund ||
    "Other sinking fund";

  const reviewText = useMemo(() => {
    if (!paycheck) return "";
    if (availableExtra > 500) {
      return `This paycheck has ${money(
        availableExtra - 500
      )} above the $500 unassigned cushion. That extra should move to the current emergency-fund or debt milestone instead of sitting in the running pool.`;
    }
    if (availableExtra >= 0) {
      return `The plan fits and leaves ${money(
        availableExtra
      )} unassigned. The rolling forecast automatically gives surplus above the $500 cushion a job.`;
    }
    return `The current plan is ${money(
      Math.abs(availableExtra)
    )} short, so at least one planned expense needs to move, shrink, or be deferred before this paycheck is finalized.`;
  }, [availableExtra, paycheck]);

  const normalExpenses = expenses;

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
    <main
      className="min-h-[100dvh] bg-slate-100 text-slate-950"
      style={{
        paddingBottom: "calc(12rem + env(safe-area-inset-bottom, 0px))",
        scrollPaddingBottom: "calc(12rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="mx-auto max-w-xl">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-gradient-to-r from-slate-950 to-blue-950 px-3 pb-2.5 pt-2 text-white shadow-md">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/admin"
              className="text-[10px] font-black uppercase tracking-[0.08em] text-emerald-300"
            >
              ← Crested Critters Admin
            </Link>
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={() => setEditor({ type: "income" })}
                className="rounded-lg bg-blue-300 px-2 py-1.5 text-[11px] font-black leading-none text-blue-950"
              >
                + Income
              </button>
              <button
                onClick={() => setEditor({ type: "actual" })}
                className="rounded-lg bg-emerald-300 px-2 py-1.5 text-[11px] font-black leading-none text-emerald-950"
              >
                + Spend
              </button>
            </div>
          </div>
          <h1 className="mt-1 text-base font-black leading-tight tracking-tight">
            Household Budget
          </h1>
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
                    label="Cash available"
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
                      : ""}
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
                <MiniStat label="After plan" value={money(availableExtra)} />
              </div>

              {num(paycheck.running_cash_goal_pool) < -0.005 && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-rose-950">
                        This paycheck has a {money(Math.abs(num(paycheck.running_cash_goal_pool)))} projected shortfall
                      </p>
                      <p className="mt-1 text-xs leading-5 text-rose-800">
                        Review this paycheck's buffer or eligible unpaid bills.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void openDeficitReviewForDate(paycheck.paycheck_date)}
                      className="rounded-xl bg-rose-800 px-4 py-2.5 text-xs font-black text-white"
                    >
                      Resolve deficit
                    </button>
                  </div>
                </div>
              )}

              <PaymentTimingAlerts expenses={upcomingPaymentTiming} />

              <div className="grid grid-cols-4 gap-1 rounded-2xl bg-slate-200 p-1">
                {[
                  ["bills", "Bills", planBills.length],
                  ["sinking", "Sinking", planSinking.length],
                  ["spending", "Spending", planSpending.length],
                  ["all", "All", activePlanExpenses.length],
                ].map(([tab, label, count]) => (
                  <button
                    key={String(tab)}
                    type="button"
                    onClick={() => setPlanTab(tab as PlanTab)}
                    className={`min-w-0 rounded-xl px-1.5 py-2.5 text-[11px] font-black transition sm:text-sm ${
                      planTab === tab
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

              {(planTab === "bills" || planTab === "all") && (
                <PlanExpenseSection
                  title="Bills"
                  subtitle="Required bills, debt payments, collections, subscriptions, utilities, insurance, and other obligations."
                  expenses={planBills}
                  groupBy={(expense) => expense.category || "Other bills"}
                  onEdit={(expense) =>
                    setEditor({ type: "expense", item: expense })
                  }
                  onSpend={(expense) =>
                    setEditor({
                      type: "actual",
                      plannedExpenseId: expense.id,
                    })
                  }
                  emptyText="No bills are assigned to this paycheck."
                />
              )}

              {(planTab === "sinking" || planTab === "all") && (
                <PlanExpenseSection
                  title="Sinking funds"
                  subtitle="Money being set aside for a specific future goal or event."
                  expenses={planSinking}
                  groupBy={sinkingFundNameForExpense}
                  onEdit={(expense) =>
                    setEditor({ type: "expense", item: expense })
                  }
                  onSpend={(expense) => {
                    const fundId =
                      expense.future_expense_id ||
                      futureExpenses.find(
                        (item) =>
                          item.event_fund === sinkingFundNameForExpense(expense)
                      )?.id;
                    setEditor({
                      type: "actual",
                      plannedExpenseId: expense.id,
                      futureExpenseId: fundId || undefined,
                    });
                  }}
                  groupSpentBy={(group) => {
                    const fundId = futureExpenses.find(
                      (item) => item.event_fund === group
                    )?.id;
                    if (!fundId) return 0;

                    return actualExpenses
                      .filter((item) => item.future_expense_id === fundId)
                      .reduce((sum, item) => sum + num(item.amount), 0);
                  }}
                  emptyText="No sinking-fund contributions are assigned to this paycheck."
                />
              )}

              {(planTab === "spending" || planTab === "all") && (
                <PlanExpenseSection
                  title="Spending"
                  subtitle="Forgotten/unplanned buffer, vehicle fuel, and food."
                  expenses={planSpending}
                  onEdit={(expense) =>
                    setEditor({ type: "expense", item: expense })
                  }
                  onSpend={(expense) =>
                    setEditor({
                      type: "actual",
                      plannedExpenseId: expense.id,
                    })
                  }
                  emptyText="No day-to-day spending is assigned to this paycheck."
                />
              )}
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
                    label="Cash available"
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

                <div className="mt-4">
                  <PaymentTimingAlerts expenses={upcomingPaymentTiming} />
                </div>

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
                          No additional allocation is suggested. The remaining amount is within the $500 unassigned cushion.
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

                {debtSignals.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-amber-950">
                          Debt payoff signals
                        </p>
                        <p className="mt-1 text-xs leading-5 text-amber-800">
                          Ranked from the details you enter: interest cost, settlement
                          offers, promotional deadlines, and payoff terms.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setView("more")}
                        className="shrink-0 text-xs font-black text-amber-900"
                      >
                        Manage debts
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {debtSignals.slice(0, 5).map(({ debt, reasons }, index) => {
                        const apr =
                          debt.apr == null || String(debt.apr).trim() === ""
                            ? null
                            : num(debt.apr);
                        return (
                          <button
                            key={debt.id}
                            type="button"
                            onClick={() => setEditor({ type: "debt", item: debt })}
                            className="w-full rounded-xl bg-white p-3 text-left ring-1 ring-amber-100"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-sm font-black text-slate-950">
                                    {index + 1}. {debt.name}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                    {apr == null
                                      ? "APR unknown"
                                      : apr === 0
                                        ? "0% interest"
                                        : `${apr.toFixed(2)}% APR`}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                  {reasons.slice(0, 2).join(" ")}
                                </p>
                              </div>
                              <strong className="shrink-0 text-sm text-slate-950">
                                {money(num(debt.current_balance))}
                              </strong>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-5 border-t border-slate-200 pt-5">
                  <div className="mb-5">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-sm font-black">Budget vs actual</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Plan is the budget target for this paycheck period, not money already funded. Spent is what has actually been logged.
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
                      <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
                        <span>Category</span>
                        <span>Plan</span>
                        <span>Spent</span>
                      </div>
                      {categoryComparison.map((row) => (
                        <div
                          key={row.category}
                          className="grid grid-cols-[1fr_auto_auto] gap-3 border-t border-slate-100 px-3 py-2.5 text-xs"
                        >
                          <span className="font-bold">{row.category}</span>
                          <span>{money(row.planned)}</span>
                          <span
                            className={
                              row.actual > row.planned
                                ? "font-black text-rose-600"
                                : "font-black text-emerald-700"
                            }
                          >
                            {money(row.actual)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

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
                subtitle="Surplus is automatically assigned to the current emergency-fund or debt milestone, while future money stays planned until the paycheck is received."
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
                      .filter(
                        (row) =>
                          row.paycheck_date >= paycheck.paycheck_date &&
                          row.rolling_generated
                      )
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
                                Unassigned pool{" "}
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
                    {futureExpenses.filter((item) => !isClosedFundStatus(item.status)).length ? (
                      futureExpenses
                        .filter((item) => !isClosedFundStatus(item.status))
                        .map((item) => {
                          const funded = bucketFundedThrough(
                            item.id,
                            "9999-12-31"
                          );
                          const totalPlanned =
                            bucketContributions
                              .filter(
                                (row) =>
                                  row.future_expense_id === item.id &&
                                  row.status !== "Cancelled" &&
                                  row.status !== "Deferred"
                              )
                              .reduce(
                                (sum, row) => sum + num(row.planned_amount),
                                0
                              ) + bucketIncomingCloseouts(item.id);
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
                          const datePassed =
                            !!item.due_date && item.due_date < todayIso();

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
                                <span className="flex items-center justify-between gap-3">
                                  <span className="min-w-0 truncate">
                                    {item.event_fund || "Future expense"}
                                  </span>
                                  {datePassed && (
                                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800">
                                      Date passed
                                    </span>
                                  )}
                                </span>
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

                                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditor({ type: "future", item })
                                      }
                                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-900"
                                    >
                                      Edit sinking fund
                                    </button>
                                    {datePassed && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditor({ type: "close-fund", item })
                                        }
                                        className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
                                      >
                                        Close out sinking fund
                                      </button>
                                    )}
                                  </div>
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
                subtitle="Manage debts, recurring bills, and future expenses without one long page."
              />

              <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-200 p-1">
                <button
                  type="button"
                  onClick={() => setMoreTab("debts")}
                  className={`min-w-0 rounded-xl px-2 py-2.5 text-xs font-black transition sm:text-sm ${
                    moreTab === "debts"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  Debts
                  <span className="ml-1 text-[10px] font-bold text-slate-400">
                    {debts.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMoreTab("recurring")}
                  className={`min-w-0 rounded-xl px-2 py-2.5 text-xs font-black transition sm:text-sm ${
                    moreTab === "recurring"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  Recurring
                  <span className="ml-1 text-[10px] font-bold text-slate-400">
                    {recurringBills.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMoreTab("future")}
                  className={`min-w-0 rounded-xl px-2 py-2.5 text-xs font-black transition sm:text-sm ${
                    moreTab === "future"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  Future
                  <span className="ml-1 text-[10px] font-bold text-slate-400">
                    {futureExpenses.filter(
                      (item) => (item.status || "").toLowerCase() !== "removed"
                    ).length}
                  </span>
                </button>
              </div>

              {moreTab === "debts" && (
                <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">Debts</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Balances, interest, required payments, payoff terms, and collections.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditor({ type: "debt" })}
                      className="shrink-0 rounded-xl bg-slate-950 px-3 py-2 text-sm font-black text-white"
                    >
                      + Debt
                    </button>
                  </div>

                  <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                    Extra debt payoff follows this order from top to bottom. Every
                    required minimum stays in the normal paycheck plan. Drag rows
                    on desktop or use the arrows on mobile.
                  </p>

                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                    {debts.length ? (
                      [
                        ...debts
                          .filter(
                            (debt) =>
                              debt.payoff_status ===
                              "Paid off - awaiting confirmation"
                          )
                          .sort((a, b) => a.name.localeCompare(b.name)),
                        ...orderedActiveDebts(),
                      ].map((debt, index, ordered) => {
                        const apr =
                          debt.apr == null || String(debt.apr).trim() === ""
                            ? null
                            : num(debt.apr);
                        const isActive =
                          debt.payoff_status === "Active" &&
                          num(debt.current_balance) > 0;
                        const activeIndex = isActive
                          ? orderedActiveDebts().findIndex(
                              (item) => item.id === debt.id
                            )
                          : -1;
                        const activeCount = orderedActiveDebts().length;

                        return (
                          <div
                            key={debt.id}
                            draggable={isActive}
                            onDragStart={() => {
                              if (isActive) setDraggedDebtId(debt.id);
                            }}
                            onDragEnd={() => setDraggedDebtId(null)}
                            onDragOver={(event) => {
                              if (isActive) event.preventDefault();
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              if (draggedDebtId && isActive) {
                                reorderDebtPriority(draggedDebtId, debt.id);
                              }
                              setDraggedDebtId(null);
                            }}
                            className={`flex items-center gap-2 border-b border-slate-100 p-3 last:border-0 ${
                              draggedDebtId === debt.id
                                ? "bg-blue-50"
                                : "bg-white"
                            }`}
                          >
                            <div className="flex shrink-0 flex-col items-center gap-1">
                              {isActive ? (
                                <>
                                  <span
                                    className="cursor-grab select-none text-lg font-black text-slate-400"
                                    title="Drag to reorder"
                                    aria-hidden="true"
                                  >
                                    ⋮⋮
                                  </span>
                                  <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-black text-white">
                                    #{num(debt.priority_rank) || activeIndex + 1}
                                  </span>
                                </>
                              ) : (
                                <span className="text-lg text-emerald-600">✓</span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setEditor({ type: "debt", item: debt })
                              }
                              className="min-w-0 flex-1 text-left"
                            >
                              <strong className="block truncate text-sm">
                                {debt.name}
                              </strong>
                              {debt.payoff_status ===
                                "Paid off - awaiting confirmation" && (
                                <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                                  Paid off · confirm to remove
                                </span>
                              )}
                              <span className="mt-0.5 block text-[11px] text-slate-500">
                                {debt.debt_type}
                                {apr == null
                                  ? " · APR unknown"
                                  : apr === 0
                                    ? " · 0% interest"
                                    : ` · ${apr.toFixed(2)}% APR`}
                                {num(debt.minimum_payment) > 0
                                  ? ` · min ${money(
                                      num(debt.minimum_payment)
                                    )}`
                                  : ""}
                                {debt.balance_estimated
                                  ? " · balance estimated"
                                  : ""}
                              </span>
                            </button>

                            <div className="shrink-0 text-right">
                              <strong
                                className={`block text-sm ${
                                  debt.payoff_status ===
                                  "Paid off - awaiting confirmation"
                                    ? "text-emerald-700"
                                    : ""
                                }`}
                              >
                                {debt.payoff_status ===
                                "Paid off - awaiting confirmation"
                                  ? "Paid"
                                  : money(num(debt.current_balance))}
                              </strong>

                              {isActive ? (
                                <div className="mt-1 flex justify-end gap-1">
                                  <button
                                    type="button"
                                    disabled={activeIndex <= 0}
                                    onClick={() =>
                                      moveDebtPriorityStep(debt.id, -1)
                                    }
                                    className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-600 disabled:opacity-30"
                                    aria-label={`Move ${debt.name} up in debt priority`}
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      activeIndex < 0 ||
                                      activeIndex >= activeCount - 1
                                    }
                                    onClick={() =>
                                      moveDebtPriorityStep(debt.id, 1)
                                    }
                                    className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-600 disabled:opacity-30"
                                    aria-label={`Move ${debt.name} down in debt priority`}
                                  >
                                    ↓
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="p-3 text-sm text-slate-500">
                        No structured debts yet.
                      </p>
                    )}
                  </div>
                </section>
              )}

              {moreTab === "recurring" && (
                <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black">Recurring bills</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Edit a bill once and its future rolling forecast can follow it.
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
                    {recurringBills.length ? (
                      recurringBills.map((bill) => (
                        <RecurringRow
                          key={bill.id}
                          bill={bill}
                          onEdit={() =>
                            setEditor({ type: "recurring", item: bill })
                          }
                        />
                      ))
                    ) : (
                      <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                        No recurring bills are active.
                      </p>
                    )}
                  </div>
                </section>
              )}

              {moreTab === "future" && (
                <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">Future expenses</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Upcoming goals and sinking funds. Funding is still planned until a paycheck is received.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditor({ type: "future" })}
                      className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-sm font-black text-white"
                    >
                      + Future
                    </button>
                  </div>

                  <div className="mt-3 space-y-3">
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      {futureExpenses.filter(
                        (item) => !isClosedFundStatus(item.status)
                      ).length ? (
                        futureExpenses
                          .filter((item) => !isClosedFundStatus(item.status))
                          .map((item) => {
                            const datePassed =
                              !!item.due_date && item.due_date < todayIso();
                            const funded = bucketFundedThrough(
                              item.id,
                              "9999-12-31"
                            );
                            const spent = num(item.actual_funding_spend);
                            const available = funded - spent;

                            return (
                              <div
                                key={item.id}
                                className="border-b border-slate-100 p-3 last:border-0"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-black">
                                      {item.event_fund}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-slate-500">
                                      Due {dateLabel(item.due_date)} · {item.status || "Open"}
                                    </p>
                                    {datePassed && (
                                      <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-800">
                                        Date passed
                                      </span>
                                    )}
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <strong className="block text-sm">
                                      {money(num(item.target_budget))}
                                    </strong>
                                    <span className="text-[10px] text-slate-500">
                                      {money(available)} available
                                    </span>
                                  </div>
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditor({ type: "future", item })
                                    }
                                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-black text-slate-800"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditor({ type: "close-fund", item })
                                    }
                                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-black text-slate-800"
                                  >
                                    Close out
                                  </button>
                                </div>
                              </div>
                            );
                          })
                      ) : (
                        <p className="p-3 text-sm text-slate-500">
                          No open future expenses or sinking funds.
                        </p>
                      )}
                    </div>

                    {futureExpenses.some(
                      (item) => (item.status || "").toLowerCase() === "closed"
                    ) && (
                      <div>
                        <p className="mb-2 px-1 text-xs font-black uppercase tracking-wide text-slate-500">
                          Closed · awaiting removal
                        </p>
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          {futureExpenses
                            .filter(
                              (item) =>
                                (item.status || "").toLowerCase() === "closed"
                            )
                            .map((item) => (
                              <div
                                key={item.id}
                                className="border-b border-slate-200 p-3 last:border-0"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-black">
                                      {item.event_fund}
                                    </p>
                                    <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
                                      Closed
                                      {item.closed_at
                                        ? " " + dateLabel(item.closed_at.slice(0, 10))
                                        : ""}
                                      {num(item.closeout_amount) > 0
                                        ? " · " + money(num(item.closeout_amount)) + " reassigned"
                                        : " · no leftover"}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => void removeClosedSinkingFund(item)}
                                    className="shrink-0 text-xs font-black text-rose-600"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          <div
            aria-hidden="true"
            className="h-40 shrink-0 sm:h-24"
            style={{ height: "calc(10rem + env(safe-area-inset-bottom, 0px))" }}
          />
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

      {deficitDate && (
        <DeficitReviewModal
          preview={deficitPreview}
          loading={deficitLoading}
          saving={deficitSaving}
          error={deficitError}
          onClose={() => {
            if (!deficitSaving) {
              setDeficitDate(null);
              setDeficitPreview(null);
              setDeficitError("");
            }
          }}
          onApply={applyDeficitDecision}
        />
      )}

      {forecastDate && (
        <ForecastPaycheckModal
          paycheck={paychecks.find((row) => row.paycheck_date === forecastDate) || null}
          expenses={forecastExpenses}
          loading={forecastLoading}
          onResolveDeficit={() => void openDeficitReviewForDate(forecastDate)}
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
          item={editor.item}
          currentPaycheck={paycheck.paycheck_date}
          paycheckDates={paycheckDates}
          fundedAmount={
            editor.item
              ? bucketFundedThrough(editor.item.id, "9999-12-31")
              : 0
          }
          saving={saving}
          onClose={() => setEditor(null)}
          onSave={saveFutureGoal}
          onDelete={
            editor.item
              ? () =>
                  deleteBudgetSetupItem(
                    "future",
                    editor.item!.id,
                    editor.item!.event_fund || "Sinking fund"
                  )
              : undefined
          }
        />
      )}

      {editor?.type === "close-fund" && (
        <SinkingFundCloseoutModal
          item={editor.item}
          available={Math.max(
            0,
            bucketFundedThrough(editor.item.id, "9999-12-31") -
              num(editor.item.actual_funding_spend)
          )}
          nextFund={
            futureExpenses
              .filter(
                (item) =>
                  item.id !== editor.item.id &&
                  !isClosedFundStatus(item.status) &&
                  coalesceFundDeadline(item) >= paycheck.paycheck_date
              )
              .sort((a, b) =>
                coalesceFundDeadline(a).localeCompare(coalesceFundDeadline(b))
              )[0] || null
          }
          saving={saving}
          onClose={() => setEditor(null)}
          onSave={closeSinkingFund}
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
          comparisons={spendingComparison}
          planExpenses={expenses}
          initialPlannedExpenseId={editor.plannedExpenseId}
          initialFutureExpenseId={editor.futureExpenseId}
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
          onDelete={
            editor.item
              ? () =>
                  deleteBudgetSetupItem(
                    "recurring",
                    editor.item!.id,
                    editor.item!.item || "Recurring bill"
                  )
              : undefined
          }
        />
      )}

      {editor?.type === "debt" && (
        <DebtEditor
          item={editor.item}
          budgetItems={(() => {
            const seen = new Set<string>();
            const options: Array<{
              value: string;
              label: string;
              group: string;
            }> = [];

            for (const bill of recurringBills) {
              const value = (bill.item || "").trim();
              if (!value) continue;

              const name = value.toLowerCase();
              const category = (bill.category || "").toLowerCase();

              const isCollection =
                name.includes("collection") ||
                name.includes("resurgent") ||
                name.includes("wltmn wnbrg") ||
                name.includes("williams & fudge") ||
                name.includes("spring oaks");
              const isDebtCategory = category === "debt";
              const isMortgage =
                category === "housing" &&
                (name.includes("mortgage") ||
                  name.includes("home equity") ||
                  name.includes("heloc"));
              const isVehicleLoan =
                category === "vehicle" &&
                (name.includes("jeep") ||
                  name.includes("pacifica") ||
                  name.includes("van payment") ||
                  name.includes("car payment") ||
                  name.includes("auto loan") ||
                  name.includes("vehicle loan"));

              if (!isCollection && !isDebtCategory && !isMortgage && !isVehicleLoan) continue;

              const key = value.toLowerCase();
              if (seen.has(key)) continue;
              seen.add(key);

              options.push({
                value,
                label: `${value} — ${money(num(bill.amount))} / ${bill.frequency || "recurring"}`,
                group: isCollection
                  ? "Collections"
                  : isDebtCategory
                    ? "Debt payments"
                    : isMortgage
                      ? "Mortgage / home loans"
                      : "Vehicle loans",
              });
            }

            for (const expense of futurePlanExpenses) {
              const value = (expense.line_item || "").trim();
              if (!value) continue;

              const name = value.toLowerCase();
              const type = (expense.expense_type || "").toLowerCase();

              if (
                type.includes("reserve") ||
                type.includes("sinking") ||
                name.startsWith("reserve ")
              ) {
                continue;
              }

              const isCollection =
                name.includes("collection") ||
                name.includes("resurgent") ||
                name.includes("wltmn wnbrg") ||
                name.includes("williams & fudge") ||
                name.includes("spring oaks");

              if (!isCollection) continue;

              const key = value.toLowerCase();
              if (seen.has(key)) continue;
              seen.add(key);

              options.push({
                value,
                label: value,
                group: "Collections",
              });
            }

            const groupOrder: Record<string, number> = {
              "Collections": 0,
              "Debt payments": 1,
              "Vehicle loans": 2,
              "Mortgage / home loans": 3,
            };

            return options.sort((a, b) => {
              const order =
                (groupOrder[a.group] ?? 99) - (groupOrder[b.group] ?? 99);
              if (order !== 0) return order;
              return a.value.localeCompare(b.value);
            });
          })()}
          saving={saving}
          onClose={() => setEditor(null)}
          onSave={saveDebt}
          onArchive={
            editor.item ? () => archiveDebt(editor.item!) : undefined
          }
          onConfirmPaid={
            editor.item ? () => confirmDebtPaid(editor.item!) : undefined
          }
          onDelete={
            editor.item
              ? () =>
                  deleteBudgetSetupItem(
                    "debt",
                    editor.item!.id,
                    editor.item!.name
                  )
              : undefined
          }
        />
      )}
    </main>
  );
}
