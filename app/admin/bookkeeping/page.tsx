import Link from "next/link";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import {
  createManualBookkeepingTransaction,
  diagnoseSquareBookkeepingTransactions,
  importSquareBankingCsv,
  pullSquareBookkeepingTransactions,
  rebalanceBookkeepingBalances,
  updateBookkeepingTransaction,
} from "./actions";

type PageProps = {
  searchParams?: Promise<{
    notice?: string;
    error?: string;
    type?: string;
    classification?: string;
    review?: string;
  }>;
};

type TransactionRow = {
  id: string;
  transaction_date: string | null;
  type: string;
  classification: string;
  category: string | null;
  description: string | null;
  amount: number;
  payment_method: string | null;
  source: string;
  imported_from: string | null;
  customer_name: string | null;
  product_name: string | null;
  gross_amount: number | null;
  net_amount: number | null;
  square_fee: number | null;
  sales_tax_collected: number | null;
  sales_tax_expected: number | null;
  money_destination: string | null;
  mileage: number | null;
  mileage_deduction: number | null;
  receipt_status: string | null;
  receipt_location: string | null;
  notes: string | null;
  reviewed: boolean;
};

type CategoryRow = {
  name: string;
  type: string;
};

export default async function AdminBookkeepingPage({ searchParams }: PageProps) {
  await requireContentAgentAdmin();

  const params = await searchParams;
  const typeFilter = params?.type || "all";
  const classificationFilter = params?.classification || "all";
  const reviewFilter = params?.review || "all";

  const supabase = createSupabaseAdminClient();
  const [transactionsResult, categoriesResult] = await Promise.all([
    buildTransactionsQuery(supabase, typeFilter, classificationFilter, reviewFilter),
    supabase
      .from("bookkeeping_categories")
      .select("name, type")
      .eq("active", true)
      .order("type", { ascending: true })
      .order("name", { ascending: true })
      .returns<CategoryRow[]>(),
  ]);

  const missingSetup =
    transactionsResult.error?.message?.includes("bookkeeping_transactions") ||
    categoriesResult.error?.message?.includes("bookkeeping_categories");

  if (missingSetup) {
    return <BookkeepingSetupMessage error={transactionsResult.error?.message || categoriesResult.error?.message || ""} />;
  }

  if (transactionsResult.error) throw new Error(transactionsResult.error.message);
  if (categoriesResult.error) throw new Error(categoriesResult.error.message);

  const transactions = (transactionsResult.data || []) as TransactionRow[];
  const categories = categoriesResult.data || [];
  const summary = summarizeTransactions(transactions);

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-[96rem] space-y-6">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/admin" className="text-emerald-300 underline">
            Back to admin
          </Link>
        </div>

        <header className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
            Crested Critters
          </p>
          <h1 className="mt-2 text-3xl font-black">Bookkeeping</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
            Review Square/bank-style transactions, manually add cash or
            personal purchases, and classify anything personal as owner draw
            instead of a business expense.
          </p>
        </header>

        {params?.notice && (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-100">
            <div className="font-semibold">Saved</div>
            <pre className="mt-2 whitespace-pre-wrap text-sm">{params.notice}</pre>
          </div>
        )}

        {params?.error && (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-red-100">
            <div className="font-semibold">Error</div>
            <pre className="mt-2 whitespace-pre-wrap text-sm">{params.error}</pre>
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <StatCard label="Square Ledger Balance" value={summary.squareBalance} money alert={summary.squareBalance < 0} />
          <StatCard label="Cash On Hand" value={summary.cashOnHand} money alert={summary.cashOnHand < 0} />
          <StatCard label="Income" value={summary.income} money />
          <StatCard label="Expenses" value={summary.expenses} money />
          <StatCard label="Owner Contributions" value={summary.ownerContributions} money />
          <StatCard label="Owner Draw / Personal" value={summary.ownerDraws} money alert={summary.ownerDraws > 0} />
          <StatCard label="Miles" value={summary.miles} />
          <StatCard label="Mileage Deduction" value={summary.mileageDeduction} money />
          <StatCard label="Needs Review" value={summary.needsReview} alert={summary.needsReview > 0} />
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
            <h2 className="font-bold">Square Pull</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Pulls 2026 completed payments from every available Square location
              and skips anything already in the ledger.
            </p>
            <form action={pullSquareBookkeepingTransactions} className="mt-4">
              <button className="w-full rounded-md bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300">
                Pull Square Transactions
              </button>
            </form>
            <form action={diagnoseSquareBookkeepingTransactions} className="mt-2">
              <button className="w-full rounded-md border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-bold text-slate-100 hover:border-emerald-300/50">
                Diagnose Square Pull
              </button>
            </form>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
            <h2 className="font-bold">Banking CSV</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Import Square Banking activity that does not appear in Square
              Payments. New rows import as Needs Review.
            </p>
            <form action={importSquareBankingCsv} className="mt-4 grid gap-3">
              <input
                type="file"
                name="banking_csv"
                accept=".csv,text/csv"
                className="rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-100 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-slate-100"
              />
              <button className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300">
                Import Banking CSV
              </button>
            </form>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
            <h2 className="font-bold">Rebalance</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Adds reviewed adjustment rows so the 2026 ledger starts from your
              real available funds.
            </p>
            <form action={rebalanceBookkeepingBalances} className="mt-4 grid gap-3">
              <input
                name="square_balance"
                defaultValue="69.50"
                className="rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-100"
                aria-label="Square balance"
              />
              <input
                name="cash_on_hand"
                defaultValue="100.00"
                className="rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-100"
                aria-label="Cash on hand"
              />
              <button className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300">
                Set Current Balances
              </button>
            </form>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
          <h2 className="font-bold">Add Manual Entry</h2>
          <form action={createManualBookkeepingTransaction} className="mt-3 grid gap-3 lg:grid-cols-[9rem_8rem_12rem_12rem_1fr_8rem_10rem_6rem_7rem_auto]">
              <input
                type="date"
                name="transaction_date"
                className="rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-100"
              />
              <SelectBox name="type" defaultValue="expense" options={["income", "expense", "equity", "tax", "mileage", "transfer"]} />
              <SelectBox name="classification" defaultValue="business" options={["business", "owner_contribution", "owner_draw", "sales_tax", "ignore"]} />
              <input
                name="category"
                placeholder="Category"
                list="bookkeeping-categories"
                className="rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-100"
              />
              <input
                name="description"
                placeholder="Description"
                className="rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-100"
              />
              <input
                name="amount"
                placeholder="Amount"
                className="rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-100"
              />
              <input
                name="payment_method"
                placeholder="cash/personal"
                className="rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-100"
              />
              <input
                name="mileage"
                placeholder="Miles"
                className="rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-100"
              />
              <input
                name="mileage_deduction"
                placeholder="Mileage $"
                className="rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-100"
              />
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" name="reviewed" defaultChecked />
                Reviewed
              </label>
              <textarea
                name="notes"
                placeholder="Notes"
                rows={2}
                className="lg:col-span-9 rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-100"
              />
              <button className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300">
                Add
              </button>
          </form>
        </section>

        <section className="grid gap-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
            <div className="flex flex-wrap gap-2">
              <FilterLink href="/admin/bookkeeping" active={typeFilter === "all" && classificationFilter === "all" && reviewFilter === "all"}>
                All
              </FilterLink>
              {["income", "expense", "equity", "mileage"].map((type) => (
                <FilterLink key={type} href={`/admin/bookkeeping?type=${type}`} active={typeFilter === type}>
                  {type}
                </FilterLink>
              ))}
              <FilterLink href="/admin/bookkeeping?classification=owner_draw" active={classificationFilter === "owner_draw"}>
                Owner Draw
              </FilterLink>
              <FilterLink href="/admin/bookkeeping?classification=owner_contribution" active={classificationFilter === "owner_contribution"}>
                Owner Contributions
              </FilterLink>
              <FilterLink href="/admin/bookkeeping?review=needs" active={reviewFilter === "needs"}>
                Needs Review
              </FilterLink>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.05]">
          <div className="border-b border-white/10 p-4">
            <h2 className="text-lg font-bold">Transaction Ledger</h2>
            <p className="mt-1 text-sm text-slate-400">
              Newest transactions show first. Mark personal/non-business spending
              as Owner Draw / Personal so it stays out of expenses.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1380px] w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Classification</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2">Mileage</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2">Reviewed</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <TransactionRowEditor
                    key={transaction.id}
                    transaction={transaction}
                    categories={categories}
                  />
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-10 text-center text-slate-400">
                      No transactions found for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function buildTransactionsQuery(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  typeFilter: string,
  classificationFilter: string,
  reviewFilter: string
) {
  let query = supabase
    .from("bookkeeping_transactions")
    .select("*")
    .order("transaction_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(300);

  if (typeFilter && typeFilter !== "all") query = query.eq("type", typeFilter);
  if (classificationFilter && classificationFilter !== "all") {
    query = query.eq("classification", classificationFilter);
  }
  if (reviewFilter === "needs") query = query.eq("reviewed", false);

  return query;
}

function summarizeTransactions(transactions: TransactionRow[]) {
  return transactions.reduce(
    (totals, transaction) => {
      if (!transaction.reviewed) totals.needsReview += 1;
      const amount = Number(transaction.amount || 0);
      const paymentLabel = `${transaction.payment_method || ""} ${transaction.money_destination || ""}`.toLowerCase();

      if (paymentLabel.includes("square")) {
        totals.squareBalance += balanceEffect(transaction, amount);
      }
      if (paymentLabel.includes("cash")) {
        totals.cashOnHand += balanceEffect(transaction, amount);
      }

      if (transaction.classification === "ignore") return totals;
      if (transaction.classification === "owner_contribution") {
        totals.ownerContributions += amount;
      } else if (transaction.classification === "owner_draw") {
        totals.ownerDraws += amount;
      } else if (transaction.type === "income") {
        totals.income += amount;
      } else if (transaction.type === "expense" || transaction.type === "mileage") {
        totals.expenses += amount;
      }

      totals.miles += Number(transaction.mileage || 0);
      totals.mileageDeduction += Number(transaction.mileage_deduction || 0);
      return totals;
    },
    {
      income: 0,
      expenses: 0,
      ownerContributions: 0,
      ownerDraws: 0,
      squareBalance: 0,
      cashOnHand: 0,
      miles: 0,
      mileageDeduction: 0,
      needsReview: 0,
    }
  );
}

function balanceEffect(transaction: TransactionRow, amount: number) {
  if (transaction.source === "rebalance") return amount;
  if (transaction.classification === "ignore") return 0;
  if (transaction.classification === "owner_draw") return -amount;
  if (transaction.classification === "owner_contribution") return amount;
  if (transaction.type === "income") return amount;
  if (transaction.type === "expense" || transaction.type === "tax" || transaction.type === "transfer") {
    return -amount;
  }
  return 0;
}

function TransactionRowEditor({
  transaction,
  categories,
}: {
  transaction: TransactionRow;
  categories: CategoryRow[];
}) {
  const formId = `bookkeeping-${transaction.id}`;

  return (
    <tr className={`border-b align-top ${transaction.reviewed ? "border-white/5" : "border-red-400/25 bg-red-500/10"}`}>
      <td className="w-32 px-2 py-2">
        <input
          form={formId}
          type="date"
          name="transaction_date"
          defaultValue={transaction.transaction_date || ""}
          className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1.5 text-sm text-slate-100"
        />
        <div className="mt-1 text-xs text-slate-500">{transaction.imported_from || transaction.source}</div>
      </td>
      <td className="w-24 px-2 py-2">
        <SelectInput form={formId} name="type" defaultValue={transaction.type} options={["income", "expense", "equity", "tax", "mileage", "transfer"]} />
      </td>
      <td className="w-40 px-2 py-2">
        <SelectInput form={formId} name="classification" defaultValue={transaction.classification} options={["business", "owner_contribution", "owner_draw", "sales_tax", "ignore"]} />
      </td>
      <td className="w-44 px-2 py-2">
        <input
          form={formId}
          name="category"
          defaultValue={transaction.category || ""}
          list="bookkeeping-categories"
          className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1.5 text-sm text-slate-100"
        />
        <datalist id="bookkeeping-categories">
          {categories.map((category) => (
            <option key={category.name} value={category.name} />
          ))}
        </datalist>
      </td>
      <td className="min-w-[18rem] px-2 py-2">
        <input
          form={formId}
          name="description"
          defaultValue={transaction.description || ""}
          className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1.5 text-sm text-slate-100"
        />
        {(transaction.customer_name || transaction.product_name) && (
          <div className="mt-1 text-xs text-slate-500">
            {[transaction.customer_name, transaction.product_name].filter(Boolean).join(" / ")}
          </div>
        )}
      </td>
      <td className="w-24 px-2 py-2">
        <input
          form={formId}
          name="amount"
          defaultValue={Number(transaction.amount || 0).toFixed(2)}
          className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1.5 text-right text-sm text-slate-100"
        />
      </td>
      <td className="w-32 px-2 py-2">
        <input
          form={formId}
          name="payment_method"
          defaultValue={transaction.payment_method || transaction.money_destination || ""}
          className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1.5 text-sm text-slate-100"
        />
      </td>
      <td className="w-40 px-2 py-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            form={formId}
            name="mileage"
            defaultValue={transaction.mileage ? Number(transaction.mileage).toFixed(2) : ""}
            placeholder="Miles"
            className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1.5 text-right text-sm text-slate-100"
          />
          <input
            form={formId}
            name="mileage_deduction"
            defaultValue={transaction.mileage_deduction ? Number(transaction.mileage_deduction).toFixed(2) : ""}
            placeholder="$"
            className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1.5 text-right text-sm text-slate-100"
          />
        </div>
        <div className="mt-1 text-xs text-slate-500">miles / deduction</div>
      </td>
      <td className="min-w-[16rem] px-2 py-2">
        <textarea
          form={formId}
          name="notes"
          defaultValue={transaction.notes || ""}
          rows={2}
          className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1.5 text-sm text-slate-100"
        />
        {(transaction.receipt_status || transaction.receipt_location) && (
          <div className="mt-1 text-xs text-slate-500">
            Receipt: {[transaction.receipt_status, transaction.receipt_location].filter(Boolean).join(" / ")}
          </div>
        )}
      </td>
      <td className="w-24 px-2 py-2">
        <label className="flex items-center gap-2">
          <input form={formId} type="checkbox" name="reviewed" defaultChecked={transaction.reviewed} />
          <span className="text-xs">Reviewed</span>
        </label>
      </td>
      <td className="w-20 px-2 py-2">
        <form id={formId} action={updateBookkeepingTransaction}>
          <input type="hidden" name="transaction_id" value={transaction.id} />
          <button className="w-full rounded-md bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950">
            Save
          </button>
        </form>
      </td>
    </tr>
  );
}

function SelectBox({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue: string;
  options: string[];
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-100"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function SelectInput({
  form,
  name,
  defaultValue,
  options,
}: {
  form: string;
  name: string;
  defaultValue: string;
  options: string[];
}) {
  return (
    <select
      form={form}
      name={name}
      defaultValue={defaultValue}
      className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1.5 text-sm text-slate-100"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 text-sm font-semibold ${
        active
          ? "bg-emerald-400 text-slate-950"
          : "border border-white/10 bg-slate-950/70 text-slate-200 hover:border-emerald-300/50"
      }`}
    >
      {children}
    </Link>
  );
}

function StatCard({
  label,
  value,
  money = false,
  alert = false,
}: {
  label: string;
  value: number;
  money?: boolean;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${alert ? "border-amber-400/40 bg-amber-400/10" : "border-white/10 bg-white/[0.05]"}`}>
      <div className="text-2xl font-bold">{money ? formatMoney(value) : value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function BookkeepingSetupMessage({ error }: { error: string }) {
  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-4xl rounded-lg border border-amber-400/30 bg-amber-400/10 p-6">
        <h1 className="text-2xl font-black text-amber-100">Bookkeeping setup needed</h1>
        <p className="mt-3 text-sm leading-6 text-amber-50/90">
          The bookkeeping database tables are not available yet. Apply the new
          Supabase migration, then come back and connect Square or add manual rows.
        </p>
        <p className="mt-4 rounded-md bg-black/20 p-3 text-xs text-amber-50/80">
          Migration: supabase/migrations/20260517_bookkeeping.sql
        </p>
        {error && (
          <pre className="mt-4 whitespace-pre-wrap rounded-md bg-black/30 p-3 text-xs text-amber-50/80">
            {error}
          </pre>
        )}
      </div>
    </main>
  );
}
