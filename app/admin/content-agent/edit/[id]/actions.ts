"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { publishSingleContentPost } from "@/lib/content-agent/generator";

const VALID_STATUSES = new Set([
  "Draft",
  "Needs Edit",
  "Approved",
  "Rejected",
  "Posted",
  "Error",
]);

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function redirectWithNotice(postId: string, message: string): never {
  revalidatePath("/admin/content-agent");
  revalidatePath(`/admin/content-agent/edit/${postId}`);
  redirect(`/admin/content-agent/edit/${postId}?notice=${encodeURIComponent(message)}`);
}

function redirectWithError(postId: string, error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  revalidatePath(`/admin/content-agent/edit/${postId}`);
  redirect(`/admin/content-agent/edit/${postId}?error=${encodeURIComponent(message.slice(0, 1400))}`);
}

function parseScheduledAt(value: string) {
  if (!value) throw new Error("Scheduled date/time is required.");

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Scheduled date/time is invalid.");
  }

  return date.toISOString();
}

export async function updateContentAgentPost(formData: FormData) {
  await requireContentAgentAdmin();

  const postId = textValue(formData, "post_id");

  try {
    if (!postId) throw new Error("Missing post ID.");

    const status = textValue(formData, "status") || "Draft";

    if (!VALID_STATUSES.has(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const clearError = formData.get("clear_error") === "on";

    const update = {
      scheduled_at: parseScheduledAt(textValue(formData, "scheduled_at")),
      status,
      topic: textValue(formData, "topic") || null,
      caption: textValue(formData, "caption") || null,
      hashtags: textValue(formData, "hashtags") || null,
      meme_top_text: textValue(formData, "meme_top_text") || null,
      meme_bottom_text: textValue(formData, "meme_bottom_text") || null,
      image_prompt: textValue(formData, "image_prompt") || null,
      image_url: textValue(formData, "image_url") || null,
      approval_notes: textValue(formData, "approval_notes") || null,
      error: clearError ? null : textValue(formData, "error") || null,
      updated_at: new Date().toISOString(),
    };

    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from("content_agent_posts")
      .update(update)
      .eq("id", postId);

    if (error) throw new Error(error.message);

    await supabase.from("content_agent_logs").insert({
      action: "post_update",
      entity_type: "post",
      entity_id: postId,
      result: "OK",
      details: `Updated content-agent post ${postId}.`,
    });

    redirectWithNotice(postId, "Saved post changes.");
  } catch (error) {
    redirectWithError(postId || "unknown", error);
  }
}

export async function approvePostFromEditor(postId: string) {
  await requireContentAgentAdmin();

  try {
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from("content_agent_posts")
      .update({
        status: "Approved",
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);

    if (error) throw new Error(error.message);

    await supabase.from("content_agent_logs").insert({
      action: "post_approve",
      entity_type: "post",
      entity_id: postId,
      result: "OK",
      details: `Approved content-agent post ${postId}.`,
    });

    redirectWithNotice(postId, "Post approved.");
  } catch (error) {
    redirectWithError(postId, error);
  }
}

export async function rejectPostFromEditor(postId: string) {
  await requireContentAgentAdmin();

  try {
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from("content_agent_posts")
      .update({
        status: "Rejected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);

    if (error) throw new Error(error.message);

    await supabase.from("content_agent_logs").insert({
      action: "post_reject",
      entity_type: "post",
      entity_id: postId,
      result: "OK",
      details: `Rejected content-agent post ${postId}.`,
    });

    redirectWithNotice(postId, "Post rejected.");
  } catch (error) {
    redirectWithError(postId, error);
  }
}

export async function publishPostFromEditor(postId: string) {
  await requireContentAgentAdmin();

  try {
    const message = await publishSingleContentPost(postId);
    redirectWithNotice(postId, message);
  } catch (error) {
    redirectWithError(postId, error);
  }
}
