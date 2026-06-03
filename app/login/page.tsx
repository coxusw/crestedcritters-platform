import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeNextPath(value: string, fallback = "/isopedia") {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  return value;
}

function appQuery(app: string) {
  return app ? `&app=${encodeURIComponent(app)}` : "";
}

async function signIn(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();

  const email = cleanText(formData.get("email"));
  const password = cleanText(formData.get("password"));
  const app = cleanText(formData.get("app"));
  const fallback = app === "randomizer" ? "/" : "/isopedia";
  const next = safeNextPath(cleanText(formData.get("next")), fallback);

  if (!email || !password) {
    redirect(`/login?error=missing-fields&next=${encodeURIComponent(next)}${appQuery(app)}`);
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=login-failed&next=${encodeURIComponent(next)}${appQuery(app)}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.user_metadata?.force_password_change) {
    const forceNext = `/update-password?force=1&next=${encodeURIComponent(next)}${appQuery(app)}`;
    redirect(forceNext);
  }

  redirect(next);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    next?: string;
    app?: string;
  }>;
}) {
  const params = await searchParams;
  const isRandomizer = params.app === "randomizer";
  const next = safeNextPath(params.next || "", isRandomizer ? "/" : "/isopedia");

  return (
    <main className="min-h-screen bg-[#07130c] px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-300">
            {isRandomizer ? "Randomizer" : "Isopedia"}
          </p>

          <h1 className="mt-3 text-4xl font-black text-white">Sign In</h1>

          <p className="mt-4 text-base leading-7 text-emerald-50/70">
            {isRandomizer
              ? "Sign in to use the official Randomizer."
              : "Sign in to contribute to Isopedia."}
          </p>
        </div>

        {params.error === "missing-fields" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Please enter an email and password.
          </div>
        )}

        {params.error === "login-failed" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Login failed. Check your email and password.
          </div>
        )}

        <form
          action={signIn}
          className="rounded-3xl border border-white/10 bg-[#102016] p-6 shadow-2xl shadow-black/30"
        >
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="app" value={params.app || ""} />

          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-emerald-100">Email</span>

              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none ring-emerald-400/30 transition placeholder:text-emerald-50/30 focus:ring-4"
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-emerald-100">
                Password
              </span>

              <input
                type="password"
                name="password"
                placeholder="Your password"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none ring-emerald-400/30 transition placeholder:text-emerald-50/30 focus:ring-4"
                required
              />
            </label>
          </div>

          <div className="mt-3 text-right">
            <Link
              href={isRandomizer ? "/reset-password?app=randomizer" : "/reset-password"}
              className="text-sm font-semibold text-emerald-300 hover:text-emerald-200"
            >
              Forgot password?
            </Link>
          </div>

          <div className="mt-8 grid gap-3">
            <button
              type="submit"
              className="rounded-2xl bg-emerald-400 px-6 py-3 font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Sign In
            </button>
          </div>
        </form>

        <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
          <Link
            href={`/signup?next=${encodeURIComponent(next)}${appQuery(params.app || "")}`}
            className="font-bold text-emerald-300 hover:text-emerald-200"
          >
            Create Account
          </Link>

          <Link
            href={isRandomizer ? "/" : "/isopedia"}
            className="font-bold text-emerald-300 hover:text-emerald-200"
          >
            {isRandomizer ? "Back to Randomizer" : "← Back to Isopedia"}
          </Link>
        </div>
      </div>
    </main>
  );
}
