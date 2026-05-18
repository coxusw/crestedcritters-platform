"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";

function redirectWithNotice(message: string): never {
  revalidatePath("/admin/content-agent/settings");
  revalidatePath("/admin/content-agent");
  redirect(`/admin/content-agent/settings?notice=${encodeURIComponent(message)}`);
}

function redirectWithError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  revalidatePath("/admin/content-agent/settings");
  redirect(`/admin/content-agent/settings?error=${encodeURIComponent(message.slice(0, 1400))}`);
}

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function numberValue(formData: FormData, key: string, fallback: number) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function parseScheduleSlots(formData: FormData) {
  const slots: Array<{ time: string; postType: string }> = [];

  for (let i = 0; i < 10; i += 1) {
    const time = textValue(formData, `slot_time_${i}`);
    const postType = textValue(formData, `slot_type_${i}`);

    if (!time && !postType) continue;
    if (!time || !postType) {
      throw new Error(`Schedule row ${i + 1} needs both a time and a post type.`);
    }

    if (!/^\d{2}:\d{2}$/.test(time)) {
      throw new Error(`Schedule row ${i + 1} time must use 24-hour HH:MM format, like 09:00 or 20:30.`);
    }

    slots.push({ time, postType });
  }

  if (!slots.length) {
    throw new Error("Add at least one schedule slot.");
  }

  return slots;
}

function parseContentCycle(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePageKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
}

function defaultTokenEnvKey(pageKey: string) {
  return `META_PAGE_TOKEN_${pageKey.toUpperCase()}`;
}

