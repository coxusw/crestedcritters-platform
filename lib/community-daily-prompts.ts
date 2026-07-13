import { revalidatePath } from "next/cache";
import { createCommunityDiscussionAnnouncement } from "@/lib/content-agent/isopedia";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { communityExcerpt, communitySlug } from "@/lib/community";

type DailyPromptDefinition = {
  weekday: number;
  title: string;
  slug: string;
  body: string;
};

const CENTRAL_TIME_ZONE = "America/Chicago";
const DAILY_PROMPTS: DailyPromptDefinition[] = [
  {
    weekday: 2,
    title: "Tank Tuesday",
    slug: "tank-tuesday",
    body: [
      "It is Tank Tuesday.",
      "",
      "Show us a tank, bin, terrarium, enclosure, plant setup, hardscape, ventilation tweak, or cleanup crew setup you are working with this week.",
      "",
      "A few easy ideas:",
      "- Full setup photos",
      "- Before and after changes",
      "- Moisture or ventilation tweaks",
      "- Plants, bark, moss, leaves, or hides that are working well",
      "- Anything you want feedback on",
    ].join("\n"),
  },
  {
    weekday: 5,
    title: "Bin Check Friday",
    slug: "bin-check-friday",
    body: [
      "It is Bin Check Friday.",
      "",
      "Share what you noticed during this week's bin checks.",
      "",
      "A few easy ideas:",
      "- New mancae, molts, or breeding activity",
      "- Foods that got a strong response",
      "- Moisture, ventilation, or substrate observations",
      "- Anything concerning you want another set of eyes on",
      "- A simple stable-bin update",
    ].join("\n"),
  },
  {
    weekday: 6,
    title: "Show Off Saturday",
    slug: "show-off-saturday",
    body: [
      "It is Show Off Saturday.",
      "",
      "Show off your favorite pictures from this week. Isopods, springtails, terrariums, plants, bins, enclosures, colonies, cleanup crews, and fun hobby moments are all welcome.",
      "",
      "A few easy ideas:",
      "- Favorite colony photo",
      "- Best macro shot",
      "- New setup or build",
      "- A species or morph you are proud of",
      "- A tiny detail you think other keepers would enjoy",
    ].join("\n"),
  },
];

function centralDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const weekdayName = value("weekday");
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    weekday,
  };
}

function datedTitle(prompt: DailyPromptDefinition, dateParts: ReturnType<typeof centralDateParts>) {
  return `${dateParts.month}/${dateParts.day}/${dateParts.year} - ${prompt.title}`;
}

function datedSlug(prompt: DailyPromptDefinition, dateParts: ReturnType<typeof centralDateParts>) {
  return `${communitySlug(prompt.slug)}-${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

export async function generateTodaysCommunityPrompt(now = new Date()) {
  const dateParts = centralDateParts(now);
  const prompt = DAILY_PROMPTS.find((item) => item.weekday === dateParts.weekday);

  if (!prompt) {
    return {
      created: false,
      skipped: true,
      reason: "No recurring community prompt is scheduled for today.",
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: category, error: categoryError } = await supabase
    .from("community_categories")
    .select("id, name, slug")
    .eq("slug", "general-discussion")
    .maybeSingle<{ id: string; name: string; slug: string }>();

  if (categoryError) throw new Error(categoryError.message);
  if (!category) throw new Error("General Discussion category was not found.");

  const title = datedTitle(prompt, dateParts);
  const slug = datedSlug(prompt, dateParts);
  const { data: existing, error: existingError } = await supabase
    .from("community_discussions")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle<{ id: string; slug: string }>();

  if (existingError) throw new Error(existingError.message);

  if (existing) {
    return {
      created: false,
      skipped: true,
      reason: "Today's recurring community prompt already exists.",
      slug: existing.slug,
    };
  }

  const discussionId = crypto.randomUUID();
  const pinnedUntil = new Date(now);
  pinnedUntil.setDate(pinnedUntil.getDate() + 1);

  const { error: insertError } = await supabase.from("community_discussions").insert({
    id: discussionId,
    category_id: category.id,
    author_id: null,
    slug,
    title,
    body: prompt.body,
    excerpt: communityExcerpt(prompt.body),
    content_type: "prompt",
    pinned: true,
    pinned_until: pinnedUntil.toISOString(),
    status: "published",
    moderation_status: "clear",
  });

  if (insertError) throw new Error(insertError.message);

  await createCommunityDiscussionAnnouncement({
    id: discussionId,
    slug,
    title,
    body: prompt.body,
    contentType: "prompt",
    categoryName: category.name,
    authorId: null,
    actorName: "Isopedia",
  });

  revalidatePath("/community");
  revalidatePath(`/community/category/${category.slug}`);
  revalidatePath(`/community/discussion/${slug}`);

  return {
    created: true,
    skipped: false,
    title,
    slug,
  };
}
