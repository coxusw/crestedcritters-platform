"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { communityExcerpt, communitySlug } from "@/lib/community";

function textValue(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function boolValue(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ data: profile }, { data: adminProfile }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: string | null }>(),
    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
  ]);

  if (!adminProfile && profile?.role !== "admin" && profile?.role !== "moderator") {
    redirect("/admin/login");
  }

  return { user, supabase: createSupabaseAdminClient() };
}

export async function saveCommunityCategory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const categoryId = textValue(formData.get("category_id"));
  const name = textValue(formData.get("name"));
  const slug = textValue(formData.get("slug")) || communitySlug(name);

  if (!name) redirect("/admin/isopedia/community?error=category-name-required");

  const payload = {
    name,
    slug,
    description: textValue(formData.get("description")) || null,
    icon: textValue(formData.get("icon")) || null,
    color: textValue(formData.get("color")) || null,
    display_order: Number(formData.get("display_order") || 100),
    is_active: boolValue(formData.get("is_active")),
    requires_approval: boolValue(formData.get("requires_approval")),
    marketplace_rules: boolValue(formData.get("marketplace_rules")),
    species_tagging_enabled: boolValue(formData.get("species_tagging_enabled")),
    images_enabled: boolValue(formData.get("images_enabled")),
    staff_only_posting: boolValue(formData.get("staff_only_posting")),
    posting_guidelines: textValue(formData.get("posting_guidelines")) || null,
    minimum_account_age_days: Math.max(0, Number(formData.get("minimum_account_age_days") || 0)),
    updated_at: new Date().toISOString(),
  };

  const query = categoryId
    ? supabase.from("community_categories").update(payload).eq("id", categoryId)
    : supabase.from("community_categories").insert(payload);

  const { error } = await query;
  if (error) redirect(`/admin/isopedia/community?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/isopedia/community");
  revalidatePath("/community");
  redirect("/admin/isopedia/community?saved=category");
}

export async function resolveCommunityReport(formData: FormData) {
  const { user, supabase } = await requireAdmin();
  const reportId = textValue(formData.get("report_id"));
  const status = textValue(formData.get("status")) || "resolved";
  const notes = textValue(formData.get("moderator_notes")) || null;

  const { error } = await supabase
    .from("community_reports")
    .update({
      status,
      moderator_notes: notes,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (error) redirect(`/admin/isopedia/community?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/isopedia/community");
  redirect("/admin/isopedia/community?saved=report");
}

export async function moderateCommunityDiscussion(formData: FormData) {
  const { user, supabase } = await requireAdmin();
  const discussionId = textValue(formData.get("discussion_id"));
  const action = textValue(formData.get("action"));

  const updates: Record<string, string | boolean | null> = {
    updated_at: new Date().toISOString(),
  };

  if (action === "lock") updates.locked = true;
  if (action === "unlock") updates.locked = false;
  if (action === "pin") updates.pinned = true;
  if (action === "unpin") updates.pinned = false;
  if (action === "feature") updates.featured = true;
  if (action === "unfeature") updates.featured = false;
  if (action === "hide") updates.status = "hidden";
  if (action === "restore") updates.status = "published";
  if (action === "archive") updates.status = "archived";

  const { error } = await supabase
    .from("community_discussions")
    .update(updates)
    .eq("id", discussionId);

  if (error) redirect(`/admin/isopedia/community?error=${encodeURIComponent(error.message)}`);

  await supabase.from("community_moderation_history").insert({
    discussion_id: discussionId,
    moderator_id: user.id,
    action,
  });

  revalidatePath("/admin/isopedia/community");
  revalidatePath("/community");
  redirect("/admin/isopedia/community?saved=moderation");
}

export async function generateWeeklyPrompt(formData: FormData) {
  const { user, supabase } = await requireAdmin();
  const promptId = textValue(formData.get("prompt_id"));

  const { data: prompt, error: promptError } = await supabase
    .from("community_recurring_prompts")
    .select("id, title, slug, description, category_id, pin_for_days")
    .eq("id", promptId)
    .maybeSingle<{
      id: string;
      title: string;
      slug: string;
      description: string | null;
      category_id: string | null;
      pin_for_days: number;
    }>();

  if (promptError || !prompt?.category_id) {
    redirect("/admin/isopedia/community?error=prompt-not-found");
  }

  const today = new Date();
  const day = today.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMonday);
  const weekStart = monday.toISOString().slice(0, 10);

  const { data: existingRun } = await supabase
    .from("community_prompt_runs")
    .select("discussion_id")
    .eq("prompt_id", prompt.id)
    .eq("week_start", weekStart)
    .maybeSingle<{ discussion_id: string | null }>();

  if (existingRun?.discussion_id) {
    redirect("/admin/isopedia/community?saved=prompt-exists");
  }

  const discussionId = crypto.randomUUID();
  const title = `${prompt.title}: Week of ${weekStart}`;
  const slug = `${communitySlug(prompt.slug)}-${weekStart}`;
  const pinnedUntil = new Date();
  pinnedUntil.setDate(pinnedUntil.getDate() + prompt.pin_for_days);

  const { error: discussionError } = await supabase.from("community_discussions").insert({
    id: discussionId,
    category_id: prompt.category_id,
    author_id: user.id,
    slug,
    title,
    body: prompt.description || prompt.title,
    excerpt: communityExcerpt(prompt.description || prompt.title),
    content_type: "prompt",
    pinned: prompt.pin_for_days > 0,
    pinned_until: prompt.pin_for_days > 0 ? pinnedUntil.toISOString() : null,
    status: "published",
  });

  if (discussionError) {
    redirect(`/admin/isopedia/community?error=${encodeURIComponent(discussionError.message)}`);
  }

  const { error: runError } = await supabase.from("community_prompt_runs").upsert(
    {
      prompt_id: prompt.id,
      discussion_id: discussionId,
      week_start: weekStart,
      generated_by: user.id,
      created_by_system: false,
    },
    { onConflict: "prompt_id,week_start" }
  );

  if (runError) redirect(`/admin/isopedia/community?error=${encodeURIComponent(runError.message)}`);

  revalidatePath("/admin/isopedia/community");
  revalidatePath("/community");
  redirect("/admin/isopedia/community?saved=prompt");
}
