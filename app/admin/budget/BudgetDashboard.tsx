"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  category: string | null;
  item: string | null;
  amount: number | string | null;
  frequency: string | null;
  due_timing: string | null;
  active: boolean | null;
};

type View = "home" | "plan" | "reviews" | "more";

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

export default function BudgetDashboard() {
  const [view, setView] = useState<View>("home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paycheck, setPaycheck] = useState<Paycheck | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [futureExpenses, setFutureExpenses] = useState<FutureExpense[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [chrisApproved, setChrisApproved] = useState(false);
  const [jenApproved, setJenApproved] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      if (window.location.hostname !== "admin.crestedcritters.com") {
        window.location.replace("https://admin.crestedcritters.com/budget");
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        window.location.replace("/login");
        return;
      }

      const { data: adminProfile } = await supabase
        .from("admin_profiles")
        .select("id")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (!adminProfile) {
        window.location.replace("/login");
        return;
      }

      const today = new Date();
      const localToday = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
      ].join("-");

      const { data: upcoming, error: paycheckError } = await supabase
        .from("budget_paychecks")
        .select("paycheck_date,projected_check,actual_check,period_status,planned_spending,actual_spending,reserve_change,running_cash_goal_pool")
        .gte("paycheck_date", localToday)
        .order("paycheck_date", { ascending: true })
        .limit(1)
        .maybeSingle();

      const selected = upcoming as Paycheck | null;

      if (!selected || paycheckError) {
        if (active) {
          setError(paycheckError?.message || "No upcoming paycheck was found.");
          setLoading(false);
        }
        return;
      }

      const [
        expenseResult,
        peopleResult,
        futureResult,
        recurringResult,
      ] = await Promise.all([
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
          .select("category,item,amount,frequency,due_timing,active")
          .eq("active", true)
          .order("item", { ascending: true }),
      ]);

      const firstError =
        expenseResult.error ||
        peopleResult.error ||
        futureResult.error ||
        recurringResult.error;

      if (firstError) {
        if (active) {
          setError(firstError.message);
          setLoading(false);
        }
        return;
      }

      if (active) {
        setPaycheck(selected);
        setExpenses((expenseResult.data || []) as Expense[]);
        setPeople((peopleResult.data || []) as Person[]);
        setFutureExpenses((futureResult.data || []) as FutureExpense[]);
        setRecurringBills((recurringResult.data || []) as RecurringBill[]);
        setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

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
      ? people.reduce((sum, person) => sum + num(person.default_discretionary), 0) /
        people.length
      : 200;

  const basePlanWithoutDiscretionary = planned - discretionaryTotal;
  const baseExtra = income - basePlanWithoutDiscretionary;
  const suggestedEach =
    availableExtra >= 0
      ? currentEach
      : Math.max(0, Math.min(currentEach, Math.floor(baseExtra / 2 / 25) * 25));
  const suggestedExtra = income - basePlanWithoutDiscretionary - suggestedEach * 2;

  const reviewText = useMemo(() => {
    if (!paycheck) return "";
    if (availableExtra >= 250) {
      return `This paycheck leaves ${money(availableExtra)} after the current plan, including ${money(currentEach)} each for Chris and Jen. No discretionary cut is needed based on the current numbers.`;
    }
    if (availableExtra >= 0) {
      return `The plan fits, but only ${money(availableExtra)} remains. The current ${money(currentEach)} each is possible, but the review should consider whether some of that would be better held as cushion.`;
    }
    if (baseExtra < 0) {
      return `The current plan is ${money(Math.abs(availableExtra))} short. Even reducing both discretionary allowances to $0 would still leave the core plan ${money(Math.abs(baseExtra))} short, so another planned expense also needs to move, shrink, or be deferred.`;
    }
    return `The current plan is ${money(Math.abs(availableExtra))} short with ${money(currentEach)} each in discretionary spending. A temporary allowance of about ${money(suggestedEach)} each would bring this paycheck back inside the available income.`;
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

  if (error || !paycheck) {
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
            <span className="rounded-full bg-emerald-300 px-2.5 py-1 text-[10px] font-black tracking-wider text-emerald-950">
              LIVE DATA
            </span>
          </div>
        </header>

        <div className="space-y-4 p-3 sm:p-4">
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
                    <ExpenseRow key={expense.id} expense={expense} />
                  ))}
                </div>
              </section>
            </>
          )}

          {view === "plan" && (
            <>
              <SectionTitle
                title="Plan"
                subtitle={`Everything assigned to the ${dateLabel(
                  paycheck.paycheck_date
                )} paycheck.`}
              />
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-900 p-3 text-white">
                <MiniStat label="Income" value={money(income)} />
                <MiniStat label="Planned" value={money(planned)} />
                <MiniStat label="Extra" value={money(availableExtra)} />
              </div>

              <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                {expenses.map((expense) => (
                  <ExpenseRow key={expense.id} expense={expense} />
                ))}
              </div>
            </>
          )}

          {view === "reviews" && (
            <>
              <SectionTitle
                title="Paycheck Review"
                subtitle="Built from the imported budget data."
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
                subtitle="Imported recurring bills, goals, and future expenses."
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
                <h3 className="font-black">Recurring bills</h3>
                <div className="mt-3 space-y-3">
                  {recurringBills.map((bill) => (
                    <div
                      key={bill.item || Math.random()}
                      className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-black">{bill.item}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {bill.category || "Other"} · {bill.frequency || "Recurring"} · {bill.due_timing || "Timing TBD"}
                        </p>
                      </div>
                      <strong className="text-sm">{money(num(bill.amount))}</strong>
                    </div>
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
    </main>
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

function ExpenseRow({ expense }: { expense: Expense }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-3.5 last:border-0">
      <div>
        <p className="text-sm font-black">
          {expense.line_item || "Unnamed expense"}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {dateLabel(expense.due_date)}
          {expense.category ? ` · ${expense.category}` : ""}
          {expense.status ? ` · ${expense.status}` : ""}
        </p>
      </div>
      <strong className="text-sm">
        {money(num(expense.actual_amount) || num(expense.planned_amount))}
      </strong>
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
