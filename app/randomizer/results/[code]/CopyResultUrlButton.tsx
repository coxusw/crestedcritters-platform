"use client";

import { useState } from "react";

export default function CopyResultUrlButton() {
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    const url = window.location.href;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copyUrl}
      className="mt-4 inline-flex rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-emerald-100 hover:bg-white/15"
    >
      {copied ? "Result URL copied" : "Copy result URL"}
    </button>
  );
}
