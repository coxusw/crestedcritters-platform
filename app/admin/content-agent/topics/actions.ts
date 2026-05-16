"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";

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
