"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function UpdatePasswordPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function prepareRecoverySession() {
      setError("");

      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) throw exchangeError;

          url.searchParams.delete("code");
          window.history.replaceState({}, "", url.pathname + url.search);
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) throw sessionError;

          window.history.replaceState({}, "", url.pathname);
        }
      } catch (sessionError) {
        if (mounted) {
          setError(
            sessionError instanceof Error
              ? sessionError.message
              : "Password reset link could not be verified. Request a fresh reset email."
          );
        }
      } finally {
        if (mounted) setSessionLoading(false);
      }
    }

    prepareRecoverySession();

    return () => {
      mounted = false;
    };
  }, [supabase.auth]);

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage("");
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Password updated successfully.");

    setTimeout(() => {
      router.push("/login");
    }, 2000);
  }

  return (
    <main className="min-h-screen bg-[#07130c] px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-300">
            Isopedia
          </p>

          <h1 className="mt-3 text-4xl font-black text-white">
            Update Password
          </h1>

          <p className="mt-4 text-base leading-7 text-emerald-50/70">
            Enter your new password below.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <form
          onSubmit={handleUpdate}
          className="rounded-3xl border border-white/10 bg-[#102016] p-6 shadow-2xl shadow-black/30"
        >
          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-emerald-100">
                New Password
              </span>

              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none ring-emerald-400/30 transition focus:ring-4"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-emerald-100">
                Confirm Password
              </span>

              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none ring-emerald-400/30 transition focus:ring-4"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || sessionLoading}
            className="mt-6 w-full rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sessionLoading
              ? "Verifying Reset Link..."
              : loading
                ? "Updating Password..."
                : "Update Password"}
          </button>
        </form>
      </div>
    </main>
  );
}
