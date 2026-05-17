"use client";

import { useState } from "react";
import { RANDOMIZER_PACKAGES, formatMoney } from "@/lib/randomizer-billing";

type Props = {
  cleanBillingPath: string;
};

export default function BillingClient({ cleanBillingPath }: Props) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function checkout(packageKey: string) {
    setBusyKey(packageKey);
    setError("");

    try {
      const response = await fetch("/api/randomizer/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageKey }),
      });
      const payload = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || "Could not start checkout.");
      }

      window.location.href = payload.checkoutUrl;
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Could not start checkout."
      );
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <>
      {error && (
        <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {RANDOMIZER_PACKAGES.map((item) => (
          <article
            key={item.key}
            className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20"
          >
            <div className="flex h-full flex-col">
              <div className="flex-1">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">
                  {item.credits ? "Credits" : "Access"}
                </p>
                <h2 className="mt-2 text-2xl font-black">{item.name}</h2>
                <p className="mt-2 text-3xl font-black text-emerald-100">
                  {formatMoney(item.amountCents)}
                </p>
                <p className="mt-3 leading-7 text-emerald-50/70">
                  {item.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => checkout(item.key)}
                disabled={busyKey !== null}
                className="mt-5 rounded-xl bg-emerald-300 px-5 py-3 font-black text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyKey === item.key ? "Opening Square..." : "Buy with Square"}
              </button>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-5 text-sm text-emerald-50/50">
        Checkout returns to {cleanBillingPath}. Square confirms payment through a webhook before access or credits are added.
      </p>
    </>
  );
}
