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
  event_fund: string | null;
  due_date: string | null;
  target_budget: number | string | null;
  remaining_actual: number | string | null;
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

type View = "home" | "plan" | "reviews" | "more";
type Editor =
  | { type: "expense"; item?: Expense }
  | { type: "recurring"; item?: RecurringBill }
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
  const [paycheckDates, setPaycheckDates] = useState<string[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [futureExpenses, setFutureExpenses] = useState<FutureExpense[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
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
      .select("paycheck_date,projected_check,actual_check,period_status,planned_spending,actual_spending,reserve_change,running_cash_goal_pool")
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

    const [expenseResult, peopleResult, futureResult, recurringResult] =
      await Promise.all([
        supabase
          .from("budget_expenses")
          .select("id,due_date,assigned_paycheck,category,line_item,expense_type,frequency,planned_amount,actual_amount,status,notes,event_fund")
          .eq("assigned_paycheck", selected.paycheck_date)
          .order("due_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("budget_people")
          .select("name,default_discretionary")
          .eq("active", true)
          .order("name", { ascending: true }),
        supabase
          .from("budget_future_expenses")
          .select("event_fund,due_date,target_budget,remaining_actual,status")
          .order("due_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("budget_recurring_bills")
          .select("id,category,item,amount,frequency,monthly_equivalent,due_timing,active,notes")
          .eq("active", true)
          .order("category", { ascending: true })
          .order("item", { ascending: true }),
      ]);

    const firstError =
      expenseResult.error ||
      peopleResult.error ||
      futureResult.error ||
      recurringResult.error;

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setPaycheck(selected);
    setPaycheckDates(paychecks.map((row) => row.paycheck_date));
    setExpenses((expenseResult.data || []) as Expense[]);
    setPeople((peopleResult.data || []) as Person[]);
    setFutureExpenses((futureResult.data || []) as FutureExpense[]);
    setRecurringBills((recurringResult.data || []) as RecurringBill[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadData(true);
  }, []);

  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paycheck || editor?.type !== "expense") return;

    setSaving(true);
    setNotice("");
    setError("");

    const data = new FormData(event.currentTarget);
    const payload = {
      line_item: String(data.get("line_item") || "").trim(),
      planned_amount: Number(data.get("planned_amount") || 0),
      due_date: String(data.get("due_date") || paycheck.paycheck_date),
      assigned_paycheck: String(
        data.get("assigned_paycheck") || paycheck.paycheck_date
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

    setEditor(null);
    setNotice(editor.item ? "Expense updated." : "Expense added.");
    await loadData();
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

  const income = num(paycheck?.actual_check) || num(paycheck?.projected_check);
  const planned = num(paycheck?.planned_spending);
  const availableExtra = income - planned;

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
            <button
              onClick={() => setEditor({ type: "expense" })}
              className="rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-950"
            >
              + Expense
            </button>
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

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <Stat label="Income" value={money(income)} />
                  <Stat label="Planned" value={money(planned)} />
                  <Stat
                    label="Available extra"
                    value={money(availableExtra)}
                    highlight
                    danger={availableExtra < 0}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-slate-300">
                  <span>
                    Includes {money(currentEach)} each for Chris + Jen
                  </span>
                  <strong
                    className={
                      availableExtra < 0 ? "text-rose-300" : "text-emerald-300"
                    }
                  >
                    {availableExtra < 0 ? "Needs adjustment" : "On plan"}
                  </strong>
                </div>
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
                  + Expense
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
                <div className="grid grid-cols-3 gap-2">
                  <ReviewStat label="Paycheck" value={money(income)} />
                  <ReviewStat label="Planned" value={money(planned)} />
                  <ReviewStat label="Extra" value={money(availableExtra)} />
                </div>

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
                </div>
              </article>
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

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto grid max-w-xl grid-cols-4 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        {[
          ["home", "⌂", "Home"],
          ["plan", "▤", "Plan"],
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

      {editor?.type === "expense" && (
        <ExpenseEditor
          item={editor.item}
          currentPaycheck={paycheck.paycheck_date}
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
