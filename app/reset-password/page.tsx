"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const supabase = createSupabaseBrowserClient();
  const [isRandomizer, setIsRandomizer] = useState(false);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsRandomizer(
      params.get("app") === "randomizer" ||
        window.location.hostname.toLowerCase().startsWith("randomizer.")
    );
  }, []);

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/confirm?next=${encodeURIComponent(
            `/update-password${isRandomizer ? "?app=randomizer" : ""}`
          )}`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage(
      "Password reset email sent. Check your inbox and spam folder."
    );
  }

  return (
    <main className="min-h-screen bg-[#07130c] px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-300">
            {isRandomizer ? "Randomizer" : "Isopedia"}
          </p>

          <h1 className="mt-3 text-4xl font-black text-white">
            Reset Password
          </h1>

          <p className="mt-4 text-base leading-7 text-emerald-50/70">
            Enter your email and we&apos;ll send you a password reset link.
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
          onSubmit={handleReset}
          className="rounded-3xl border border-white/10 bg-[#102016] p-6 shadow-2xl shadow-black/30"
        >
          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-emerald-100">
                Email Address
              </span>

              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none ring-emerald-400/30 transition focus:ring-4"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending Reset Email..." : "Send Reset Email"}
          </button>

          <div className="mt-6 text-center">
            <Link
              href={isRandomizer ? "/login?app=randomizer&next=/" : "/login"}
              className="text-sm font-bold text-emerald-300 hover:text-emerald-200"
            >
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
