"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const allowedEntityTypes = ["species", "expo", "guide"];

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

async function getAuthContext() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be logged in.");
  }

  const [{ data: profile }, { data: adminProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role: string | null }>(),

    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
  ]);

  const canModerate =
    Boolean(adminProfile) ||
    profile?.role === "admin" ||
    profile?.role === "moderator";

  return {
    supabase,
    user,
    canModerate,
  };
}

async function requireNotDiscussionBanned(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
) {
  const { data: activeBan, error } = await supabase
    .from("isopedia_discussion_bans")
    .select("id, reason, expires_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle<{
      id: string;
      reason: string | null;
      expires_at: string | null;
    }>();

  if (error) {
    throw new Error(error.message);
  }

  if (activeBan) {
    const until = activeBan.expires_at
      ? ` until ${new Date(activeBan.expires_at).toLocaleString()}`
      : "";

    throw new Error(
      `You are currently banned from discussions${until}.${
        activeBan.reason ? ` Reason: ${activeBan.reason}` : ""
      }`
    );
  }
}

export async function createDiscussionComment(formData: FormData) {
  const { supabase, user } = await getAuthContext();

  await requireNotDiscussionBanned(supabase, user.id);

  const entityType = cleanText(formData.get("entity_type"));
  const entityId = cleanText(formData.get("entity_id"));
  const parentId = cleanText(formData.get("parent_id")) || null;
  const body = cleanText(formData.get("body"));
  const returnPath = cleanText(formData.get("return_path")) || "/";

  if (!allowedEntityTypes.includes(entityType)) {
    throw new Error("Invalid discussion type.");
  }

  if (!entityId) {
    throw new Error("Missing discussion target.");
  }

  if (body.length < 2) {
    throw new Error("Comment is too short.");
  }

  if (body.length > 5000) {
    throw new Error("Comment is too long.");
  }

  if (parentId) {
    const { data: parentComment, error: parentError } = await supabase
      .from("isopedia_discussions")
      .select("id, entity_type, entity_id, status")
      .eq("id", parentId)
      .maybeSingle<{
        id: string;
        entity_type: string;
        entity_id: string;
        status: string;
      }>();

    if (parentError) {
      throw new Error(parentError.message);
    }

    if (
      !parentComment ||
      parentComment.entity_type !== entityType ||
      parentComment.entity_id !== entityId ||
      parentComment.status !== "active"
    ) {
      throw new Error("Invalid reply target.");
    }
  }

  const { error } = await supabase.from("isopedia_discussions").insert({
    entity_type: entityType,
    entity_id: entityId,
    parent_id: parentId,
    user_id: user.id,
    body,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(returnPath);
}

export async function editDiscussionComment(formData: FormData) {
  const { supabase, user } = await getAuthContext();

  await requireNotDiscussionBanned(supabase, user.id);

  const commentId = cleanText(formData.get("comment_id"));
  const body = cleanText(formData.get("body"));
  const returnPath = cleanText(formData.get("return_path")) || "/";

  if (!commentId) {
    throw new Error("Missing comment.");
  }

  if (body.length < 2) {
    throw new Error("Comment is too short.");
  }

  if (body.length > 5000) {
    throw new Error("Comment is too long.");
  }

  const { data: comment, error: fetchError } = await supabase
    .from("isopedia_discussions")
    .select("id, user_id, status")
    .eq("id", commentId)
    .maybeSingle<{
      id: string;
      user_id: string;
      status: string;
    }>();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!comment || comment.status !== "active") {
    throw new Error("Comment not found.");
  }

  if (comment.user_id !== user.id) {
    throw new Error("You can only edit your own comments.");
  }

  const { error } = await supabase
    .from("isopedia_discussions")
    .update({
      body,
      edited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(returnPath);
}

export async function deleteDiscussionComment(formData: FormData) {
  const { supabase, user, canModerate } = await getAuthContext();

  const commentId = cleanText(formData.get("comment_id"));
  const returnPath = cleanText(formData.get("return_path")) || "/";
  const reason = cleanText(formData.get("reason")) || null;

  if (!commentId) {
    throw new Error("Missing comment.");
  }

  const { data: comment, error: fetchError } = await supabase
    .from("isopedia_discussions")
    .select("id, user_id, status")
    .eq("id", commentId)
    .maybeSingle<{
      id: string;
      user_id: string;
      status: string;
    }>();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!comment || comment.status !== "active") {
    throw new Error("Comment not found.");
  }

  const isOwner = comment.user_id === user.id;

  if (!isOwner && !canModerate) {
    throw new Error("You do not have permission to delete this comment.");
  }

  const { error } = await supabase.rpc("soft_delete_isopedia_discussion", {
    target_comment_id: commentId,
    delete_reason:
      reason ||
      (canModerate && !isOwner ? "Moderator removed" : "User removed"),
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(returnPath);
}

export async function reportDiscussionComment(formData: FormData) {
  const { supabase, user } = await getAuthContext();

  await requireNotDiscussionBanned(supabase, user.id);

  const commentId = cleanText(formData.get("comment_id"));
  const reason = cleanText(formData.get("reason"));
  const details = cleanText(formData.get("details")) || null;
  const returnPath = cleanText(formData.get("return_path")) || "/";

  if (!commentId) {
    throw new Error("Missing comment.");
  }

  if (!reason) {
    throw new Error("Please choose a report reason.");
  }

  const { data: comment, error: commentError } = await supabase
    .from("isopedia_discussions")
    .select("id, user_id, status")
    .eq("id", commentId)
    .maybeSingle<{
      id: string;
      user_id: string;
      status: string;
    }>();

  if (commentError) {
    throw new Error(commentError.message);
  }

  if (!comment || comment.status !== "active") {
    throw new Error("Comment not found.");
  }

  if (comment.user_id === user.id) {
    throw new Error("You cannot report your own comment.");
  }

  const { error } = await supabase.from("isopedia_discussion_reports").insert({
    comment_id: commentId,
    reporter_user_id: user.id,
    reason,
    details,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("You already reported this comment.");
    }

    throw new Error(error.message);
  }

  revalidatePath(returnPath);
}
