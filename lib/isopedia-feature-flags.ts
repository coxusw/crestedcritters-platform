import type { createSupabaseServerClient } from "@/lib/supabase-server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type FeatureAccessMode =
  | "disabled"
  | "enabled_all"
  | "isotoken_shop";

type FeatureFlagRow = {
  key: string;
  enabled: boolean;
  availability_mode?: FeatureAccessMode | null;
};

const defaultModes: Record<string, FeatureAccessMode> = {
  expo_status_display_profiles: "enabled_all",
  recent_discussions_profiles: "enabled_all",
  public_collection_preview_profiles: "enabled_all",
  social_site_buttons_profiles: "enabled_all",
};

export async function getProfileFeatureAccess(
  supabase: SupabaseServerClient,
  profileId: string,
  keys: string[]
) {
  const access = Object.fromEntries(
    keys.map((key) => [key, defaultModes[key] === "enabled_all"])
  ) as Record<string, boolean>;

  const { data, error } = await supabase
    .from("isopedia_feature_flags")
    .select("key, enabled, availability_mode")
    .in("key", keys)
    .returns<FeatureFlagRow[]>();

  if (error) return access;

  const purchaseLockedKeys = new Set(
    (data || [])
      .filter((flag) => currentMode(flag) === "isotoken_shop")
      .map((flag) => flag.key)
  );

  let purchasedKeys = new Set<string>();

  if (purchaseLockedKeys.size > 0) {
    purchasedKeys = await getPurchasedFeatureKeys(supabase, profileId);
  }

  for (const flag of data || []) {
    const mode = currentMode(flag);

    access[flag.key] =
      mode === "enabled_all" ||
      (mode === "isotoken_shop" && purchasedKeys.has(flag.key));
  }

  return access;
}

function currentMode(flag: FeatureFlagRow): FeatureAccessMode {
  if (flag.availability_mode) return flag.availability_mode;
  return flag.enabled ? "enabled_all" : "disabled";
}

async function getPurchasedFeatureKeys(
  supabase: SupabaseServerClient,
  profileId: string
) {
  const { data, error } = await supabase
    .from("isotoken_purchases")
    .select(
      `
      isotoken_shop_items:item_id (
        item_key
      )
    `
    )
    .eq("profile_id", profileId)
    .eq("status", "completed")
    .returns<
      Array<{
        isotoken_shop_items: { item_key: string | null } | null;
      }>
    >();

  if (error) return new Set<string>();

  return new Set(
    (data || [])
      .map((purchase) => purchase.isotoken_shop_items?.item_key)
      .filter((key): key is string => Boolean(key))
  );
}
