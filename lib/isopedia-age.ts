export const ISOPEDIA_MINIMUM_UNRESTRICTED_AGE = 13;

export function ageInYearsFromBirthDate(
  birthDate: string | null | undefined,
  now = new Date()
) {
  if (!birthDate) return null;

  const [year, month, day] = birthDate.split("-").map(Number);
  if (!year || !month || !day) return null;

  let age = now.getFullYear() - year;
  const monthDiff = now.getMonth() + 1 - month;
  const dayDiff = now.getDate() - day;

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age;
}

export function isUnderRestrictedAge(birthDate: string | null | undefined) {
  const age = ageInYearsFromBirthDate(birthDate);
  return age !== null && age < ISOPEDIA_MINIMUM_UNRESTRICTED_AGE;
}

export function isValidBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();
  const minimumYear = today.getFullYear() - 120;

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date <= today &&
    year >= minimumYear
  );
}
