"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { requestedTopicSeeds } from "@/lib/content-agent/topic-seeds";

function redirectWithNotice(message: string, pageKey?: string): never {
  revalidatePath("/admin/content-agent/topics");
  const suffix = pageKey ? `&page=${encodeURIComponent(pageKey)}` : "";
  redirect(`/admin/content-agent/topics?notice=${encodeURIComponent(message)}${suffix}`);
}

function redirectWithError(error: unknown, pageKey?: string): never {
  const message = error instanceof Error ? error.message : String(error);
  revalidatePath("/admin/content-agent/topics");
  const suffix = pageKey ? `&page=${encodeURIComponent(pageKey)}` : "";
  redirect(`/admin/content-agent/topics?error=${encodeURIComponent(message.slice(0, 1400))}${suffix}`);
}

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function normalizeMatch(value: string | null | undefined) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

type ContentAgentPageSeedRow = {
  page_key: string;
  page_name: string;
};

function findSeedPage(
  pages: ContentAgentPageSeedRow[],
  matchers: string[]
) {
  const normalizedMatchers = matchers.map(normalizeMatch);

  return pages.find((page) => {
    const pageKey = normalizeMatch(page.page_key);
    const pageName = normalizeMatch(page.page_name);

    return normalizedMatchers.some(
      (matcher) =>
        pageKey === matcher ||
        pageName === matcher ||
        pageKey.includes(matcher) ||
        pageName.includes(matcher)
    );
  });
}

export async function seedRequestedTopicPack() {
  await requireContentAgentAdmin();

  try {
    const supabase = createSupabaseAdminClient();

    const [{ data: pages, error: pagesError }, { data: existing, error: existingError }] =
      await Promise.all([
        supabase
          .from("content_agent_pages")
          .select("page_key, page_name")
          .returns<ContentAgentPageSeedRow[]>(),
        supabase
          .from("content_agent_topics")
          .select("page_key, topic")
          .returns<Array<{ page_key: string; topic: string }>>(),
      ]);

    if (pagesError) throw new Error(pagesError.message);
    if (existingError) throw new Error(existingError.message);

    const existingKeys = new Set(
      (existing || []).map(
        (topic) => `${topic.page_key}:${normalizeMatch(topic.topic)}`
      )
    );

    const missingPages = new Set<string>();
    const rowsToInsert = requestedTopicSeeds.flatMap((seed) => {
      const page = findSeedPage(pages || [], seed.pageMatchers);

      if (!page) {
        missingPages.add(seed.brand);
        return [];
      }

      const duplicateKey = `${page.page_key}:${normalizeMatch(seed.topic)}`;

      if (existingKeys.has(duplicateKey)) {
        return [];
      }

      existingKeys.add(duplicateKey);

      return [
        {
          page_key: page.page_key,
          topic: seed.topic,
          post_type: seed.postType,
          notes: seed.notes,
          active: true,
          use_count: 0,
        },
      ];
    });

    if (rowsToInsert.length > 0) {
      const { error } = await supabase
        .from("content_agent_topics")
        .insert(rowsToInsert);

      if (error) throw new Error(error.message);
    }

    await supabase.from("content_agent_logs").insert({
      action: "topic_seed_requested_pack",
      entity_type: "topic",
      result: "OK",
      details: `Inserted ${rowsToInsert.length} requested topic seeds. Missing page groups: ${
        Array.from(missingPages).join(", ") || "none"
      }.`,
    });

    redirectWithNotice(
      `Added ${rowsToInsert.length} fresh topic${
        rowsToInsert.length === 1 ? "" : "s"
      }. ${
        missingPages.size
          ? `Could not find pages for: ${Array.from(missingPages).join(", ")}.`
          : "Duplicates were skipped automatically."
      }`
    );
  } catch (error) {
    redirectWithError(error);
  }
}

