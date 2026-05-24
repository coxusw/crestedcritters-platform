"use client";

import { useState } from "react";
import { calculateMileageDeduction } from "@/lib/bookkeeping/mileage";

type MileageDeductionFieldsProps = {
  mileageName: string;
  deductionName: string;
  defaultMileage?: number | null;
  defaultDeduction?: number | null;
  variant?: "manual" | "compact";
};

function formatValue(value: number | null | undefined) {
  const number = Number(value || 0);
  return number > 0 ? number.toFixed(2) : "";
}

function parseInput(value: string) {
  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function MileageDeductionFields({
  mileageName,
  deductionName,
  defaultMileage,
  defaultDeduction,
  variant = "manual",
}: MileageDeductionFieldsProps) {
  const [mileage, setMileage] = useState(formatValue(defaultMileage));
  const [deduction, setDeduction] = useState(
    formatValue(defaultMileage && defaultMileage > 0 ? calculateMileageDeduction(defaultMileage) : defaultDeduction)
  );
  const compact = variant === "compact";
  const inputClass = compact
    ? "w-full rounded-md border border-white/10 bg-slate-950/80 px-1.5 py-1 text-right text-xs text-slate-100"
    : "min-w-0 rounded-md border border-white/10 bg-slate-950/80 px-2 py-2 text-sm text-slate-100";

  function handleMileageChange(value: string) {
    setMileage(value);
    const miles = parseInput(value);
    setDeduction(miles > 0 ? calculateMileageDeduction(miles).toFixed(2) : "");
  }

  return (
    <>
      <input
        name={mileageName}
        value={mileage}
        onChange={(event) => handleMileageChange(event.target.value)}
        placeholder="Miles"
        className={inputClass}
      />
      <input
        name={deductionName}
        value={deduction}
        onChange={(event) => setDeduction(event.target.value)}
        placeholder={compact ? "auto $" : "Auto: miles x $0.725"}
        className={inputClass}
      />
    </>
  );
}
