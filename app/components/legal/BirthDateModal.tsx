"use client";

import { usePathname } from "next/navigation";

const excludedPrefixes = [
  "/admin",
  "/api",
  "/auth",
  "/login",
  "/logout",
  "/randomizer",
  "/reset-password",
  "/shop",
  "/signup",
  "/update-password",
];

export default function BirthDateModal({
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
        className="w-full max-w-lg rounded-3xl border border-emerald-300/25 bg-[#102016] p-6 text-white shadow-2xl shadow-black/50"
      >
        <input type="hidden" name="return_path" value={pathname || "/"} />

        <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">
          Account age check
        </p>
        <h2 className="mt-2 text-3xl font-black">Enter Your Birth Date</h2>
        <p className="mt-3 text-sm leading-6 text-emerald-50/70">
          Users under the age of 13 will have some account restrictions
        </p>

        <label className="mt-5 grid gap-2">
          <span className="text-sm font-bold text-emerald-100">Birth Date</span>
          <input
            name="birth_date"
            type="date"
            required
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
          />
        </label>

        <p className="mt-3 text-xs leading-5 text-emerald-50/45">
          This is stored internally for account restrictions and is not shown on
          your public profile.
        </p>

        <button
          type="submit"
          className="mt-6 w-full rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950 hover:bg-emerald-300"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
