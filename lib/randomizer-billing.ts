export type RandomizerPackage = {
  key: string;
  name: string;
  description: string;
  amountCents: number;
  credits: number;
  accessDays: number | null;
  lifetimeAccess: boolean;
};

export const RANDOMIZER_PACKAGES: RandomizerPackage[] = [
  {
    key: "access_week",
    name: "1 Week Access",
    description: "Unlimited randomizer results for 7 days.",
    amountCents: 500,
    credits: 0,
    accessDays: 7,
    lifetimeAccess: false,
  },
  {
    key: "access_month",
    name: "1 Month Access",
    description: "Unlimited randomizer results for 30 days.",
    amountCents: 1500,
    credits: 0,
    accessDays: 30,
    lifetimeAccess: false,
  },
  {
    key: "access_year",
    name: "1 Year Access",
    description: "Unlimited randomizer results for 365 days.",
    amountCents: 10000,
    credits: 0,
    accessDays: 365,
    lifetimeAccess: false,
  },
  {
    key: "access_lifetime",
    name: "Lifetime Access",
    description: "Unlimited randomizer results forever.",
    amountCents: 30000,
    credits: 0,
    accessDays: null,
    lifetimeAccess: true,
  },
  {
    key: "credits_1",
    name: "1 Credit",
    description: "One official randomizer result. Credits do not expire.",
    amountCents: 100,
    credits: 1,
    accessDays: null,
    lifetimeAccess: false,
  },
  {
    key: "credits_5",
    name: "5 Credits",
    description: "Five official randomizer results. Credits do not expire.",
    amountCents: 300,
    credits: 5,
    accessDays: null,
    lifetimeAccess: false,
  },
  {
    key: "credits_10",
    name: "10 Credits",
    description: "Ten official randomizer results. Credits do not expire.",
    amountCents: 500,
    credits: 10,
    accessDays: null,
    lifetimeAccess: false,
  },
];

export function getRandomizerPackage(key: string) {
  return RANDOMIZER_PACKAGES.find((item) => item.key === key) || null;
}

export function formatMoney(amountCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
  }).format(amountCents / 100);
}
