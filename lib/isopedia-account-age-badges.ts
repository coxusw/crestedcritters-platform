import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";

export type AccountAgeBadgeMilestone = {
  key: string;
  months: number;
  label: string;
  description: string;
  color: string;
  icon: string;
};

export const ACCOUNT_AGE_BADGE_MILESTONES: AccountAgeBadgeMilestone[] = [
  {
    key: "account_age_1_month",
    months: 1,
    label: "Colony Hatchling",
    description: "Account has been part of Isopedia for at least 1 month.",
    color: "emerald",
    icon: "1M",
  },
  {
    key: "account_age_3_months",
    months: 3,
    label: "Settled Colony",
    description: "Account has been part of Isopedia for at least 3 months.",
    color: "sky",
    icon: "3M",
  },
  {
    key: "account_age_6_months",
    months: 6,
    label: "Established Keeper",
    description: "Account has been part of Isopedia for at least 6 months.",
    color: "violet",
    icon: "6M",
  },
  {
    key: "account_age_1_year",
    months: 12,
    label: "Yearling Member",
    description: "Account has been part of Isopedia for at least 1 year.",
    color: "amber",
    icon: "1Y",
  },
  {
    key: "account_age_2_years",
    months: 24,
    label: "Two Year Veteran",
    description: "Account has been part of Isopedia for at least 2 years.",
    color: "rose",
    icon: "2Y",
  },
  {
    key: "account_age_3_years",
    months: 36,
    label: "Three Year Veteran",
    description: "Account has been part of Isopedia for at least 3 years.",
    color: "green",
    icon: "3Y",
  },
  {
    key: "account_age_4_years",
    months: 48,
    label: "Four Year Veteran",
    description: "Account has been part of Isopedia for at least 4 years.",
    color: "cyan",
    icon: "4Y",
  },
  {
    key: "account_age_5_plus_years",
    months: 60,
    label: "Five Year Legacy",
    description: "Account has been part of Isopedia for at least 5 years.",
    color: "slate",
    icon: "5Y+",
  },
];

type SyncResult = {
  badgesReady: number;
  profilesChecked: number;
  assignmentsAdded: number;
};

function subtractMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() - months);
  return copy;
}

async function ensureAccountAgeBadges(
  supabase: ReturnType<typeof createSupabaseAdminClient>
) {
  const rows = ACCOUNT_AGE_BADGE_MILESTONES.map((milestone) => ({
    badge_key: milestone.key,
    label: milestone.label,
    description: milestone.description,
    color: milestone.color,
    icon: milestone.icon,
    is_active: true,
    automation_type: "account_age",
    automation_months: milestone.months,
    metadata: {
      automatic: true,
      milestone_months: milestone.months,
    },
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("profile_badges")
    .upsert(rows, { onConflict: "badge_key" });

  if (error) throw new Error(error.message);

  const { data: badges, error: badgeError } = await supabase
    .from("profile_badges")
    .select("id, badge_key")
    .in(
      "badge_key",
      ACCOUNT_AGE_BADGE_MILESTONES.map((milestone) => milestone.key)
    )
    .returns<Array<{ id: string; badge_key: string | null }>>();

  if (badgeError) throw new Error(badgeError.message);

  return new Map(
    (badges || [])
      .filter((badge) => badge.badge_key)
      .map((badge) => [badge.badge_key as string, badge.id])
  );
}

async function getAccountAgeBadgeIds(
  supabase: ReturnType<typeof createSupabaseAdminClient>
) {
  const { data: badges, error } = await supabase
    .from("profile_badges")
    .select("id, badge_key")
    .in(
      "badge_key",
      ACCOUNT_AGE_BADGE_MILESTONES.map((milestone) => milestone.key)
    )
    .eq("is_active", true)
    .returns<Array<{ id: string; badge_key: string | null }>>();

  if (error) throw new Error(error.message);

  return new Map(
    (badges || [])
      .filter((badge) => badge.badge_key)
      .map((badge) => [badge.badge_key as string, badge.id])
  );
}

export async function syncAccountAgeBadgesForProfile(profileId: string) {
  if (!profileId) {
    return { badgesReady: 0, profilesChecked: 0, assignmentsAdded: 0 };
  }

  return syncAccountAgeBadges({ profileId, seedBadges: false });
}

export async function syncAccountAgeBadges(options?: {
  profileId?: string;
  seedBadges?: boolean;
}) {
  const supabase = createSupabaseAdminClient();
  const badgeIdsByKey =
    options?.seedBadges === false
      ? await getAccountAgeBadgeIds(supabase)
      : await ensureAccountAgeBadges(supabase);
  const newestCutoff = subtractMonths(new Date(), 1).toISOString();

  let profilesQuery = supabase
    .from("profiles")
    .select("id, created_at")
    .not("created_at", "is", null)
    .lte("created_at", newestCutoff)
    .range(0, 9999);

  if (options?.profileId) {
    profilesQuery = profilesQuery.eq("id", options.profileId);
  }

  const { data: profiles, error: profileError } = await profilesQuery.returns<
    Array<{ id: string; created_at: string | null }>
  >();
  if (profileError) throw new Error(profileError.message);

  const now = Date.now();
  const rows: Array<{ profile_id: string; badge_id: string }> = [];

  for (const profile of profiles || []) {
    if (!profile.created_at) continue;

    const createdTime = new Date(profile.created_at).getTime();
    if (Number.isNaN(createdTime)) continue;

    for (const milestone of ACCOUNT_AGE_BADGE_MILESTONES) {
      const eligibleAt = subtractMonths(new Date(), milestone.months).getTime();
      const badgeId = badgeIdsByKey.get(milestone.key);

      if (badgeId && createdTime <= eligibleAt && createdTime <= now) {
        rows.push({ profile_id: profile.id, badge_id: badgeId });
      }
    }
  }

  let assignmentsAdded = 0;

  if (rows.length) {
    const { data, error } = await supabase
      .from("profile_badge_assignments")
      .upsert(rows, { onConflict: "profile_id,badge_id", ignoreDuplicates: true })
      .select("id")
      .returns<Array<{ id: string }>>();

    if (error) throw new Error(error.message);
    assignmentsAdded = data?.length || 0;
  }

  return {
    badgesReady: badgeIdsByKey.size,
    profilesChecked: profiles?.length || 0,
    assignmentsAdded,
  } satisfies SyncResult;
}
