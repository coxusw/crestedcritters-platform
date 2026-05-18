"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import {
  generateNextPostsForActivePages,
  postApprovedDueContent,
  publishSingleContentPost,
} from "@/lib/content-agent/generator";
import { generateImageForNextPost } from "@/lib/content-agent/media";
import {
  createExpoRoundupPost,
  createIsopediaStatsPost,
  createLatestSpeciesAnnouncement,
} from "@/lib/content-agent/isopedia";

function redirectWithNotice(message: string): never {
  revalidatePath("/admin/content-agent");
  redirect(`/admin/content-agent?notice=${encodeURIComponent(message)}`);
}

function redirectWithError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  revalidatePath("/admin/content-agent");
  redirect(`/admin/content-agent?error=${encodeURIComponent(message.slice(0, 1400))}`);
}

async function requireAdminAndSupabase() {
  await requireContentAgentAdmin();
  return createSupabaseAdminClient();
}

export async function generateNextContentAction() {
  await requireContentAgentAdmin();

  let message = "Generate Next Posts finished.";

  try {
    const results = await generateNextPostsForActivePages();
    message = results.length ? results.join(" | ") : message;
  } catch (error) {
    redirectWithError(error);
  }

  redirectWithNotice(message);
}

export async function generateNextImageAction() {
  await requireContentAgentAdmin();

  let message = "Generate Next Image finished.";

  try {
    const result = await generateImageForNextPost();
    message = typeof result === "string" ? result : JSON.stringify(result);
  } catch (error) {
    redirectWithError(error);
  }

  redirectWithNotice(message);
}

export async function postDueAction() {
  await requireContentAgentAdmin();

  let message = "Post Approved Due finished.";

  try {
    const results = await postApprovedDueContent();
    message = results.length ? results.join(" | ") : message;
  } catch (error) {
    redirectWithError(error);
  }

  redirectWithNotice(message);
}

export async function clearDraftApprovedContentAction() {
  const supabase = await requireAdminAndSupabase();

  try {
    const { count, error } = await supabase
      .from("content_agent_posts")
      .delete({ count: "exact" })
      .in("status", ["Draft", "Approved"]);

    if (error) throw new Error(error.message);

    await supabase.from("content_agent_logs").insert({
      action: "clear_draft_approved",
      result: "OK",
      details: `Deleted ${count || 0} Draft/Approved generated posts for a fresh generation queue.`,
    });

    redirectWithNotice(`Cleared ${count || 0} Draft/Approved posts. Posted history was kept.`);
  } catch (error) {
    redirectWithError(error);
  }
}

export async function approveContentPost(postId: string) {
  const supabase = await requireAdminAndSupabase();

  const { error } = await supabase
    .from("content_agent_posts")
    .update({
      status: "Approved",
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/content-agent");
}

export async function rejectContentPost(postId: string) {
  const supabase = await requireAdminAndSupabase();

  const { error } = await supabase
    .from("content_agent_posts")
    .update({
      status: "Rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/content-agent");
}

export async function publishContentPostNow(postId: string) {
  await requireContentAgentAdmin();

  let message = "Post published.";

  try {
    message = await publishSingleContentPost(postId);
  } catch (error) {
    redirectWithError(error);
  }

  redirectWithNotice(message);
}

export async function createLatestSpeciesAnnouncementAction() {
  await requireContentAgentAdmin();

  let message = "Latest Species Post finished.";

  try {
    message = await createLatestSpeciesAnnouncement();
  } catch (error) {
    redirectWithError(error);
  }

  redirectWithNotice(message);
}

export async function createIsopediaStatsPostAction() {
  await requireContentAgentAdmin();

  let message = "Stats Recap finished.";

  try {
    message = await createIsopediaStatsPost();
  } catch (error) {
    redirectWithError(error);
  }

  redirectWithNotice(message);
}

export async function createExpoRoundupPostAction() {
  await requireContentAgentAdmin();

  let message = "Expo Roundup finished.";

  try {
    message = await createExpoRoundupPost();
  } catch (error) {
    redirectWithError(error);
  }

  redirectWithNotice(message);
}
