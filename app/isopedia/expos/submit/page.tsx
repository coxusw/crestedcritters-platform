import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { submitExpo } from "@/app/isopedia/expos/actions";

const STATES = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
];

export default async function SubmitExpoPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/isopedia/expos/submit");
  }

  return (
    <main className="min-h-screen bg-[#0c1710] px-4 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/isopedia/expos"
            className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
          >
            ← Back to Expo Calendar
          </Link>

          <Link
            href="/isopedia"
            className="rounded-xl border border-white/10 bg-[#142318] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#18291d]"
          >
            Isopedia Home
          </Link>
        </div>

        <section className="rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-2xl shadow-black/30 sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
            Community Expo Submission
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
            Submit an Expo
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/65">
            Submit USA-based expos for moderator/admin review. Approved expos
            will appear on the Isopedia expo calendar and archive.
          </p>

          <form action={submitExpo} className="mt-8 grid gap-5">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
                Expo Name
              </span>

              <input
                name="name"
                required
                minLength={3}
                maxLength={160}
                placeholder="Example: Tinley Park NARBC"
                className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-[1fr_180px]">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
                  City / Town
                </span>

                <input
                  name="city"
                  required
                  maxLength={120}
                  placeholder="Example: Tinley Park"
                  className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
                  State
                </span>

                <select
                  name="state"
                  required
                  defaultValue=""
                  className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
                >
                  <option value="" disabled>
                    Select
                  </option>

                  {STATES.map(([abbr, label]) => (
                    <option key={abbr} value={abbr}>
                      {abbr} — {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
                Venue Optional
              </span>

              <input
                name="venue"
                maxLength={180}
                placeholder="Example: Tinley Park Convention Center"
                className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
                  Start Date / Time
                </span>

                <input
                  type="datetime-local"
                  name="starts_at"
                  required
                  className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
                  End Date / Time Optional
                </span>

                <input
                  type="datetime-local"
                  name="ends_at"
                  className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
                Expo Flyer Optional
              </span>

              <input
                type="file"
                name="flyer_image"
                accept="image/jpeg,image/png,image/webp"
                className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-sm text-white outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-400 file:px-4 file:py-2 file:text-sm file:font-black file:text-slate-950 hover:file:bg-emerald-300"
              />

              <span className="text-xs leading-5 text-emerald-50/45">
                Optional JPG, PNG, or WEBP. Maximum 5MB.
              </span>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
                Description
              </span>

              <textarea
                name="description"
                maxLength={4000}
                placeholder="Brief details about the expo, vendor focus, reptiles/inverts/bioactive focus, admission notes, etc."
                className="min-h-[160px] rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
              />
            </label>

            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
              Submissions require moderator/admin approval before appearing
              publicly.
            </div>

            <button
              type="submit"
              className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Submit Expo for Review
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}