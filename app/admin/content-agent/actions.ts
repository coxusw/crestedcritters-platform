"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import {
  generateNextPostsForActivePages,
  postApprovedDueContent,
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

  try {
    const results = await generateNextPostsForActivePages();
    redirectWithNotice(results.length ? results.join(" | ") : "Generate Next Posts finished.");
  } catch (error) {
    redirectWithError(error);
  }
}

export async function generateNextImageAction() {
  await requireContentAgentAdmin();

  try {
    const result = await generateImageForNextPost();
    redirectWithNotice(
      typeof result === "string" ? result : JSON.stringify(result)
    );
  } catch (error) {
    redirectWithError(error);
  }
}

export async function postDueAction() {
  await requireContentAgentAdmin();

  try {
    const results = await postApprovedDueContent();
    redirectWithNotice(results.length ? results.join(" | ") : "Post Approved Due finished.");
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

export async function createLatestSpeciesAnnouncementAction() {
  await requireContentAgentAdmin();

  try {
    const result = await createLatestSpeciesAnnouncement();
    redirectWithNotice(result);
  } catch (error) {
    redirectWithError(error);
  }
}

export async function createIsopediaStatsPostAction() {
  await requireContentAgentAdmin();

  try {
    const result = await createIsopediaStatsPost();
    redirectWithNotice(result);
  } catch (error) {
    redirectWithError(error);
  }
}

export async function createExpoRoundupPostAction() {
  await requireContentAgentAdmin();

  try {
    const result = await createExpoRoundupPost();
    redirectWithNotice(result);
  } catch (error) {
    redirectWithError(error);
  }
}
