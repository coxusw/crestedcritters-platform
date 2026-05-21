import type { ShopProduct } from "@/lib/shop";

export type ShippingOption = {
  serviceKey: string;
  serviceName: string;
  baseCents: number;
  surchargeCents: number;
  totalCents: number;
  deliveryDays: number | null;
};

export const US_STATES = [
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
] as const;

const ZIP_ZONE_PREFIXES: Record<number, number[]> = {
  1: [46, 47, 48, 49, 53, 54, 60, 61, 62],
  2: [40, 41, 42, 43, 44, 45, 50, 51, 52, 55, 56, 57, 58, 59, 63, 64, 65, 66],
  3: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 25, 26, 27, 28, 29, 67, 68, 69],
  4: [1, 2, 3, 4, 5, 6, 7, 8, 9, 30, 31, 32, 33, 34, 35, 36, 37, 70, 71, 72, 73, 74],
  5: [75, 76, 77, 78, 79, 80, 81, 82, 83],
  6: [84, 85, 86, 87, 88, 89],
  7: [90, 91, 92, 93, 94, 95, 96],
  8: [97, 98, 99],
};

export function isLiveProduct(product: Pick<ShopProduct, "category">) {
  const category = product.category.toLowerCase();
  return category.includes("isopod") || category.includes("springtail");
}

export function hasLiveProducts(products: Pick<ShopProduct, "category">[]) {
  return products.some(isLiveProduct);
}

export function normalizeState(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeZip(value: string) {
  return value.replace(/\D/g, "").slice(0, 5);
}

export function blockedLiveStates() {
  return (process.env.SHOP_LIVE_BLOCKED_STATES || "AK,HI,FL,CA,OR")
    .split(",")
    .map((state) => normalizeState(state))
    .filter(Boolean);
}

export function getLiveShippingSeason(date = new Date()) {
  const { month, day } = centralMonthDay(date);
  const monthDay = month * 100 + day;

  if (monthDay >= 1201 || monthDay <= 324) {
    return {
      blocked: true,
      surchargeCents: 0,
      message: "We are sorry Crested Critters does not begin Live Shipments until last week of March",
    };
  }

  if (monthDay >= 325 && monthDay <= 630) {
    return { blocked: false, surchargeCents: 500, message: "" };
  }

  if (monthDay >= 701 && monthDay <= 930) {
    return { blocked: false, surchargeCents: 1000, message: "" };
  }

  if (monthDay >= 1001 && monthDay <= 1031) {
    return { blocked: false, surchargeCents: 500, message: "" };
  }

  return { blocked: false, surchargeCents: 1000, message: "" };
}

export async function getShippingOptions({
  destinationZip,
  hasLiveItems,
}: {
  destinationZip: string;
  hasLiveItems: boolean;
}) {
  const zip = normalizeZip(destinationZip);
  const originZip = process.env.SHOP_ORIGIN_ZIP || "46341";
  const packageInfo = {
    weight: Number(process.env.SHOP_PACKAGE_WEIGHT_LB || 2),
    length: Number(process.env.SHOP_PACKAGE_LENGTH_IN || 8),
    width: Number(process.env.SHOP_PACKAGE_WIDTH_IN || 8),
    height: Number(process.env.SHOP_PACKAGE_HEIGHT_IN || 7),
  };

  const liveSeason = hasLiveItems ? getLiveShippingSeason() : null;
  const surchargeCents = liveSeason?.surchargeCents || 0;
  const rates = await fetchRevAddressRates({
    originZip,
    destinationZip: zip,
    ...packageInfo,
  });
  const sourceRates = rates.length > 0 ? rates : fallbackRates(zip);
  const allowed = hasLiveItems
    ? sourceRates.filter((rate) => rate.serviceKey === "usps_1_day" || rate.serviceKey === "usps_2_day")
    : sourceRates.filter((rate) =>
        ["usps_1_day", "usps_2_day", "usps_ground"].includes(rate.serviceKey)
      );

  return allowed.map((rate) => ({
    ...rate,
    surchargeCents,
    totalCents: rate.baseCents + surchargeCents,
  }));
}

async function fetchRevAddressRates({
  originZip,
  destinationZip,
  weight,
  length,
  width,
  height,
}: {
  originZip: string;
  destinationZip: string;
  weight: number;
  length: number;
  width: number;
  height: number;
}) {
  try {
    const response = await fetch("https://api.revaddress.com/api/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originZIPCode: originZip,
        origin_zip: originZip,
        destinationZIPCode: destinationZip,
        destination_zip: destinationZip,
        weight,
        weight_oz: Math.round(weight * 16),
        length,
        width,
        height,
        mail_class: "ALL",
      }),
    });

    if (!response.ok) return [];
    const payload = await response.json();
    const rateOptions = extractRateOptions(payload);
    return normalizeRateOptions(rateOptions);
  } catch {
    return [];
  }
}

