import Link from "next/link";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import {
  importCurrentGoogleSheetBookkeeping,
  updateBookkeepingTransaction,
} from "./actions";

type PageProps = {
  searchParams?: Promise<{
    notice?: string;
    error?: string;
    type?: string;
    classification?: string;
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

  const supabase = createSupabaseAdminClient();
  const [transactionsResult, categoriesResult] = await Promise.all([
    buildTransactionsQuery(supabase, typeFilter, classificationFilter),
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
            Import the current Google Sheet, review Square/bank-style
            transactions, and classify anything personal as owner draw instead
            of a business expense.
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

        <section className="grid gap-3 md:grid-cols-5">
          <StatCard label="Income" value={summary.income} money />
          <StatCard label="Expenses" value={summary.expenses} money />
          <StatCard label="Owner Contributions" value={summary.ownerContributions} money />
          <StatCard label="Owner Draw / Personal" value={summary.ownerDraws} money alert={summary.ownerDraws > 0} />
          <StatCard label="Needs Review" value={summary.needsReview} alert={summary.needsReview > 0} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_24rem]">
          <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
            <div className="flex flex-wrap gap-2">
              <FilterLink href="/admin/bookkeeping" active={typeFilter === "all" && classificationFilter === "all"}>
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
            </div>
          </div>

          <form action={importCurrentGoogleSheetBookkeeping} className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4">
            <h2 className="font-bold text-emerald-100">Import Current Sheet</h2>
            <p className="mt-1 text-sm leading-6 text-emerald-100/80">
              Pulls the Expenses and Sales tabs from your Google Sheet and
              upserts them by source row.
            </p>
            <button className="mt-3 rounded-md bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300">
              Import Google Sheet Rows
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.05]">
          <div className="border-b border-white/10 p-4">
            <h2 className="text-lg font-bold">Transaction Ledger</h2>
            <p className="mt-1 text-sm text-slate-400">
              Mark personal/non-business spending as Owner Draw / Personal. That
              keeps it out of expenses and subtracts it from owner equity.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1400px] w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Classification</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2">Receipt</th>
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
                      No transactions yet. Import the Google Sheet to load the current rows.
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
  classificationFilter: string
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

  return query;
}

function summarizeTransactions(transactions: TransactionRow[]) {
  return transactions.reduce(
    (totals, transaction) => {
      if (!transaction.reviewed) totals.needsReview += 1;
      if (transaction.classification === "ignore") return totals;
      if (transaction.classification === "owner_contribution") {
        totals.ownerContributions += Number(transaction.amount || 0);
      } else if (transaction.classification === "owner_draw") {
        totals.ownerDraws += Number(transaction.amount || 0);
      } else if (transaction.type === "income") {
        totals.income += Number(transaction.amount || 0);
      } else if (transaction.type === "expense" || transaction.type === "mileage") {
        totals.expenses += Number(transaction.amount || 0);
      }
      return totals;
    },
    { income: 0, expenses: 0, ownerContributions: 0, ownerDraws: 0, needsReview: 0 }
  );
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
    <tr className="border-b border-white/5 align-top">
      <td className="w-36 px-3 py-3">
        <input
          form={formId}
          type="date"
          name="transaction_date"
          defaultValue={transaction.transaction_date || ""}
          className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-slate-100"
        />
        <div className="mt-1 text-xs text-slate-500">{transaction.imported_from || transaction.source}</div>
      </td>
      <td className="w-32 px-3 py-3">
        <SelectInput form={formId} name="type" defaultValue={transaction.type} options={["income", "expense", "equity", "tax", "mileage", "transfer"]} />
      </td>
      <td className="w-48 px-3 py-3">
        <SelectInput form={formId} name="classification" defaultValue={transaction.classification} options={["business", "owner_contribution", "owner_draw", "sales_tax", "ignore"]} />
      </td>
      <td className="w-56 px-3 py-3">
        <input
          form={formId}
          name="category"
          defaultValue={transaction.category || ""}
          list="bookkeeping-categories"
          className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-slate-100"
        />
        <datalist id="bookkeeping-categories">
          {categories.map((category) => (
            <option key={category.name} value={category.name} />
          ))}
        </datalist>
      </td>
      <td className="min-w-[22rem] px-3 py-3">
        <input
          form={formId}
          name="description"
          defaultValue={transaction.description || ""}
          className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-slate-100"
        />
        {(transaction.customer_name || transaction.product_name) && (
          <div className="mt-1 text-xs text-slate-500">
            {[transaction.customer_name, transaction.product_name].filter(Boolean).join(" / ")}
          </div>
        )}
      </td>
      <td className="w-32 px-3 py-3">
        <input
          form={formId}
          name="amount"
          defaultValue={Number(transaction.amount || 0).toFixed(2)}
          className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-right text-slate-100"
        />
      </td>
      <td className="w-40 px-3 py-3">
        <input
          form={formId}
          name="payment_method"
          defaultValue={transaction.payment_method || transaction.money_destination || ""}
          className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-slate-100"
        />
      </td>
      <td className="w-44 px-3 py-3">
        <input
          form={formId}
          name="receipt_status"
          defaultValue={transaction.receipt_status || ""}
          placeholder="yes/no"
          className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-slate-100"
        />
        <input
          form={formId}
          name="receipt_location"
          defaultValue={transaction.receipt_location || ""}
          placeholder="email/folder"
          className="mt-2 w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-slate-100"
        />
      </td>
      <td className="min-w-[20rem] px-3 py-3">
        <textarea
          form={formId}
          name="notes"
          defaultValue={transaction.notes || ""}
          rows={3}
          className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-slate-100"
        />
      </td>
      <td className="w-28 px-3 py-3">
        <label className="flex items-center gap-2">
          <input form={formId} type="checkbox" name="reviewed" defaultChecked={transaction.reviewed} />
          <span className="text-xs">Reviewed</span>
        </label>
      </td>
      <td className="w-28 px-3 py-3">
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
      className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-slate-100"
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
          Supabase migration, then come back and import the Google Sheet rows.
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
