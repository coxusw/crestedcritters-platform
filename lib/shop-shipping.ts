import type { ShopProduct } from "@/lib/shop";
import { DEFAULT_SHIPPING_SETTINGS, getShopShippingSettings } from "@/lib/shop-shipping-settings";

export type ShippingOption = {
  serviceKey: string;
  serviceName: string;
  carrier: string;
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
  return DEFAULT_SHIPPING_SETTINGS.blockedLiveStates;
}

export async function getBlockedLiveStates() {
  const settings = await getShopShippingSettings();
  return settings.blockedLiveStates.map((state) => normalizeState(state)).filter(Boolean);
}

export async function getLiveShippingSeason(date = new Date()) {
  const settings = await getShopShippingSettings();
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
    return { blocked: false, surchargeCents: settings.seasonalSurchargesCents.spring, message: "" };
  }

  if (monthDay >= 701 && monthDay <= 930) {
    return { blocked: false, surchargeCents: settings.seasonalSurchargesCents.summer, message: "" };
  }

  if (monthDay >= 1001 && monthDay <= 1031) {
    return { blocked: false, surchargeCents: settings.seasonalSurchargesCents.october, message: "" };
  }

  return { blocked: false, surchargeCents: settings.seasonalSurchargesCents.november, message: "" };
}

export async function getShippingOptions({
  destinationZip,
  destinationState,
  hasLiveItems,
}: {
  destinationZip: string;
  destinationState?: string;
  hasLiveItems: boolean;
}) {
  const settings = await getShopShippingSettings();
  const zip = normalizeZip(destinationZip);
  const state = normalizeState(destinationState || "");
  const packageInfo = {
    weight: settings.packageWeightLb,
    length: settings.packageLengthIn,
    width: settings.packageWidthIn,
    height: settings.packageHeightIn,
  };

  const liveSeason = hasLiveItems ? await getLiveShippingSeason() : null;
  const surchargeCents = liveSeason?.surchargeCents || 0;
  const shippoRates = settings.useShippo
    ? await fetchShippoRates({
        originZip: settings.originZip,
        destinationZip: zip,
        destinationState: state,
        ...packageInfo,
      })
    : [];
  const revAddressRates = shippoRates.length === 0 && settings.useRevAddress
    ? await fetchRevAddressRates({
        originZip: settings.originZip,
        destinationZip: zip,
        ...packageInfo,
      })
    : [];
  const sourceRates =
    shippoRates.length > 0
      ? shippoRates
      : revAddressRates.length > 0
        ? revAddressRates
        : fallbackRates(zip, settings.fallbackRatesCents);
  const allowed = hasLiveItems
    ? sourceRates.filter((rate) =>
        ["usps_1_day", "usps_2_day", "ups_1_day", "ups_2_day"].includes(rate.serviceKey)
      )
    : sourceRates.filter((rate) =>
        ["usps_1_day", "usps_2_day", "usps_ground", "ups_1_day", "ups_2_day", "ups_ground"].includes(rate.serviceKey)
      );

  return allowed.map((rate) => ({
    ...rate,
    surchargeCents,
    totalCents: rate.baseCents + surchargeCents,
  }));
}