function extractRateOptions(payload: unknown) {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const rates = record.rates;

  if (Array.isArray(rates)) return rates;
  if (rates && typeof rates === "object") {
    const ratesRecord = rates as Record<string, unknown>;
    if (Array.isArray(ratesRecord.rateOptions)) return ratesRecord.rateOptions;
    if (Array.isArray(ratesRecord.rates)) return ratesRecord.rates;
  }

  if (Array.isArray(record.rateOptions)) return record.rateOptions;
  return [];
}

function normalizeRateOptions(rateOptions: unknown[]) {
  const normalized = new Map<string, ShippingOption>();

  for (const option of rateOptions) {
    if (!option || typeof option !== "object") continue;
    const record = option as Record<string, unknown>;
    const label = String(record.mailClass || record.service || record.name || "").toUpperCase();
    const serviceKey = mapServiceKey(label, record);
    if (!serviceKey) continue;

    const price = Number(record.totalBasePrice || record.price || record.rate || record.total || 0);
    const baseCents = Math.round(price * 100);
    if (!Number.isFinite(baseCents) || baseCents <= 0) continue;

    const deliveryDays = Number(record.delivery_days || record.deliveryDays || record.days || 0) || null;
    const existing = normalized.get(serviceKey);

    if (!existing || baseCents < existing.baseCents) {
      normalized.set(serviceKey, {
        serviceKey,
        serviceName: serviceName(serviceKey),
        baseCents,
        surchargeCents: 0,
        totalCents: baseCents,
        deliveryDays,
      });
    }
  }

  return Array.from(normalized.values()).sort((left, right) => left.totalCents - right.totalCents);
}

function mapServiceKey(label: string, record: Record<string, unknown>) {
  const days = Number(record.delivery_days || record.deliveryDays || record.days || 0);

  if (label.includes("EXPRESS") || days === 1) return "usps_1_day";
  if (label.includes("PRIORITY") || days === 2) return "usps_2_day";
  if (label.includes("GROUND") || label.includes("ADVANTAGE")) return "usps_ground";
  return "";
}

function fallbackRates(destinationZip: string): ShippingOption[] {
  const zone = estimateZone(destinationZip);
  const priorityTwoDay = [0, 965, 1010, 1115, 1275, 1425, 1595, 1745, 1895][zone] || 1595;
  const ground = [0, 795, 840, 895, 965, 1075, 1195, 1295, 1395][zone] || 1195;
  const express = [0, 3295, 3495, 3895, 4495, 5295, 6095, 6995, 7895][zone] || 6095;

  return [
    fallbackOption("usps_ground", ground, 4),
    fallbackOption("usps_2_day", priorityTwoDay, 2),
    fallbackOption("usps_1_day", express, 1),
  ];
}

function fallbackOption(serviceKey: string, baseCents: number, deliveryDays: number): ShippingOption {
  return {
    serviceKey,
    serviceName: serviceName(serviceKey),
    baseCents,
    surchargeCents: 0,
    totalCents: baseCents,
    deliveryDays,
  };
}

function serviceName(serviceKey: string) {
  if (serviceKey === "usps_1_day") return "USPS 1 Day";
  if (serviceKey === "usps_2_day") return "USPS 2 Day";
  return "USPS Ground";
}

function estimateZone(destinationZip: string) {
  const prefix = Number(normalizeZip(destinationZip).slice(0, 2));
  if (!Number.isFinite(prefix)) return 5;

  for (const [zone, prefixes] of Object.entries(ZIP_ZONE_PREFIXES)) {
    if (prefixes.includes(prefix)) return Number(zone);
  }

  return 5;
}

function centralMonthDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  return {
    month: Number(parts.find((part) => part.type === "month")?.value || 1),
    day: Number(parts.find((part) => part.type === "day")?.value || 1),
  };
}