function normalizeMatchValue(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeStoredScheduleSlots(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((slot) => {
      const rawSlot = slot as Partial<{ time: unknown; postType: unknown }>;
      return {
        time: String(rawSlot.time || "").trim(),
        postType: String(rawSlot.postType || "").trim(),
      };
    })
    .filter((slot) => slot.time && slot.postType);
}

function ensureScheduleSlot(
  slots: Array<{ time: string; postType: string }>,
  desiredSlot: { time: string; postType: string }
) {
  const desiredType = normalizeMatchValue(desiredSlot.postType);
  const hasSlot = slots.some((slot) => normalizeMatchValue(slot.postType) === desiredType);

  return hasSlot ? slots : [...slots, desiredSlot];
}

function findPageByMatchers(
  pages: Array<{ page_key: string; page_name: string }>,
  matchers: string[]
) {
  const normalizedMatchers = matchers.map(normalizeMatchValue);

  return pages.find((page) => {
    const key = normalizeMatchValue(page.page_key);
    const name = normalizeMatchValue(page.page_name);

    return normalizedMatchers.some(
      (matcher) =>
        key === matcher ||
        name === matcher ||
        key.includes(matcher) ||
        name.includes(matcher)
    );
  });
}

const recommendedSchedules = [
  {
    label: "Poverty Finance",
    matchers: ["povertyfinance", "poverty finance"],
    slots: [
      { time: "08:30", postType: "Broke Tip" },
      { time: "12:30", postType: "Real Finance Tip" },
      { time: "18:30", postType: "Broke Roast" },
      { time: "20:30", postType: "Broke Meme" },
      { time: "21:15", postType: "Satire Humor" },
    ],
  },
  {
    label: "Crested Critters",
    matchers: ["crested", "crestedcritters", "crested critters"],
    slots: [
      { time: "09:00", postType: "Care Tip" },
      { time: "13:00", postType: "Isopod Fact" },
      { time: "17:30", postType: "Engagement Question" },
      { time: "20:00", postType: "Meme" },
    ],
  },
  {
    label: "Tap-Deck",
    matchers: ["tapdeck", "tap-deck", "tap deck"],
    slots: [
      { time: "08:15", postType: "Networking Tip" },
      { time: "11:45", postType: "Marketing Tip" },
      { time: "15:30", postType: "Sales Networking Tip" },
      { time: "18:15", postType: "Advertising Tip" },
    ],
  },
  {
    label: "Isopedia",
    matchers: ["isopedia", "isopeida"],
    slots: [
      { time: "10:00", postType: "Growth Post" },
      { time: "16:00", postType: "Community Stats" },
    ],
  },
] satisfies Array<{
  label: string;
  matchers: string[];
  slots: Array<{ time: string; postType: string }>;
}>;

export async function updateContentAgentPageSettings(formData: FormData) {
  await requireContentAgentAdmin();

  try {
    const supabase = createSupabaseAdminClient();
    const pageKey = textValue(formData, "page_key");

    if (!pageKey) throw new Error("Missing page_key.");

    const scheduleSlots = parseScheduleSlots(formData);
    const contentCycle = parseContentCycle(textValue(formData, "content_cycle"));

    const update = {
      active: checkboxValue(formData, "active"),
      auto_approve_generated: checkboxValue(formData, "auto_approve_generated"),
      auto_publish_enabled: checkboxValue(formData, "auto_publish_enabled"),
      target_buffer_days: Math.max(1, numberValue(formData, "target_buffer_days", 30)),
      meta_page_id: textValue(formData, "meta_page_id") || null,
      website_url: textValue(formData, "website_url") || null,
      default_hashtags: textValue(formData, "default_hashtags") || null,
      brand_rules: textValue(formData, "brand_rules") || null,
      text_style: textValue(formData, "text_style") || null,
      meme_style: textValue(formData, "meme_style") || null,
      schedule_slots: scheduleSlots,
      content_cycle: contentCycle,
      updated_at: new Date().toISOString(),
    };

    const { data: page, error: readError } = await supabase
      .from("content_agent_pages")
      .select("page_name")
      .eq("page_key", pageKey)
      .maybeSingle();

    if (readError) throw new Error(readError.message);

    const { error } = await supabase
      .from("content_agent_pages")
      .update(update)
      .eq("page_key", pageKey);

    if (error) throw new Error(error.message);

    await supabase.from("content_agent_logs").insert({
      action: "settings_update",
      entity_type: "page",
      entity_id: pageKey,
      result: "OK",
      details: `Updated settings for ${page?.page_name || pageKey}.`,
    });

    redirectWithNotice(`Saved settings for ${page?.page_name || pageKey}.`);
  } catch (error) {
    redirectWithError(error);
  }
}

export async function createContentAgentPage(formData: FormData) {
  await requireContentAgentAdmin();

  try {
    const supabase = createSupabaseAdminClient();

    const pageName = textValue(formData, "page_name");
    const pageKey = normalizePageKey(textValue(formData, "page_key") || pageName);
    const metaPageId = textValue(formData, "meta_page_id");
    const tokenEnvKey = textValue(formData, "token_env_key") || defaultTokenEnvKey(pageKey);

    if (!pageName) throw new Error("Page name is required.");
    if (!pageKey) throw new Error("Page key is required.");

    const firstTime = textValue(formData, "first_time") || "09:00";
    const firstPostType = textValue(formData, "first_post_type") || "Informational";

    const { error } = await supabase.from("content_agent_pages").insert({
      page_key: pageKey,
      page_name: pageName,
      active: true,
      auto_publish_enabled: false,
      auto_approve_generated: false,
      meta_page_id: metaPageId || null,
      token_env_key: tokenEnvKey,
      target_buffer_days: 30,
      schedule_slots: [{ time: firstTime, postType: firstPostType }],
      content_cycle: [],
      default_hashtags: "",
      brand_rules: "Helpful, family-friendly Facebook content for this page.",
      text_style: "Clear, conversational, useful Facebook posts.",
      meme_style: "",
      website_url: "",
    });

    if (error) throw new Error(error.message);

    await supabase.from("content_agent_logs").insert({
      action: "settings_create_page",
      entity_type: "page",
      entity_id: pageKey,
      result: "OK",
      details: `Created page ${pageName} using token env ${tokenEnvKey}.`,
    });

    redirectWithNotice(`Created ${pageName}. Add ${tokenEnvKey} in Vercel if you have not already.`);
  } catch (error) {
    redirectWithError(error);
  }
}

export async function applyRecommendedTopicRotationSchedule() {
  await requireContentAgentAdmin();

  try {
    const supabase = createSupabaseAdminClient();

    const { data: pages, error: readError } = await supabase
      .from("content_agent_pages")
      .select("page_key,page_name");

    if (readError) throw new Error(readError.message);

    const foundPages: string[] = [];
    const missingPages: string[] = [];

    for (const schedule of recommendedSchedules) {
      const page = findPageByMatchers(pages || [], schedule.matchers);

      if (!page) {
        missingPages.push(schedule.label);
        continue;
      }

      const { error } = await supabase
        .from("content_agent_pages")
        .update({
          schedule_slots: schedule.slots,
          content_cycle: [],
          updated_at: new Date().toISOString(),
        })
        .eq("page_key", page.page_key);

      if (error) throw new Error(error.message);
      foundPages.push(`${page.page_name || schedule.label}: ${schedule.slots.map((slot) => slot.postType).join(", ")}`);
    }

    if (!foundPages.length) {
      throw new Error("No matching content agent pages were found for the recommended schedule.");
    }

    await supabase.from("content_agent_logs").insert({
      action: "settings_recommended_topic_rotation",
      entity_type: "page",
      entity_id: "recommended-topic-rotation",
      result: "OK",
      details: [
        "Applied recommended topic rotation schedules and cleared content cycle overrides.",
        ...foundPages,
        missingPages.length ? `Missing pages: ${missingPages.join(", ")}` : "Missing pages: none",
      ].join("\n"),
    });

    redirectWithNotice(
      [
        "Applied recommended topic rotation schedules and cleared content cycle overrides.",
        ...foundPages,
        missingPages.length ? `Missing pages: ${missingPages.join(", ")}` : "Missing pages: none",
      ].join("\n")
    );
  } catch (error) {
    redirectWithError(error);
  }
}

export async function applyDailyMemeSchedule() {
  await requireContentAgentAdmin();

  try {
    const supabase = createSupabaseAdminClient();

    const { data: pages, error: readError } = await supabase
      .from("content_agent_pages")
      .select("page_key,page_name,schedule_slots");

    if (readError) throw new Error(readError.message);

    const crestedPage = (pages || []).find((page) => {
      const key = normalizeMatchValue(page.page_key);
      const name = normalizeMatchValue(page.page_name);
      return key === "crested" || key === "crestedcritters" || name.includes("crested");
    });

    const povertyPage = (pages || []).find((page) => {
      const key = normalizeMatchValue(page.page_key);
      const name = normalizeMatchValue(page.page_name);
      return key === "povertyfinance" || name.includes("povertyfinance");
    });

    const updates: Array<{
      pageKey: string;
      scheduleSlots: Array<{ time: string; postType: string }>;
    }> = [];
    const updatedNames: string[] = [];

    if (crestedPage) {
      const scheduleSlots = ensureScheduleSlot(
        normalizeStoredScheduleSlots(crestedPage.schedule_slots),
        { time: "20:00", postType: "Meme" }
      );

      updates.push({ pageKey: crestedPage.page_key, scheduleSlots });
      updatedNames.push(`${crestedPage.page_name || "Crested Critters"}: daily Meme image slot`);
    }

    if (povertyPage) {
      const scheduleSlots = ensureScheduleSlot(
        normalizeStoredScheduleSlots(povertyPage.schedule_slots),
        { time: "20:30", postType: "Broke Meme" }
      );

      updates.push({ pageKey: povertyPage.page_key, scheduleSlots });
      updatedNames.push(`${povertyPage.page_name || "Poverty Finance"}: daily Broke Meme image slot`);
    }

    if (!updates.length) {
      throw new Error("Could not find Crested Critters or Poverty Finance in content_agent_pages.");
    }

    for (const update of updates) {
      const { error } = await supabase
        .from("content_agent_pages")
        .update({
          schedule_slots: update.scheduleSlots,
          content_cycle: [],
          updated_at: new Date().toISOString(),
        })
        .eq("page_key", update.pageKey);

      if (error) throw new Error(error.message);
    }

    await supabase.from("content_agent_logs").insert({
      action: "settings_daily_meme_schedule",
      entity_type: "page",
      entity_id: "daily-meme-schedule",
      result: "OK",
      details: `Applied daily meme image slots.\n${updatedNames.join("\n")}\nContent cycle overrides were cleared on those pages so schedule slot types rotate directly.`,
    });

    redirectWithNotice(
      `Applied daily meme image slots.\n${updatedNames.join("\n")}\nContent cycle overrides were cleared on those pages so schedule slot types rotate directly.`
    );
  } catch (error) {
    redirectWithError(error);
  }
}
