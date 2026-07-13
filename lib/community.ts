import { createSupabaseServerClient } from "@/lib/supabase-server";

export type CommunityProfile = {
  id?: string;
  username: string | null;
  display_name: string | null;
  business_name: string | null;
};

export type CommunityCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  display_order: number;
  is_active: boolean;
  requires_approval: boolean;
  marketplace_rules: boolean;
  species_tagging_enabled: boolean;
  images_enabled: boolean;
  staff_only_posting: boolean;
  posting_guidelines: string | null;
  minimum_account_age_days: number;
};

export type CommunityDiscussion = {
  id: string;
  category_id: string;
  author_id: string | null;
  slug: string;
  title: string;
  body: string;
  excerpt: string | null;
  content_type: "discussion" | "guide" | "question" | "marketplace" | "journal" | "prompt";
  status: string;
  pinned: boolean;
  pinned_until: string | null;
  featured: boolean;
  locked: boolean;
  answered: boolean;
  accepted_reply_id: string | null;
  reply_count: number;
  view_count: number;
  save_count: number;
  follow_count: number;
  report_count: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
  author: CommunityProfile | null;
  category: CommunityCategory | null;
};

export type CommunityReply = {
  id: string;
  discussion_id: string;
  author_id: string | null;
  reply_to_author_id: string | null;
  body: string;
  status: string;
  helpful_count: number;
  is_accepted_answer: boolean;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
  author: CommunityProfile | null;
};

export type CommunityImage = {
  id: string;
  discussion_id: string | null;
  reply_id: string | null;
  owner_id: string | null;
  image_url: string;
  storage_path: string | null;
  alt_text: string | null;
  caption: string | null;
  position: number;
  created_at: string;
};

export type CommunitySpecies = {
  id: number;
  common_name: string;
  scientific_name: string | null;
  slug: string;
};

export type MarketplaceDetails = {
  discussion_id: string;
  listing_type: string;
  listing_status: string;
  species_or_product: string | null;
  quantity: string | null;
  price: string | null;
  location: string | null;
  state: string | null;
  shipping_available: boolean;
  local_pickup_available: boolean;
  expo_name: string | null;
  expiration_date: string | null;
  preferred_contact_method: string | null;
  permit_notes: string | null;
};

export type InlineBadge = {
  id: string;
  label: string;
  description: string | null;
  color: string | null;
  icon: string | null;
};

export function communityExcerpt(body: string, maxLength = 180) {
  const cleaned = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > maxLength
    ? `${cleaned.slice(0, maxLength).trim()}...`
    : cleaned;
}

export function communitySlug(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || crypto.randomUUID();
}

export function communityProfileName(profile: CommunityProfile | null) {
  return (
    profile?.display_name ||
    profile?.business_name ||
    profile?.username ||
    "Community member"
  );
}

