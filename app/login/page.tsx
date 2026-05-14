import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeNextPath(value: string) {
  if (!value) return "/isopedia";
  if (!value.startsWith("/")) return "/isopedia";
  if (value.startsWith("//")) return "/isopedia";
  return value;
}

async function loginOrSignUp(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();

  const email = cleanText(formData.get("email"));
  const password = cleanText(formData.get("password"));
  const mode = cleanText(formData.get("mode"));
  const next = safeNextPath(cleanText(formData.get("next")) || "/isopedia");

  if (!email || !password) {
    redirect(`/login?error=missing-fields&next=${encodeURIComponent(next)}`);
  }

  if (mode === "signup") {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      redirect(`/login?error=signup-failed&next=${encodeURIComponent(next)}`);
    }

    redirect(`/login?message=signup-success&next=${encodeURIComponent(next)}`);
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=login-failed&next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
    next?: string;
  }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next || "/isopedia");

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
            Isopedia
          </p>

          <h1 className="mt-2 text-4xl font-bold text-white">Sign In</h1>

          <p className="mt-3 text-slate-300">
            Sign in or create an account to contribute to Isopedia.
          </p>
        </div>

        {params.message === "signup-success" && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Account created. If email confirmation is enabled in Supabase,
            check your email before signing in.
          </div>
        )}

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

        {params.error === "signup-failed" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Account creation failed. This email may already be registered or
            password requirements were not met.
          </div>
        )}

        <form
          action={loginOrSignUp}
          className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-xl shadow-black/20"
        >
          <input type="hidden" name="next" value={next} />

          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-200">Email</span>
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-200">
                Password
              </span>
              <input
                type="password"
                name="password"
                placeholder="Your password"
                className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                required
              />
            </label>
          </div>

          <div className="mt-8 grid gap-3">
            <button
              type="submit"
              name="mode"
              value="login"
              className="rounded-xl bg-emerald-400 px-6 py-3 font-bold text-slate-950 transition hover:bg-emerald-300"
            >
              Sign In
            </button>

            <button
              type="submit"
              name="mode"
              value="signup"
              className="rounded-xl border border-white/10 bg-slate-950 px-6 py-3 font-bold text-slate-100 transition hover:bg-slate-800"
            >
              Create Account
            </button>
          </div>
        </form>

        <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
          <Link
            href="/isopedia"
            className="font-medium text-emerald-300 hover:text-emerald-200"
          >
            ← Back to Isopedia
          </Link>

          <Link
            href="/account"
            className="font-medium text-emerald-300 hover:text-emerald-200"
          >
            Edit profile
          </Link>
        </div>
      </div>
    </main>
  );
}