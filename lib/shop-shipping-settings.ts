import { promises as fs } from "fs";
import path from "path";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";

export type ShopShippingSettings = {
  originZip: string;
  packageLengthIn: number;
  packageWidthIn: number;
  packageHeightIn: number;
  packageWeightLb: number;
  useShippo: boolean;
  useRevAddress: boolean;
  blockedLiveStates: string[];
  fallbackRatesCents: {
    usps_1_day: number[];
    usps_2_day: number[];
    usps_ground: number[];
  };
  seasonalSurchargesCents: {
    spring: number;
    summer: number;
    october: number;
    november: number;
  };
};

const settingsPath = path.join(process.cwd(), "data", "shop-shipping-settings.json");

export const DEFAULT_SHIPPING_SETTINGS: ShopShippingSettings = {
  originZip: "46341",
  packageLengthIn: 8,
  packageWidthIn: 8,
  packageHeightIn: 7,
  packageWeightLb: 2,
  useShippo: true,
  useRevAddress: true,
  blockedLiveStates: ["AK", "HI", "FL", "CA", "OR"],
  fallbackRatesCents: {
    usps_1_day: [0, 3295, 3495, 3895, 4495, 5295, 6095, 6995, 7895],
    usps_2_day: [0, 965, 1010, 1115, 1275, 1425, 1595, 1745, 1895],
    usps_ground: [0, 795, 840, 895, 965, 1075, 1195, 1295, 1395],
  },
  seasonalSurchargesCents: {
    spring: 500,
    summer: 1000,
    october: 500,
    november: 1000,
  },
};

export async function getShopShippingSettings() {
  const databaseSettings = await getDatabaseSettings();
  if (databaseSettings) return databaseSettings;

  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SHIPPING_SETTINGS;
  }
}

export async function saveShopShippingSettings(settings: ShopShippingSettings) {
  const normalized = normalizeSettings(settings);
  const savedToDatabase = await saveDatabaseSettings(normalized);
  if (savedToDatabase) return;

  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(
    settingsPath,
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8"
  );
}

async function getDatabaseSettings() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("shop_settings")
      .select("value")
      .eq("key", "shipping")
      .maybeSingle<{ value: unknown }>();

    if (error || !data) return null;
    return normalizeSettings(data.value);
  } catch {
    return null;
  }
}

async function saveDatabaseSettings(settings: ShopShippingSettings) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return false;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("shop_settings").upsert(
      {
        key: "shipping",
        value: settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    return !error;
  } catch {
    return false;
  }
}

function normalizeSettings(value: unknown): ShopShippingSettings {
  const candidate = value as Partial<ShopShippingSettings>;
  return {
    ...DEFAULT_SHIPPING_SETTINGS,
    ...candidate,
    blockedLiveStates: Array.isArray(candidate.blockedLiveStates)
      ? candidate.blockedLiveStates.map((state) => String(state).toUpperCase()).filter(Boolean)
      : DEFAULT_SHIPPING_SETTINGS.blockedLiveStates,
    fallbackRatesCents: {
      ...DEFAULT_SHIPPING_SETTINGS.fallbackRatesCents,
      ...(candidate.fallbackRatesCents || {}),
    },
    seasonalSurchargesCents: {
      ...DEFAULT_SHIPPING_SETTINGS.seasonalSurchargesCents,
      ...(candidate.seasonalSurchargesCents || {}),
    },
  };
}