export async function getCommunityCategories(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
) {
  const { data, error } = await supabase
    .from("community_categories")
    .select(
      `
      id,
      name,
      slug,
      description,
      icon,
      color,
      display_order,
      is_active,
      requires_approval,
      marketplace_rules,
      species_tagging_enabled,
      images_enabled,
      staff_only_posting,
      posting_guidelines,
      minimum_account_age_days
    `
    )
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .returns<CommunityCategory[]>();

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getCommunityCategoryBySlug(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  slug: string
) {
  const { data, error } = await supabase
    .from("community_categories")
    .select(
      `
      id,
      name,
      slug,
      description,
      icon,
      color,
      display_order,
      is_active,
      requires_approval,
      marketplace_rules,
      species_tagging_enabled,
      images_enabled,
      staff_only_posting,
      posting_guidelines,
      minimum_account_age_days
    `
    )
    .eq("slug", slug)
    .maybeSingle<CommunityCategory>();

  if (error) throw new Error(error.message);
  return data;
}

export async function getCommunityDiscussions(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  options: {
    categorySlug?: string;
    authorId?: string;
    savedBy?: string;
    followedBy?: string;
    search?: string;
    sort?: string;
    limit?: number;
    contentType?: string;
    unansweredOnly?: boolean;
  } = {}
) {
  let query = supabase
    .from("community_discussions")
    .select(
      `
      id,
      category_id,
      author_id,
      slug,
      title,
      body,
      excerpt,
      content_type,
      status,
      pinned,
      pinned_until,
      featured,
      locked,
      answered,
      accepted_reply_id,
      reply_count,
      view_count,
      save_count,
      follow_count,
      report_count,
      last_activity_at,
      created_at,
      updated_at,
      edited_at,
      author:author_id (
        id,
        username,
        display_name,
        business_name
      ),
      category:category_id (
        id,
        name,
        slug,
        description,
        icon,
        color,
        display_order,
        is_active,
        requires_approval,
        marketplace_rules,
        species_tagging_enabled,
        images_enabled,
        staff_only_posting,
        posting_guidelines,
        minimum_account_age_days
      )
    `
    )
    .in("status", ["published", "expired"]);

  if (options.categorySlug) {
    const category = await getCommunityCategoryBySlug(supabase, options.categorySlug);
    if (!category) return [];
    query = query.eq("category_id", category.id);
  }

  if (options.authorId) query = query.eq("author_id", options.authorId);
  if (options.contentType) query = query.eq("content_type", options.contentType);
  if (options.unansweredOnly) query = query.eq("answered", false).eq("content_type", "question");
  if (options.search) {
    const term = options.search.trim();
    if (term) query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
  }

  const sort = options.sort || "active";
  if (sort === "newest") {
    query = query.order("created_at", { ascending: false });
  } else if (sort === "replies") {
    query = query.order("reply_count", { ascending: false }).order("last_activity_at", { ascending: false });
  } else if (sort === "views") {
    query = query.order("view_count", { ascending: false }).order("last_activity_at", { ascending: false });
  } else if (sort === "saved") {
    query = query.order("save_count", { ascending: false }).order("last_activity_at", { ascending: false });
  } else {
    query = query.order("pinned", { ascending: false }).order("last_activity_at", { ascending: false });
  }

  const { data, error } = await query
    .limit(options.limit || 30)
    .returns<CommunityDiscussion[]>();

  if (error) throw new Error(error.message);

  let rows = data || [];

  if (options.savedBy) {
    const { data: saves } = await supabase
      .from("community_saves")
      .select("discussion_id")
      .eq("profile_id", options.savedBy)
      .returns<Array<{ discussion_id: string }>>();
    const savedIds = new Set((saves || []).map((save) => save.discussion_id));
    rows = rows.filter((discussion) => savedIds.has(discussion.id));
  }

  if (options.followedBy) {
    const { data: follows } = await supabase
      .from("community_follows")
      .select("discussion_id")
      .eq("profile_id", options.followedBy)
      .returns<Array<{ discussion_id: string }>>();
    const followedIds = new Set((follows || []).map((follow) => follow.discussion_id));
    rows = rows.filter((discussion) => followedIds.has(discussion.id));
  }

  return rows;
}

export async function getInlineBadgesForProfiles(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profileIds: string[],
  maxBadges = 3
) {
  const uniqueIds = [...new Set(profileIds.filter(Boolean))];
  const badgesByProfile = new Map<string, InlineBadge[]>();
  if (!uniqueIds.length) return badgesByProfile;

  const { data, error } = await supabase
    .from("profile_badge_assignments")
    .select(
      `
      profile_id,
      assigned_at,
      profile_badges:badge_id (
        id,
        label,
        description,
        color,
        icon,
        is_active,
        profile_only,
        allow_inline_display,
        default_priority
      )
    `
    )
    .in("profile_id", uniqueIds)
    .returns<
      Array<{
        profile_id: string;
        assigned_at: string | null;
        profile_badges: (InlineBadge & {
          is_active: boolean;
          profile_only: boolean;
          allow_inline_display: boolean;
          default_priority: number;
        }) | null;
      }>
    >();

  if (error) return badgesByProfile;

  const { data: settings } = await supabase
    .from("user_badge_display_settings")
    .select("profile_id, badge_id, is_visible, show_inline, display_order")
    .in("profile_id", uniqueIds)
    .returns<
      Array<{
        profile_id: string;
        badge_id: string;
        is_visible: boolean;
        show_inline: boolean;
        display_order: number;
      }>
    >();

  const settingsByProfileBadge = new Map(
    (settings || []).map((setting) => [
      `${setting.profile_id}:${setting.badge_id}`,
      setting,
    ])
  );

  for (const profileId of uniqueIds) {
    const profileBadges = (data || [])
      .filter((row) => row.profile_id === profileId && row.profile_badges)
      .filter((row) => {
        const badge = row.profile_badges;
        if (!badge?.is_active || badge.profile_only || !badge.allow_inline_display) return false;
        const setting = settingsByProfileBadge.get(`${profileId}:${badge.id}`);
        return setting ? setting.is_visible && setting.show_inline : true;
      })
      .sort((left, right) => {
        const leftBadge = left.profile_badges;
        const rightBadge = right.profile_badges;
        if (!leftBadge || !rightBadge) return 0;
        const leftSetting = settingsByProfileBadge.get(`${profileId}:${leftBadge.id}`);
        const rightSetting = settingsByProfileBadge.get(`${profileId}:${rightBadge.id}`);
        const orderDiff =
          (leftSetting?.display_order ?? leftBadge.default_priority ?? 100) -
          (rightSetting?.display_order ?? rightBadge.default_priority ?? 100);
        if (orderDiff !== 0) return orderDiff;
        return String(left.assigned_at || "").localeCompare(String(right.assigned_at || ""));
      })
      .slice(0, maxBadges)
      .flatMap((row) => {
        const badge = row.profile_badges;
        if (!badge) return [];
        return [
          {
            id: badge.id,
            label: badge.label,
            description: badge.description,
            color: badge.color,
            icon: badge.icon,
          },
        ];
      });

    badgesByProfile.set(profileId, profileBadges);
  }

  return badgesByProfile;
}
