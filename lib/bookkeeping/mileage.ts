export const MILEAGE_DEDUCTION_RATE = 0.725;

export function calculateMileageDeduction(mileage: number) {
  if (!Number.isFinite(mileage) || mileage <= 0) return 0;
  return Math.round(mileage * MILEAGE_DEDUCTION_RATE * 100) / 100;
}

export function effectiveMileageDeduction(
  mileage: number | null | undefined,
  storedDeduction: number | null | undefined
) {
  const miles = Number(mileage || 0);
  if (miles > 0) return calculateMileageDeduction(miles);
  return Number(storedDeduction || 0);
}