async function fetchShippoRates({
  originZip,
  destinationZip,
  destinationState,
  weight,
  length,
  width,
  height,
}: {
  originZip: string;
  destinationZip: string;
  destinationState: string;
  weight: number;
  length: number;
  width: number;
  height: number;
}) {
  const token = process.env.SHIPPO_API_TOKEN;
  if (!token) return [];

  try {
    const response = await fetch("https://api.goshippo.com/shipments/", {
      method: "POST",
      headers: {
        Authorization: `ShippoToken ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        address_from: {
          name: "Crested Critters",
          zip: originZip,
          country: "US",
        },
        address_to: {
          name: "Crested Critters Customer",
          state: destinationState || undefined,
          zip: destinationZip,
          country: "US",
        },
        parcels: [
          {
            length: String(length),
            width: String(width),
            height: String(height),
            distance_unit: "in",
            weight: String(weight),
            mass_unit: "lb",
          },
        ],
        async: false,
      }),
    });

    if (!response.ok) return [];
    const payload = await response.json();
    const rates = Array.isArray(payload.rates) ? payload.rates : [];
    return normalizeShippoRates(rates);
  } catch {
    return [];
  }
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
        carrier: serviceCarrier(serviceKey),
        baseCents,
        surchargeCents: 0,
        totalCents: baseCents,
        deliveryDays,
      });
    }
  }

  return Array.from(normalized.values()).sort((left, right) => left.totalCents - right.totalCents);
}

function normalizeShippoRates(rateOptions: unknown[]) {
  const normalized = new Map<string, ShippingOption>();

  for (const option of rateOptions) {
    if (!option || typeof option !== "object") continue;
    const record = option as Record<string, unknown>;
    const serviceLevel = (record.servicelevel || {}) as Record<string, unknown>;
    const provider = String(record.provider || "").toUpperCase();
    const serviceToken = String(serviceLevel.token || record.servicelevel_token || "").toUpperCase();
    const serviceNameValue = String(serviceLevel.name || record.servicelevel_name || record.service || "");
    const serviceKey = mapShippoServiceKey(provider, serviceToken, serviceNameValue);
    if (!serviceKey) continue;

    const amount = Number(record.amount || record.price || 0);
    const baseCents = Math.round(amount * 100);
    if (!Number.isFinite(baseCents) || baseCents <= 0) continue;

    const deliveryDays = Number(record.estimated_days || record.duration_terms || 0) || null;
    const existing = normalized.get(serviceKey);

    if (!existing || baseCents < existing.baseCents) {
      normalized.set(serviceKey, {
        serviceKey,
        serviceName: serviceNameValue || serviceName(serviceKey),
        carrier: serviceCarrier(serviceKey),
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

function mapShippoServiceKey(provider: string, serviceToken: string, serviceNameValue: string) {
  const token = `${provider} ${serviceToken} ${serviceNameValue}`.toUpperCase();

  if (provider.includes("UPS") || token.includes("UPS")) {
    if (token.includes("NEXT_DAY") || token.includes("NEXT DAY") || token.includes("1DAY") || token.includes("1 DAY")) {
      return "ups_1_day";
    }
    if (token.includes("2ND_DAY") || token.includes("2ND DAY") || token.includes("2DAY") || token.includes("2 DAY")) {
      return "ups_2_day";
    }
    if (token.includes("GROUND")) return "ups_ground";
  }

  if (provider.includes("USPS") || token.includes("USPS")) {
    if (token.includes("EXPRESS")) return "usps_1_day";
    if (token.includes("PRIORITY")) return "usps_2_day";
    if (token.includes("GROUND") || token.includes("ADVANTAGE") || token.includes("PARCEL")) return "usps_ground";
  }

  return "";
}

function fallbackRates(
  destinationZip: string,
  fallbackRatesCents = DEFAULT_SHIPPING_SETTINGS.fallbackRatesCents
): ShippingOption[] {
  const zone = estimateZone(destinationZip);
  const priorityTwoDay = fallbackRatesCents.usps_2_day[zone] || fallbackRatesCents.usps_2_day[5] || 1595;
  const ground = fallbackRatesCents.usps_ground[zone] || fallbackRatesCents.usps_ground[5] || 1195;
  const express = fallbackRatesCents.usps_1_day[zone] || fallbackRatesCents.usps_1_day[5] || 6095;

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
    carrier: serviceCarrier(serviceKey),
    baseCents,
    surchargeCents: 0,
    totalCents: baseCents,
    deliveryDays,
  };
}

function serviceName(serviceKey: string) {
  if (serviceKey === "ups_1_day") return "UPS 1 Day";
  if (serviceKey === "ups_2_day") return "UPS 2 Day";
  if (serviceKey === "ups_ground") return "UPS Ground";
  if (serviceKey === "usps_1_day") return "USPS 1 Day";
  if (serviceKey === "usps_2_day") return "USPS 2 Day";
  return "USPS Ground";
}

function serviceCarrier(serviceKey: string) {
  return serviceKey.startsWith("ups_") ? "UPS" : "USPS";
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
