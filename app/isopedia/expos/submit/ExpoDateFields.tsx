"use client";

import { useState } from "react";

const MAX_ADDITIONAL_DATES = 11;

export function ExpoDateFields() {
  const [additionalDates, setAdditionalDates] = useState<number[]>([]);
  const canAddDate = additionalDates.length < MAX_ADDITIONAL_DATES;

  function addDate() {
    setAdditionalDates((dates) =>
      dates.length >= MAX_ADDITIONAL_DATES
        ? dates
        : [...dates, (dates.at(-1) || 0) + 1]
    );
  }

  function removeDate(dateId: number) {
    setAdditionalDates((dates) => dates.filter((id) => id !== dateId));
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#07130c]/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
            Additional Dates Optional
          </p>
          <p className="mt-2 text-sm leading-6 text-emerald-50/55">
            Add another scheduled date when the same expo has more than one
            planned event.
          </p>
        </div>

        <button
          type="button"
          onClick={addDate}
          disabled={!canAddDate}
          className="rounded-xl border border-emerald-300/30 bg-emerald-400/15 px-4 py-2 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/35"
        >
          + Add Date
        </button>
      </div>

      {additionalDates.length > 0 ? (
        <div className="mt-4 grid gap-4">
          {additionalDates.map((dateId, index) => (
            <div
              key={dateId}
              className="grid gap-4 rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-widest text-emerald-100/45">
                  Date {index + 2}
                </p>
                <button
                  type="button"
                  onClick={() => removeDate(dateId)}
                  className="rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-1 text-xs font-black text-red-100 transition hover:bg-red-400/20"
                >
                  Remove
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-100/45">
                    Start
                  </span>
                  <input
                    type="datetime-local"
                    name="additional_starts_at"
                    className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-100/45">
                    End Optional
                  </span>
                  <input
                    type="datetime-local"
                    name="additional_ends_at"
                    className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
