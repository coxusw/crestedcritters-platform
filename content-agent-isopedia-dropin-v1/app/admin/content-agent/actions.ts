"use server";

import { revalidatePath } from "next/cache";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { generateNextPostsForActivePages, postApprovedDueContent } from "@/lib/content-agent/generator";
import { generateImageForNextPost } from "@/lib/content-agent/media";
import { createExpoRoundupPost, createIsopediaStatsPost, createLatestSpeciesAnnouncement } from "@/lib/content-agent/isopedia";

async function requireAdminAndSupabase() {
  await requireContentAgentAdmin();
  return createSupabaseAdminClient();
}

export async function generateNextContentAction() { await requireContentAgentAdmin(); const results = await generateNextPostsForActivePages(); revalidatePath("/admin/content-agent"); return results.join("\n"); }
export async function generateNextImageAction() { await requireContentAgentAdmin(); const result = await generateImageForNextPost(); revalidatePath("/admin/content-agent"); return JSON.stringify(result); }
export async function postDueAction() { await requireContentAgentAdmin(); const results = await postApprovedDueContent(); revalidatePath("/admin/content-agent"); return results.join("\n"); }

export async function approveContentPost(postId: string) {
  const supabase = await requireAdminAndSupabase();
  const { error } = await supabase.from("content_agent_posts").update({ status: "Approved", error: null, updated_at: new Date().toISOString() }).eq("id", postId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/content-agent");
}

export async function rejectContentPost(postId: string) {
  const supabase = await requireAdminAndSupabase();
  const { error } = await supabase.from("content_agent_posts").update({ status: "Rejected", updated_at: new Date().toISOString() }).eq("id", postId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/content-agent");
}

export async function createLatestSpeciesAnnouncementAction() { await requireContentAgentAdmin(); const result = await createLatestSpeciesAnnouncement(); revalidatePath("/admin/content-agent"); return result; }
export async function createIsopediaStatsPostAction() { await requireContentAgentAdmin(); const result = await createIsopediaStatsPost(); revalidatePath("/admin/content-agent"); return result; }
export async function createExpoRoundupPostAction() { await requireContentAgentAdmin(); const result = await createExpoRoundupPost(); revalidatePath("/admin/content-agent"); return result; }