export async function createContentAgentTopic(formData: FormData) {
  await requireContentAgentAdmin();

  const pageKey = textValue(formData, "page_key");

  try {
    const supabase = createSupabaseAdminClient();

    const topic = textValue(formData, "topic");
    const postType = textValue(formData, "post_type");
    const notes = textValue(formData, "notes");

    if (!pageKey) throw new Error("Page is required.");
    if (!topic) throw new Error("Topic is required.");
    if (!postType) throw new Error("Post type is required.");

    const { error } = await supabase.from("content_agent_topics").insert({
      page_key: pageKey,
      topic,
      post_type: postType,
      notes: notes || null,
      active: true,
      use_count: 0,
    });

    if (error) throw new Error(error.message);

    await supabase.from("content_agent_logs").insert({
      action: "topic_create",
      entity_type: "topic",
      entity_id: pageKey,
      result: "OK",
      details: `Created topic "${topic}" for ${pageKey}.`,
    });

    redirectWithNotice(`Created topic "${topic}".`, pageKey);
  } catch (error) {
    redirectWithError(error, pageKey);
  }
}

export async function updateContentAgentTopic(formData: FormData) {
  await requireContentAgentAdmin();

  const topicId = textValue(formData, "topic_id");
  const pageKey = textValue(formData, "page_key");

  try {
    const supabase = createSupabaseAdminClient();

    const topic = textValue(formData, "topic");
    const postType = textValue(formData, "post_type");
    const notes = textValue(formData, "notes");

    if (!topicId) throw new Error("Missing topic ID.");
    if (!topic) throw new Error("Topic is required.");
    if (!postType) throw new Error("Post type is required.");

    const { error } = await supabase
      .from("content_agent_topics")
      .update({
        topic,
        post_type: postType,
        notes: notes || null,
        active: checkboxValue(formData, "active"),
        updated_at: new Date().toISOString(),
      })
      .eq("id", topicId);

    if (error) throw new Error(error.message);

    await supabase.from("content_agent_logs").insert({
      action: "topic_update",
      entity_type: "topic",
      entity_id: topicId,
      result: "OK",
      details: `Updated topic "${topic}".`,
    });

    redirectWithNotice(`Updated topic "${topic}".`, pageKey);
  } catch (error) {
    redirectWithError(error, pageKey);
  }
}

export async function setContentAgentTopicActive(topicId: string, pageKey: string, active: boolean) {
  await requireContentAgentAdmin();

  try {
    const supabase = createSupabaseAdminClient();

    const { data: topic, error: readError } = await supabase
      .from("content_agent_topics")
      .select("topic")
      .eq("id", topicId)
      .maybeSingle();

    if (readError) throw new Error(readError.message);

    const { error } = await supabase
      .from("content_agent_topics")
      .update({
        active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", topicId);

    if (error) throw new Error(error.message);

    await supabase.from("content_agent_logs").insert({
      action: active ? "topic_activate" : "topic_deactivate",
      entity_type: "topic",
      entity_id: topicId,
      result: "OK",
      details: `${active ? "Activated" : "Deactivated"} topic "${topic?.topic || topicId}".`,
    });

    redirectWithNotice(`${active ? "Activated" : "Deactivated"} topic "${topic?.topic || topicId}".`, pageKey);
  } catch (error) {
    redirectWithError(error, pageKey);
  }
}

export async function deleteContentAgentTopic(topicId: string, pageKey: string) {
  await requireContentAgentAdmin();

  try {
    const supabase = createSupabaseAdminClient();

    const { data: topic, error: readError } = await supabase
      .from("content_agent_topics")
      .select("topic")
      .eq("id", topicId)
      .maybeSingle();

    if (readError) throw new Error(readError.message);

    const { error } = await supabase
      .from("content_agent_topics")
      .delete()
      .eq("id", topicId);

    if (error) throw new Error(error.message);

    await supabase.from("content_agent_logs").insert({
      action: "topic_delete",
      entity_type: "topic",
      entity_id: topicId,
      result: "OK",
      details: `Deleted topic "${topic?.topic || topicId}".`,
    });

    redirectWithNotice(`Deleted topic "${topic?.topic || topicId}".`, pageKey);
  } catch (error) {
    redirectWithError(error, pageKey);
  }
}
