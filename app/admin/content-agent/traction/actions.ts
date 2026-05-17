"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { calculateTractionScore } from "@/lib/content-agent/traction";

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function numberValue(formData: FormData, key: string) {
  const parsed = Number(textValue(formData, key) || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function redirectWithNotice(message: string, pageKey?: string): never {
  revalidatePath("/admin/content-agent/traction");
  const suffix = pageKey ? `&page=${encodeURIComponent(pageKey)}` : "";
  redirect(`/admin/content-agent/traction?notice=${encodeURIComponent(message)}${suffix}`);
}

function redirectWithError(error: unknown, pageKey?: string): never {
  const message = error instanceof Error ? error.message : String(error);
  revalidatePath("/admin/content-agent/traction");
  const suffix = pageKey ? `&page=${encodeURIComponent(pageKey)}` : "";
  redirect(`/admin/content-agent/traction?error=${encodeURIComponent(message.slice(0, 1400))}${suffix}`);
}

export async function updateTractionFromTable(formData: FormData) {
  await requireContentAgentAdmin();

  const postId = textValue(formData, "post_id");
  const pageKey = textValue(formData, "page_key");

  try {
    if (!postId) throw new Error("Missing post ID.");

    const supabase = createSupabaseAdminClient();

    const { data: post, error: readError } = await supabase
      .from("content_agent_posts")
      .select("raw_payload")
      .eq("id", postId)
      .maybeSingle();

    if (readError) throw new Error(readError.message);
    if (!post) throw new Error("Post not found.");

    const metrics = {
      reactions: numberValue(formData, "reactions"),
      comments: numberValue(formData, "comments"),
      shares: numberValue(formData, "shares"),
      saves: numberValue(formData, "saves"),
      notes: textValue(formData, "traction_notes"),
    };

    const rawPayload =
      post.raw_payload && typeof post.raw_payload === "object"
        ? (post.raw_payload as Record<string, unknown>)
        : {};

    const { error } = await supabase
      .from("content_agent_posts")
      .update({
        raw_payload: {
          ...rawPayload,
          traction: {
            ...metrics,
            score: calculateTractionScore(metrics),
            updatedAt: new Date().toISOString(),
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);

    if (error) throw new Error(error.message);

    await supabase.from("content_agent_logs").insert({
      action: "post_traction_update",
      entity_type: "post",
      entity_id: postId,
      result: "OK",
      details: `Updated traction metrics for content-agent post ${postId}.`,
    });

    redirectWithNotice("Saved traction metrics.", pageKey);
  } catch (error) {
    redirectWithError(error, pageKey);
  }
}
