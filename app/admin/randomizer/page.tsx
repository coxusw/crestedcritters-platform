import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";

type RandomizerAccount = {
  user_id: string;
  credits: number;
  access_expires_at: string | null;
  lifetime_access: boolean;
  created_at: string;
  updated_at: string;
};

type RandomizerOrder = {
  id: string;
  user_id: string;
  package_name: string;
  amount_cents: number;
  status: string;
  created_at: string;
  completed_at: string | null;
};

type AuthUserSummary = {
  id: string;
  email: string;
  created_at?: string;
  last_sign_in_at?: string;
  user_metadata?: Record<string, unknown>;
};

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function numberValue(value: FormDataEntryValue | null) {
  const numeric = Number(String(value || "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "None";
  return new Date(value).toLocaleString();
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(cents || 0) / 100);
}

function accessLabel(account?: RandomizerAccount) {
  if (!account) return "No account row";
  if (account.lifetime_access) return "Lifetime";
  if (!account.access_expires_at) return "No active time";

  const expires = new Date(account.access_expires_at);
  const diffMs = expires.getTime() - Date.now();

  if (diffMs <= 0) return `Expired ${formatDateTime(account.access_expires_at)}`;

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.ceil((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return `${days}d ${hours}h left`;
}

function addDaysFromBase(currentExpiry: string | null, daysToAdd: number) {
  const now = new Date();
  const current = currentExpiry ? new Date(currentExpiry) : null;
  const base = current && current > now ? current : now;
  base.setDate(base.getDate() + daysToAdd);
  return base.toISOString();
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: adminProfile } = await supabase
    .from("admin_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminProfile) redirect("/admin/login");
}

async function getRandomizerAdminData() {
  const supabase = createSupabaseAdminClient();

  const [{ data: accounts }, { data: orders }, usersResult] = await Promise.all([
    supabase
      .from("randomizer_accounts")
      .select("user_id, credits, access_expires_at, lifetime_access, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .returns<RandomizerAccount[]>(),
    supabase
      .from("randomizer_orders")
      .select("id, user_id, package_name, amount_cents, status, created_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<RandomizerOrder[]>(),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const users = (usersResult.data?.users || []).map((user) => ({
    id: user.id,
    email: user.email || "No email",
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    user_metadata: user.user_metadata || {},
  })) as AuthUserSummary[];

  return {
    accounts: accounts || [],
    orders: orders || [],
    users,
  };
}

async function adjustRandomizerAccount(formData: FormData) {
  "use server";

  await requireAdmin();

  const userId = cleanText(formData.get("user_id"));
  const daysToAdd = Math.max(0, Math.floor(numberValue(formData.get("days_to_add"))));
  const creditsToAdd = Math.floor(numberValue(formData.get("credits_to_add")));
  const lifetimeMode = cleanText(formData.get("lifetime_mode"));
  const clearExpiry = formData.get("clear_expiry") === "on";

  if (!userId) redirect("/admin/randomizer?error=missing-user");

  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("randomizer_accounts")
    .select("credits, access_expires_at, lifetime_access")
    .eq("user_id", userId)
    .maybeSingle<Pick<RandomizerAccount, "credits" | "access_expires_at" | "lifetime_access">>();

  const nextCredits = Math.max(0, Number(existing?.credits || 0) + creditsToAdd);
  const nextLifetime =
    lifetimeMode === "grant"
      ? true
      : lifetimeMode === "remove"
        ? false
        : Boolean(existing?.lifetime_access);

  const nextExpiry = clearExpiry
    ? null
    : daysToAdd > 0
      ? addDaysFromBase(existing?.access_expires_at || null, daysToAdd)
      : existing?.access_expires_at || null;

  const { error } = await supabase.from("randomizer_accounts").upsert({
    user_id: userId,
    credits: nextCredits,
    lifetime_access: nextLifetime,
    access_expires_at: nextExpiry,
    updated_at: new Date().toISOString(),
  });

  if (error) redirect(`/admin/randomizer?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/randomizer");
  redirect("/admin/randomizer?updated=true");
}

async function createRandomizerUser(formData: FormData) {
  "use server";

  await requireAdmin();

  const email = cleanText(formData.get("email")).toLowerCase();
  const password = cleanText(formData.get("password"));
  const daysToAdd = Math.max(0, Math.floor(numberValue(formData.get("days_to_add"))));
  const credits = Math.max(0, Math.floor(numberValue(formData.get("credits"))));
  const lifetimeAccess = formData.get("lifetime_access") === "on";

  if (!email || !password) redirect("/admin/randomizer?error=missing-new-user");
  if (password.length < 6) redirect("/admin/randomizer?error=password-too-short");

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      force_password_change: true,
      randomizer_admin_created: true,
    },
  });

  if (error || !data.user) {
    redirect(`/admin/randomizer?error=${encodeURIComponent(error?.message || "create-user-failed")}`);
  }

  const { error: accountError } = await supabase.from("randomizer_accounts").upsert({
    user_id: data.user.id,
    credits,
    lifetime_access: lifetimeAccess,
    access_expires_at: daysToAdd > 0 ? addDaysFromBase(null, daysToAdd) : null,
    updated_at: new Date().toISOString(),
  });

  if (accountError) {
    redirect(`/admin/randomizer?error=${encodeURIComponent(accountError.message)}`);
  }

  revalidatePath("/admin/randomizer");
  redirect("/admin/randomizer?created=true");
}

async function deletePendingRandomizerOrder(formData: FormData) {
  "use server";

  await requireAdmin();

  const orderId = cleanText(formData.get("order_id"));

  if (!orderId) redirect("/admin/randomizer?error=missing-order");

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("randomizer_orders")
    .delete()
    .eq("id", orderId)
    .eq("status", "pending");

  if (error) {
    redirect(`/admin/randomizer?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/randomizer");
  redirect("/admin/randomizer?deleted=true");
}

export default async function AdminRandomizerPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; created?: string; deleted?: string; error?: string; q?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const query = cleanText(params.q || "").toLowerCase();
  const { accounts, orders, users } = await getRandomizerAdminData();
  const accountByUserId = new Map(accounts.map((account) => [account.user_id, account]));
  const usersWithAccounts = users
    .filter((user) => accountByUserId.has(user.id))
    .filter((user) => {
      if (!query) return true;
      return user.email.toLowerCase().includes(query) || user.id.includes(query);
    });
  const recentOrdersByUser = new Map<string, RandomizerOrder[]>();

  for (const order of orders) {
    const userOrders = recentOrdersByUser.get(order.user_id) || [];
    userOrders.push(order);
    recentOrdersByUser.set(order.user_id, userOrders);
  }

  const activeAccounts = accounts.filter(
    (account) =>
      account.lifetime_access ||
      (account.access_expires_at && new Date(account.access_expires_at) > new Date())
  );
  const lifetimeAccounts = accounts.filter((account) => account.lifetime_access);
  const creditTotal = accounts.reduce((total, account) => total + Number(account.credits || 0), 0);

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="text-sm font-bold text-emerald-300">
            Back to admin
          </Link>
          <div className="flex flex-wrap gap-2 text-sm font-bold">
            <Link className="rounded-md border border-white/10 px-3 py-2 hover:bg-white/10" href="/randomizer">
              Open Randomizer
            </Link>
            <Link className="rounded-md border border-white/10 px-3 py-2 hover:bg-white/10" href="/randomizer/billing">
              Billing Page
            </Link>
          </div>
        </div>

        <header className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
            Live
          </p>
          <h1 className="mt-2 text-3xl font-black">Randomizer Admin</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Manage Randomizer access, credits, lifetime accounts, and admin-created temp-password users.
          </p>
        </header>

        {params.updated === "true" && <Notice tone="success" text="Randomizer account updated." />}
        {params.created === "true" && <Notice tone="success" text="Randomizer user created. They must change the temporary password after login." />}
        {params.deleted === "true" && <Notice tone="success" text="Pending Randomizer order deleted." />}
        {params.error && <Notice tone="error" text={decodeURIComponent(params.error)} />}

        <section className="grid gap-4 md:grid-cols-4">
          <Metric label="Accounts" value={accounts.length} />
          <Metric label="Active" value={activeAccounts.length} />
          <Metric label="Lifetime" value={lifetimeAccounts.length} />
          <Metric label="Credits" value={creditTotal} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <CreateUserPanel />
          <RecentOrdersPanel orders={orders} users={users} />
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-black">Randomizer Profiles</h2>
              <p className="mt-2 text-sm text-slate-300">
                Accounts with Randomizer billing/access rows.
              </p>
            </div>
            <form className="flex gap-2">
              <input
                name="q"
                defaultValue={params.q || ""}
                placeholder="Search email or user id"
                className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none ring-emerald-400/30 focus:ring-4 md:w-72"
              />
              <button className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-300">
                Search
              </button>
            </form>
          </div>

          <div className="mt-5 grid gap-4">
            {usersWithAccounts.length > 0 ? (
              usersWithAccounts.map((user) => (
                <AccountCard
                  key={user.id}
                  user={user}
                  account={accountByUserId.get(user.id)}
                  orders={recentOrdersByUser.get(user.id) || []}
                />
              ))
            ) : (
              <p className="rounded-md border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                No Randomizer accounts found.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Notice({ tone, text }: { tone: "success" | "error"; text: string }) {
  return (
    <div
      className={`rounded-lg border p-4 text-sm font-bold ${
        tone === "success"
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
          : "border-red-400/30 bg-red-500/10 text-red-100"
      }`}
    >
      {text}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function CreateUserPanel() {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
      <h2 className="text-xl font-black">Create Randomizer User</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Create a confirmed account with a temporary password. On login, the user will be sent to change it.
      </p>
      <form action={createRandomizerUser} className="mt-5 grid gap-3">
        <label className="grid gap-1 text-sm font-bold">
          Email
          <input name="email" type="email" required className="rounded-md border border-white/10 bg-black/20 px-3 py-2 outline-none ring-emerald-400/30 focus:ring-4" />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          Temporary Password
          <input name="password" type="text" minLength={6} required className="rounded-md border border-white/10 bg-black/20 px-3 py-2 outline-none ring-emerald-400/30 focus:ring-4" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold">
            Initial Days
            <input name="days_to_add" type="number" min={0} defaultValue={0} className="rounded-md border border-white/10 bg-black/20 px-3 py-2 outline-none ring-emerald-400/30 focus:ring-4" />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Initial Credits
            <input name="credits" type="number" min={0} defaultValue={0} className="rounded-md border border-white/10 bg-black/20 px-3 py-2 outline-none ring-emerald-400/30 focus:ring-4" />
          </label>
        </div>
        <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm font-bold">
          <input name="lifetime_access" type="checkbox" />
          Lifetime access
        </label>
        <button className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-emerald-300">
          Create User
        </button>
      </form>
    </section>
  );
}

function RecentOrdersPanel({ orders, users }: { orders: RandomizerOrder[]; users: AuthUserSummary[] }) {
  const emailByUserId = new Map(users.map((user) => [user.id, user.email]));
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
      <h2 className="text-xl font-black">Recent Orders</h2>
      <div className="mt-4 grid gap-2">
        {orders.length > 0 ? (
          orders.slice(0, 8).map((order) => (
            <div key={order.id} className="rounded-md border border-white/10 bg-black/20 p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-black">{order.package_name}</span>
                <span className="text-emerald-200">{formatMoney(order.amount_cents)}</span>
              </div>
              <p className="mt-1 text-slate-300">{emailByUserId.get(order.user_id) || order.user_id}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {order.status} - {formatDateTime(order.completed_at || order.created_at)}
                </p>
                {order.status === "pending" && (
                  <form action={deletePendingRandomizerOrder}>
                    <input type="hidden" name="order_id" value={order.id} />
                    <button
                      className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-black text-red-100 hover:bg-red-500/20"
                      type="submit"
                    >
                      Delete Pending
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-white/10 bg-black/20 p-3 text-sm text-slate-300">No orders yet.</p>
        )}
      </div>
    </section>
  );
}

function AccountCard({
  user,
  account,
  orders,
}: {
  user: AuthUserSummary;
  account?: RandomizerAccount;
  orders: RandomizerOrder[];
}) {
  const forceChange = Boolean(user.user_metadata?.force_password_change);

  return (
    <article className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-white">{user.email}</h3>
            {account?.lifetime_access && <Badge text="Lifetime" tone="emerald" />}
            {forceChange && <Badge text="Must change password" tone="amber" />}
          </div>
          <p className="mt-1 break-all text-xs text-slate-500">{user.id}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Info label="Access" value={accessLabel(account)} />
            <Info label="Credits" value={String(account?.credits || 0)} />
            <Info label="Expires" value={formatDateTime(account?.access_expires_at)} />
          </div>

          <div className="mt-4 grid gap-2 text-sm text-slate-300">
            <p>Created: {formatDateTime(user.created_at)}</p>
            <p>Last sign in: {formatDateTime(user.last_sign_in_at)}</p>
            <p>Recent orders: {orders.length}</p>
          </div>
        </div>

        <form action={adjustRandomizerAccount} className="grid gap-3 rounded-md border border-white/10 bg-[#08110d] p-4">
          <input type="hidden" name="user_id" value={user.id} />
          <h4 className="font-black">Manual Adjustment</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold">
              Add Days
              <input name="days_to_add" type="number" min={0} defaultValue={0} className="rounded-md border border-white/10 bg-black/20 px-3 py-2 outline-none ring-emerald-400/30 focus:ring-4" />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Add Credits
              <input name="credits_to_add" type="number" defaultValue={0} className="rounded-md border border-white/10 bg-black/20 px-3 py-2 outline-none ring-emerald-400/30 focus:ring-4" />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-bold">
            Lifetime
            <select name="lifetime_mode" defaultValue="keep" className="rounded-md border border-white/10 bg-black/20 px-3 py-2 outline-none ring-emerald-400/30 focus:ring-4">
              <option value="keep">No change</option>
              <option value="grant">Grant lifetime</option>
              <option value="remove">Remove lifetime</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-300">
            <input name="clear_expiry" type="checkbox" />
            Clear time expiry
          </label>
          <button className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-300">
            Save Adjustment
          </button>
        </form>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-100">{value}</p>
    </div>
  );
}

function Badge({ text, tone }: { text: string; tone: "emerald" | "amber" }) {
  return (
    <span
      className={`rounded-full border px-2 py-1 text-xs font-black ${
        tone === "emerald"
          ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
          : "border-amber-300/30 bg-amber-300/10 text-amber-100"
      }`}
    >
      {text}
    </span>
  );
}
