"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export default function VerifySubmitButton({
  children,
}: {
  children: ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="rounded-2xl bg-emerald-400 px-4 py-2 font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
    >
      {pending ? "Publishing..." : children}
    </button>
  );
}
