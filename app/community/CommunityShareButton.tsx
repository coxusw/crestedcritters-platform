"use client";

import { useState } from "react";

type Props = {
  path: string;
  label?: string;
};

export default function CommunityShareButton({
  path,
  label = "Share this discussion",
}: Props) {
  const [copied, setCopied] = useState(false);

  async function copyDiscussionUrl() {
    const url = new URL(path, window.location.origin).toString();

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const input = document.createElement("input");
      input.value = url;
      input.setAttribute("readonly", "true");
      input.style.position = "absolute";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copyDiscussionUrl}
      className="rounded-lg border border-emerald-400/25 px-4 py-2 text-sm font-black text-emerald-100 hover:bg-emerald-400/10"
    >
      {copied ? "Link copied" : label}
    </button>
  );
}
