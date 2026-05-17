import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import BillingClient from "./BillingClient";

type Account = {
  credits: number;
  access_expires_at: string | null;
  lifetime_access: boolean;
};

export const metadata = {
  title: "Randomizer Billing",
  description: "Buy Randomizer access or credits with Square.",
};

function accessLabel(account: Account | null) {
  if (account?.lifetime_access) return "Lifetime access active";
  if (account?.access_expires_at) {
    const expires = new Date(account.access_expires_at);
    if (expires.getTime() > Date.now()) {
      return `Access active until ${expires.toLocaleDateString()}`;
    }
  }

  return "No active access plan";
}

export default async function RandomizerBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/randomizer/billing");
  }

  const { data: account } = await supabase
    .from("randomizer_accounts")
    .select("credits, access_expires_at, lifetime_access")
    .eq("user_id", user.id)
    .maybeSingle<Account>();

  return (
    <main className="min-h-screen bg-[#07130c] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-300">
            Randomizer
          </p>
          <h1 className="mt-2 text-4xl font-black">Access & Credits</h1>
          <p className="mt-3 max-w-3xl leading-7 text-emerald-50/70">
            Buy unlimited access for a time period, or buy credits for occasional use. Credits never expire and one official result costs one credit when you do not have active access.
          </p>

          {params.checkout === "success" && (
            <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
              Payment is being confirmed by Square. Refresh in a moment if your access or credits have not appeared yet.
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-emerald-50/60">Current access</p>
              <p className="mt-1 font-black text-emerald-100">{accessLabel(account)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-emerald-50/60">Credits</p>
              <p className="mt-1 font-black text-emerald-100">{account?.credits || 0}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="rounded-xl bg-emerald-300 px-5 py-3 font-black text-slate-950 hover:bg-emerald-200" href="/randomizer">
              Back to Randomizer
            </Link>
          </div>
        </header>

        <BillingClient cleanBillingPath="https://randomizer.crestedcritters.com/billing" />
      </div>
    </main>
  );
}
