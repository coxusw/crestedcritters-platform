"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ISOPEDIA_CONTENT_LICENSE_ACKNOWLEDGMENT,
  ISOPEDIA_LEGAL_VERSION,
} from "@/lib/isopedia-legal";

const excludedPrefixes = [
  "/admin",
  "/api",
  "/auth",
  "/legal",
  "/login",
  "/logout",
  "/randomizer",
  "/reset-password",
  "/shop",
  "/signup",
  "/update-password",
];

export default function LegalAcceptanceModal({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  const pathname = usePathname();

  if (excludedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 px-4 py-6 backdrop-blur">
      <form
        action={action}
        className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-3xl border border-emerald-300/25 bg-[#102016] p-6 text-white shadow-2xl shadow-black/50"
      >
        <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">
          Legal documents updated
        </p>
        <h2 className="mt-2 text-3xl font-black">Review and Accept</h2>
        <p className="mt-3 text-sm leading-6 text-emerald-50/70">
          Isopedia updated its Terms of Service, Privacy Policy, Community
          Guidelines, and User Generated Content Policy. Please accept version {ISOPEDIA_LEGAL_VERSION} before
          continuing to contribute.
        </p>

        <label className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-emerald-50/80">
          <input
            name="content_license_acknowledgment"
            type="checkbox"
            required
            className="mt-1 h-5 w-5 rounded border-white/20 bg-black"
          />
          <span>{ISOPEDIA_CONTENT_LICENSE_ACKNOWLEDGMENT}</span>
        </label>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/legal"
            className="text-sm font-bold text-emerald-300 underline hover:text-emerald-200"
          >
            View legal documents
          </Link>
          <button
            type="submit"
            className="rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950 hover:bg-emerald-300"
          >
            Accept and Continue
          </button>
        </div>
      </form>
    </div>
  );
}
