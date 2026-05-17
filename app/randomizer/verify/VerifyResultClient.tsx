"use client";

import { useEffect, useState } from "react";

function cleanCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export default function VerifyResultClient() {
  const [code, setCode] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialCode = cleanCode(params.get("code") || "");

    if (initialCode) setCode(initialCode);
  }, []);

  function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = cleanCode(code);

    if (!cleaned) return;

    const isRandomizerHost = window.location.hostname
      .toLowerCase()
      .startsWith("randomizer.");

    window.location.href = isRandomizerHost
      ? `/results/${cleaned}`
      : `/randomizer/results/${cleaned}`;
  }

  return (
    <form
      onSubmit={verify}
      className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20"
    >
      <label className="grid gap-2">
        <span className="text-sm font-black text-emerald-100">Verification Code</span>
        <input
          value={code}
          onChange={(event) => setCode(cleanCode(event.target.value))}
          placeholder="Example: ABC123DEF4"
          className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-lg font-black uppercase tracking-[0.15em] text-white outline-none focus:ring-4 focus:ring-emerald-400/20"
        />
      </label>

      <button
        type="submit"
        className="mt-5 w-full rounded-xl bg-emerald-300 px-5 py-3 font-black text-slate-950 transition hover:bg-emerald-200"
      >
        Verify Result
      </button>
    </form>
  );
}
