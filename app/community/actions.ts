"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  communityExcerpt,
  communitySlug,
  getCommunityCategoryBySlug,
} from "@/lib/community";
import { isUnderRestrictedAge } from "@/lib/isopedia-age";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const COMMUNITY_IMAGE_BUCKET = "isopedia-images";
const MAX_COMMUNITY_IMAGE_FILES = 4;
const MAX_COMMUNITY_IMAGE_BYTES = 5 * 1024 * 1024;
const COMMUNITY_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function textValue(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function boolValue(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function cleanTag(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 48);
}

function discussionPath(slug: string) {
  return `/community/discussion/${slug}`;
}

function allowedDiscussionStatus(value: string) {
  return ["published", "hidden", "archived", "removed"].includes(value) ? value : null;
}

function allowedMarketplaceStatus(value: string) {
  return ["available", "pending", "completed", "expired", "withdrawn"].includes(value)
    ? value
    : null;
}

function withQueryParam(path: string, key: string, value: string) {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set(key, value);
  return `${base}?${params.toString()}`;
}

function safeImageExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (extension === "jpeg") return "jpg";
  if (["jpg", "png", "webp", "gif"].includes(extension)) return extension;
  return "jpg";
}

function communityImageFiles(entries: FormDataEntryValue[]) {
  return entries.filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

function validateCommunityImageFiles(files: File[]) {
  if (files.length > MAX_COMMUNITY_IMAGE_FILES) {
    throw new Error(`Please upload ${MAX_COMMUNITY_IMAGE_FILES} images or fewer.`);
  }

  for (const file of files) {
    if (!COMMUNITY_IMAGE_TYPES.has(file.type)) {
      throw new Error("Images must be JPG, PNG, WEBP, or GIF.");
    }

    if (file.size > MAX_COMMUNITY_IMAGE_BYTES) {
      throw new Error("Each image must be smaller than 5MB.");
    }
  }
}

async function uploadCommunityImages(
  supabase: SupabaseServerClient,
  files: File[],
  ownerId: string,
  target: { discussionId?: string; replyId?: string }
) {
  if (!files.length) return;

  const rows: Array<{
    discussion_id: string | null;
    reply_id: string | null;
    owner_id: string;
    image_url: string;
    storage_path: string;
    alt_text: string | null;
    position: number;
  }> = [];

  for (const [index, file] of files.entries()) {
    const targetId = target.replyId || target.discussionId;
    if (!targetId) throw new Error("Missing image target.");

    const extension = safeImageExtension(file);
    const storagePath = `community/${ownerId}/${targetId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(COMMUNITY_IMAGE_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      });

    if (uploadError) throw new Error(uploadError.message);

    const { data } = supabase.storage.from(COMMUNITY_IMAGE_BUCKET).getPublicUrl(storagePath);
    rows.push({
      discussion_id: target.discussionId || null,
      reply_id: target.replyId || null,
      owner_id: ownerId,
      image_url: data.publicUrl,
      storage_path: storagePath,
      alt_text: file.name || null,
      position: index + 1,
    });
  }

  const { error } = await supabase.from("community_images").insert(rows);
  if (error) {
    console.error("Failed to load species follows for notifications:", error.message);
    return;
  }
}

async function authContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/community");

  const [{ data: profile }, { data: adminProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, role, birth_date, created_at")
      .eq("id", user.id)
      .maybeSingle<{
        id: string;
        username: string | null;
        role: string | null;
        birth_date: string | null;
        created_at: string | null;
      }>(),
    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
  ]);

  const canModerate =
    Boolean(adminProfile) || profile?.role === "admin" || profile?.role === "moderator";

  if (profile?.birth_date && isUnderRestrictedAge(profile.birth_date)) {
    throw new Error("Discussion posting is disabled for accounts under the age of 13.");
  }

  return { supabase, user, profile, canModerate };
}

async function ensureNotDiscussionBanned(
  supabase: SupabaseServerClient,
  userId: string
) {
  const { data } = await supabase
    .from("isopedia_discussion_bans")
    .select("id, reason, expires_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle<{ id: string; reason: string | null; expires_at: string | null }>();

  if (data) {
    throw new Error(
      `You are currently banned from discussions${
        data.reason ? `: ${data.reason}` : "."
      }`
    );
  }
}

async function syncSpeciesLinks(
  supabase: SupabaseServerClient,
  discussionId: string,
  speciesIds: string[]
) {
  const cleanedIds = [...new Set(speciesIds.map(Number).filter(Number.isFinite))];
  await supabase
    .from("community_discussion_species")
    .delete()
    .eq("discussion_id", discussionId);

  if (!cleanedIds.length) return cleanedIds;

  const { error } = await supabase.from("community_discussion_species").insert(
    cleanedIds.map((speciesId) => ({
      discussion_id: discussionId,
      species_id: speciesId,
    }))
  );

  if (error) throw new Error(error.message);

  return cleanedIds;
}

async function syncTags(
  supabase: SupabaseServerClient,
  discussionId: string,
  rawTags: string
) {
  const tagNames = [...new Set(rawTags.split(",").map(cleanTag).filter(Boolean))].slice(0, 8);

  await supabase.from("community_discussion_tags").delete().eq("discussion_id", discussionId);
  if (!tagNames.length) return;

  const tagRows: Array<{ id: string; slug: string }> = [];

  for (const slug of tagNames) {
    const name = slug.replace(/-/g, " ");
    const { data, error } = await supabase
      .from("community_tags")
      .upsert({ slug, name }, { onConflict: "slug" })
      .select("id, slug")
      .single<{ id: string; slug: string }>();
    if (error) throw new Error(error.message);
    tagRows.push(data);
  }

  const { error } = await supabase.from("community_discussion_tags").insert(
    tagRows.map((tag) => ({
      discussion_id: discussionId,
      tag_id: tag.id,
    }))
  );

  if (error) {
    console.error("Failed to load species follows for notifications:", error.message);
    return;
  }
}

async function createMentionNotifications(
  supabase: SupabaseServerClient,
  discussionId: string,
  actorId: string,
  body: string,
  destinationUrl: string
) {
  const usernames = [
    ...new Set(
      Array.from(body.matchAll(/(^|\s)@([a-zA-Z0-9_][a-zA-Z0-9_.-]{1,30})/g)).map(
        (match) => match[2].toLowerCase()
      )
    ),
  ].slice(0, 10);

  if (!usernames.length) return;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username")
    .in("username", usernames)
    .returns<Array<{ id: string; username: string | null }>>();

  const rows = (profiles || [])
    .filter((profile) => profile.id !== actorId)
    .map((profile) => ({
      recipient_id: profile.id,
      actor_id: actorId,
      type: "mention",
      discussion_id: discussionId,
      destination_url: destinationUrl,
      metadata: { username: profile.username },
    }));

  if (rows.length) {
    await supabase.from("notifications").insert(rows);
  }
}

function speciesFollowNotificationsEnabled(
  follow: {
    notify_discussions: boolean | null;
    notify_guides: boolean | null;
    notify_marketplace: boolean | null;
  },
  contentType: string
) {
  if (contentType === "guide") return follow.notify_guides !== false;
  if (contentType === "marketplace") return follow.notify_marketplace !== false;
  return follow.notify_discussions !== false;
}

async function createSpeciesFollowNotifications({
  discussionId,
  actorId,
  title,
  slug,
  speciesIds,
  contentType,
}: {
  discussionId: string;
  actorId: string;
  title: string;
  slug: string;
  speciesIds: number[];
  contentType: string;
}) {
  if (!speciesIds.length) return;

  const admin = createSupabaseAdminClient();
  const { data: follows, error } = await admin
    .from("species_follows")
    .select("profile_id, species_id, notify_discussions, notify_guides, notify_marketplace")
    .in("species_id", speciesIds)
    .returns<
      Array<{
        profile_id: string;
        species_id: number;
        notify_discussions: boolean | null;
        notify_guides: boolean | null;
        notify_marketplace: boolean | null;
      }>
    >();

  if (error) {
    console.error("Failed to load species follows for notifications:", error.message);
    return;
  }

  const recipientIds = [
    ...new Set(
      (follows || [])
        .filter((follow) => follow.profile_id !== actorId)
        .filter((follow) => speciesFollowNotificationsEnabled(follow, contentType))
        .map((follow) => follow.profile_id)
    ),
  ];

  if (!recipientIds.length) return;

  const { error: notificationError } = await admin.from("notifications").insert(
    recipientIds.map((recipientId) => ({
      recipient_id: recipientId,
      actor_id: actorId,
      type: "followed_species_discussion",
      discussion_id: discussionId,
      destination_url: discussionPath(slug),
      metadata: {
        title,
        content_type: contentType,
        species_ids: speciesIds,
      },
    }))
  );

  if (notificationError) {
    console.error("Failed to create species follow notifications:", notificationError.message);
  }
}

export async function createCommunityDiscussion(formData: FormData) {
  const { supabase, user, profile, canModerate } = await authContext();
  await ensureNotDiscussionBanned(supabase, user.id);

  const categorySlug = textValue(formData.get("category_slug"));
  const title = textValue(formData.get("title"));
  const body = textValue(formData.get("body"));
  const tags = textValue(formData.get("tags"));
  const speciesIds = formData.getAll("species_ids").map((value) => String(value));

  if (title.length < 4) throw new Error("Please add a longer title.");
  if (body.length < 10) throw new Error("Please add more detail before posting.");

  const category = await getCommunityCategoryBySlug(supabase, categorySlug);
  if (!category || !category.is_active) throw new Error("Category not found.");
  if (category.staff_only_posting && !canModerate) {
    throw new Error("Only staff can start discussions in this category.");
  }
  const imageFiles = category.images_enabled ? communityImageFiles(formData.getAll("image_files")) : [];
  validateCommunityImageFiles(imageFiles);

  if (category.minimum_account_age_days > 0 && profile?.created_at) {
    const createdAt = new Date(profile.created_at).getTime();
    const ageDays = (Date.now() - createdAt) / 86_400_000;
    if (ageDays < category.minimum_account_age_days && !canModerate) {
      throw new Error("Your account is too new to post in this category.");
    }
  }

  const contentType =
    category.slug === "guides"
      ? "guide"
      : category.slug === "marketplace-connections"
        ? "marketplace"
        : category.slug === "colony-journals"
          ? "journal"
          : category.slug.includes("help") || category.slug === "species-help"
            ? "question"
            : "discussion";

  const id = crypto.randomUUID();
  const slug = `${communitySlug(title)}-${id.slice(0, 8)}`;
  const status = category.requires_approval && !canModerate ? "pending" : "published";

  const { error } = await supabase.from("community_discussions").insert({
    id,
    category_id: category.id,
    author_id: user.id,
    slug,
    title,
    body,
    excerpt: communityExcerpt(body),
    content_type: contentType,
    status,
    moderation_status: status === "pending" ? "pending" : "clear",
  });

  if (error) throw new Error(error.message);

  const linkedSpeciesIds = await syncSpeciesLinks(
    supabase,
    id,
    category.species_tagging_enabled ? speciesIds : []
  );
  await syncTags(supabase, id, tags);
  if (category.images_enabled) {
    await uploadCommunityImages(supabase, imageFiles, user.id, {
      discussionId: id,
    });
  }

  if (category.marketplace_rules) {
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 30);

    const { error: listingError } = await supabase.from("marketplace_listing_details").insert({
      discussion_id: id,
      listing_type: textValue(formData.get("listing_type")) || "available",
      species_or_product: textValue(formData.get("species_or_product")) || null,
      quantity: textValue(formData.get("quantity")) || null,
      price: textValue(formData.get("price")) || null,
      location: textValue(formData.get("location")) || null,
      state: textValue(formData.get("state")) || null,
      shipping_available: boolValue(formData.get("shipping_available")),
      local_pickup_available: boolValue(formData.get("local_pickup_available")),
      expo_name: textValue(formData.get("expo_name")) || null,
      expiration_date: expiration.toISOString().slice(0, 10),
      preferred_contact_method: textValue(formData.get("preferred_contact_method")) || null,
      permit_notes: textValue(formData.get("permit_notes")) || null,
    });

    if (listingError) throw new Error(listingError.message);
  }

  await createMentionNotifications(supabase, id, user.id, body, discussionPath(slug));
  if (status === "published") {
    await createSpeciesFollowNotifications({
      discussionId: id,
      actorId: user.id,
      title,
      slug,
      speciesIds: linkedSpeciesIds,
      contentType,
    });
  }

  revalidatePath("/community");
  revalidatePath(`/community/category/${category.slug}`);
  redirect(discussionPath(slug));
}

export async function updateCommunityDiscussion(formData: FormData) {
  const { supabase, user, canModerate } = await authContext();
  await ensureNotDiscussionBanned(supabase, user.id);

  const discussionId = textValue(formData.get("discussion_id"));
  const title = textValue(formData.get("title"));
  const body = textValue(formData.get("body"));
  const tags = textValue(formData.get("tags"));
  const speciesIds = formData.getAll("species_ids").map((value) => String(value));

  if (!discussionId) throw new Error("Missing discussion.");
  if (title.length < 4) throw new Error("Please add a longer title.");
  if (body.length < 10) throw new Error("Please add more detail.");

  const { data: discussion, error: readError } = await supabase
    .from("community_discussions")
    .select("id, slug, author_id, category_id, category:category_id(slug, species_tagging_enabled, marketplace_rules, images_enabled)")
    .eq("id", discussionId)
    .maybeSingle<{
      id: string;
      slug: string;
      author_id: string | null;
      category_id: string;
      category: {
        slug: string;
        species_tagging_enabled: boolean;
        marketplace_rules: boolean;
        images_enabled: boolean;
      } | null;
    }>();

  if (readError) throw new Error(readError.message);
  if (!discussion) throw new Error("Discussion not found.");
  if (discussion.author_id !== user.id && !canModerate) {
    throw new Error("You cannot edit this discussion.");
  }
  const imageFiles = discussion.category?.images_enabled
    ? communityImageFiles(formData.getAll("image_files"))
    : [];
  validateCommunityImageFiles(imageFiles);

  const { error } = await supabase
    .from("community_discussions")
    .update({
      title,
      body,
      excerpt: communityExcerpt(body),
      edited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", discussionId);

  if (error) throw new Error(error.message);

  await syncSpeciesLinks(
    supabase,
    discussionId,
    discussion.category?.species_tagging_enabled ? speciesIds : []
  );
  await syncTags(supabase, discussionId, tags);
  if (discussion.category?.images_enabled) {
    await uploadCommunityImages(supabase, imageFiles, user.id, {
      discussionId,
    });
  }

  revalidatePath(discussionPath(discussion.slug));
  revalidatePath(`/community/category/${discussion.category?.slug || ""}`);
  redirect(discussionPath(discussion.slug));
}

export async function createCommunityReply(formData: FormData) {
  const { supabase, user } = await authContext();
  await ensureNotDiscussionBanned(supabase, user.id);

  const discussionId = textValue(formData.get("discussion_id"));
  const body = textValue(formData.get("body"));

  if (!discussionId) throw new Error("Missing discussion.");
  if (body.length < 2) throw new Error("Reply is too short.");

  const { data: discussion, error: discussionError } = await supabase
    .from("community_discussions")
    .select("id, slug, title, author_id, status, locked, category:category_id(images_enabled)")
    .eq("id", discussionId)
    .maybeSingle<{
      id: string;
      slug: string;
      title: string;
      author_id: string | null;
      status: string;
      locked: boolean;
      category: { images_enabled: boolean } | null;
    }>();

  if (discussionError) throw new Error(discussionError.message);
  if (!discussion || discussion.status !== "published") throw new Error("Discussion not found.");
  if (discussion.locked) throw new Error("This discussion is locked.");
  const imageFiles = discussion.category?.images_enabled
    ? communityImageFiles(formData.getAll("image_files"))
    : [];
  validateCommunityImageFiles(imageFiles);

  const { data: reply, error } = await supabase
    .from("community_replies")
    .insert({
      discussion_id: discussionId,
      author_id: user.id,
      body,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) throw new Error(error.message);
  if (discussion.category?.images_enabled) {
    await uploadCommunityImages(supabase, imageFiles, user.id, {
      replyId: reply.id,
    });
  }

  if (discussion.author_id && discussion.author_id !== user.id) {
    await supabase.from("notifications").insert({
      recipient_id: discussion.author_id,
      actor_id: user.id,
      type: "discussion_reply",
      discussion_id: discussionId,
      reply_id: reply.id,
      destination_url: `${discussionPath(discussion.slug)}#reply-${reply.id}`,
      metadata: { title: discussion.title },
    });
  }

  await createMentionNotifications(
    supabase,
    discussionId,
    user.id,
    body,
    `${discussionPath(discussion.slug)}#reply-${reply.id}`
  );

  revalidatePath(discussionPath(discussion.slug));
}

export async function updateCommunityReply(formData: FormData) {
  const { supabase, user, canModerate } = await authContext();
  await ensureNotDiscussionBanned(supabase, user.id);

  const replyId = textValue(formData.get("reply_id"));
  const body = textValue(formData.get("body"));
  const returnPath = textValue(formData.get("return_path")) || "/community";

  if (!replyId) throw new Error("Missing reply.");
  if (body.length < 2) throw new Error("Reply is too short.");

  const { data: reply, error: readError } = await supabase
    .from("community_replies")
    .select("id, discussion_id, author_id, status, discussion:discussion_id(slug)")
    .eq("id", replyId)
    .maybeSingle<{
      id: string;
      discussion_id: string;
      author_id: string | null;
      status: string;
      discussion: { slug: string } | null;
    }>();

  if (readError) throw new Error(readError.message);
  if (!reply || reply.status !== "published") throw new Error("Reply not found.");
  if (reply.author_id !== user.id && !canModerate) {
    throw new Error("You cannot edit this reply.");
  }

  const { error } = await supabase
    .from("community_replies")
    .update({
      body,
      edited_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", replyId);

  if (error) throw new Error(error.message);

  const path = reply.discussion?.slug ? discussionPath(reply.discussion.slug) : returnPath;
  revalidatePath(path);
  redirect(`${path}#reply-${reply.id}`);
}

export async function softDeleteCommunityReply(formData: FormData) {
  const { supabase, user, canModerate } = await authContext();

  const replyId = textValue(formData.get("reply_id"));
  const returnPath = textValue(formData.get("return_path")) || "/community";

  if (!replyId) throw new Error("Missing reply.");

  const { data: reply, error: readError } = await supabase
    .from("community_replies")
    .select("id, discussion_id, author_id, status, discussion:discussion_id(slug)")
    .eq("id", replyId)
    .maybeSingle<{
      id: string;
      discussion_id: string;
      author_id: string | null;
      status: string;
      discussion: { slug: string } | null;
    }>();

  if (readError) throw new Error(readError.message);
  if (!reply || reply.status !== "published") throw new Error("Reply not found.");
  if (reply.author_id !== user.id && !canModerate) {
    throw new Error("You cannot delete this reply.");
  }

  const { error } = await supabase
    .from("community_replies")
    .update({
      status: "removed",
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", replyId);

  if (error) throw new Error(error.message);

  await supabase
    .from("community_images")
    .update({ status: "removed" })
    .eq("reply_id", replyId);

  await supabase.rpc("community_recount_discussion_stats", {
    target_discussion_id: reply.discussion_id,
  });

  const path = reply.discussion?.slug ? discussionPath(reply.discussion.slug) : returnPath;
  revalidatePath(path);
  redirect(path);
}

export async function softDeleteCommunityDiscussion(formData: FormData) {
  const { supabase, user, canModerate } = await authContext();
  const discussionId = textValue(formData.get("discussion_id"));

  const { data: discussion } = await supabase
    .from("community_discussions")
    .select("id, slug, author_id")
    .eq("id", discussionId)
    .maybeSingle<{ id: string; slug: string; author_id: string | null }>();

  if (!discussion) throw new Error("Discussion not found.");
  if (discussion.author_id !== user.id && !canModerate) {
    throw new Error("You cannot delete this discussion.");
  }

  const { error } = await supabase
    .from("community_discussions")
    .update({
      status: "removed",
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", discussionId);

  if (error) throw new Error(error.message);

  revalidatePath("/community");
  redirect("/community/my-discussions");
}

export async function moderateCommunityDiscussionFromThread(formData: FormData) {
  const { user, canModerate } = await authContext();
  if (!canModerate) throw new Error("Only moderators and admins can moderate discussions.");
  const supabase = createSupabaseAdminClient();

  const discussionId = textValue(formData.get("discussion_id"));
  const action = textValue(formData.get("action"));
  const categoryId = textValue(formData.get("category_id"));
  const status = allowedDiscussionStatus(textValue(formData.get("status")));
  const notes = textValue(formData.get("moderator_notes")) || null;

  if (!discussionId) throw new Error("Missing discussion.");

  const { data: discussion, error: readError } = await supabase
    .from("community_discussions")
    .select("id, slug, category_id, status, locked, pinned, featured, answered, category:category_id(slug)")
    .eq("id", discussionId)
    .maybeSingle<{
      id: string;
      slug: string;
      category_id: string;
      status: string;
      locked: boolean;
      pinned: boolean;
      featured: boolean;
      answered: boolean;
      category: { slug: string } | null;
    }>();

  if (readError) throw new Error(readError.message);
  if (!discussion) throw new Error("Discussion not found.");

  const updates: Record<string, string | boolean | null> = {
    updated_at: new Date().toISOString(),
  };
  const historyAction = action || "moderate";
  const metadata: Record<string, string | boolean | null> = {};

  if (action === "lock") updates.locked = true;
  if (action === "unlock") updates.locked = false;
  if (action === "pin") updates.pinned = true;
  if (action === "unpin") {
    updates.pinned = false;
    updates.pinned_until = null;
  }
  if (action === "feature") updates.featured = true;
  if (action === "unfeature") updates.featured = false;
  if (action === "answered") updates.answered = true;
  if (action === "unanswered") {
    updates.answered = false;
    updates.accepted_reply_id = null;
  }
  if (action === "status" && status) {
    updates.status = status;
    updates.moderation_status =
      status === "hidden" || status === "removed" ? "actioned" : "clear";
    if (status === "removed") updates.deleted_at = new Date().toISOString();
    metadata.status = status;
  }
  if (action === "move" && categoryId && categoryId !== discussion.category_id) {
    const { data: category, error: categoryError } = await supabase
      .from("community_categories")
      .select("id, slug")
      .eq("id", categoryId)
      .maybeSingle<{ id: string; slug: string }>();

    if (categoryError) throw new Error(categoryError.message);
    if (!category) throw new Error("Category not found.");

    updates.category_id = category.id;
    metadata.from_category_id = discussion.category_id;
    metadata.to_category_id = category.id;
    metadata.to_category_slug = category.slug;
  }

  if (Object.keys(updates).length === 1) {
    throw new Error("Choose a moderation action.");
  }

  const { error } = await supabase
    .from("community_discussions")
    .update(updates)
    .eq("id", discussionId);

  if (error) throw new Error(error.message);

  await supabase.from("community_moderation_history").insert({
    discussion_id: discussionId,
    moderator_id: user.id,
    action: historyAction,
    notes,
    metadata,
  });

  const path = discussionPath(discussion.slug);
  revalidatePath(path);
  revalidatePath("/community");
  if (discussion.category?.slug) revalidatePath(`/community/category/${discussion.category.slug}`);
  if (typeof metadata.to_category_slug === "string") {
    revalidatePath(`/community/category/${metadata.to_category_slug}`);
  }
  redirect(path);
}

export async function updateMarketplaceListingStatus(formData: FormData) {
  const { supabase, user, canModerate } = await authContext();
  const discussionId = textValue(formData.get("discussion_id"));
  const listingStatus = allowedMarketplaceStatus(textValue(formData.get("listing_status")));
  const returnPath = textValue(formData.get("return_path")) || "/community";

  if (!discussionId) throw new Error("Missing marketplace listing.");
  if (!listingStatus) throw new Error("Choose a valid listing status.");

  const { data: discussion, error: readError } = await supabase
    .from("community_discussions")
    .select("id, slug, author_id, content_type, category:category_id(marketplace_rules)")
    .eq("id", discussionId)
    .maybeSingle<{
      id: string;
      slug: string;
      author_id: string | null;
      content_type: string;
      category: { marketplace_rules: boolean } | null;
    }>();

  if (readError) throw new Error(readError.message);
  if (!discussion || !discussion.category?.marketplace_rules) {
    throw new Error("Marketplace listing not found.");
  }
  if (discussion.author_id !== user.id && !canModerate) {
    throw new Error("You cannot update this marketplace listing.");
  }

  const writeClient = canModerate ? createSupabaseAdminClient() : supabase;
  const { error } = await writeClient
    .from("marketplace_listing_details")
    .update({
      listing_status: listingStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("discussion_id", discussionId);

  if (error) throw new Error(error.message);

  revalidatePath(returnPath);
  revalidatePath(discussionPath(discussion.slug));
  revalidatePath("/community/category/marketplace-connections");
  redirect(returnPath);
}

export async function toggleCommunitySave(formData: FormData) {
  const { supabase, user } = await authContext();
  const discussionId = textValue(formData.get("discussion_id"));
  const returnPath = textValue(formData.get("return_path")) || "/community";

  const { data: existing } = await supabase
    .from("community_saves")
    .select("discussion_id")
    .eq("discussion_id", discussionId)
    .eq("profile_id", user.id)
    .maybeSingle<{ discussion_id: string }>();

  if (existing) {
    await supabase
      .from("community_saves")
      .delete()
      .eq("discussion_id", discussionId)
      .eq("profile_id", user.id);
  } else {
    await supabase.from("community_saves").insert({
      discussion_id: discussionId,
      profile_id: user.id,
    });
  }

  await supabase.rpc("community_recount_discussion_stats", {
    target_discussion_id: discussionId,
  });
  revalidatePath(returnPath);
}

export async function toggleCommunityFollow(formData: FormData) {
  const { supabase, user } = await authContext();
  const discussionId = textValue(formData.get("discussion_id"));
  const returnPath = textValue(formData.get("return_path")) || "/community";

  const { data: existing } = await supabase
    .from("community_follows")
    .select("discussion_id")
    .eq("discussion_id", discussionId)
    .eq("profile_id", user.id)
    .maybeSingle<{ discussion_id: string }>();

  if (existing) {
    await supabase
      .from("community_follows")
      .delete()
      .eq("discussion_id", discussionId)
      .eq("profile_id", user.id);
  } else {
    await supabase.from("community_follows").insert({
      discussion_id: discussionId,
      profile_id: user.id,
    });
  }

  await supabase.rpc("community_recount_discussion_stats", {
    target_discussion_id: discussionId,
  });
  revalidatePath(returnPath);
}

export async function reportCommunityContent(formData: FormData) {
  const { supabase, user } = await authContext();
  const discussionId = textValue(formData.get("discussion_id")) || null;
  const replyId = textValue(formData.get("reply_id")) || null;
  const reason = textValue(formData.get("reason"));
  const details = textValue(formData.get("details")) || null;
  const returnPath = textValue(formData.get("return_path")) || "/community";

  if (!discussionId && !replyId) throw new Error("Missing report target.");
  if (!reason) throw new Error("Please choose a report reason.");

  const { error } = await supabase.from("community_reports").insert({
    discussion_id: discussionId,
    reply_id: replyId,
    reporter_id: user.id,
    reason,
    details,
  });

  if (error) throw new Error(error.message);
  if (discussionId) {
    await supabase.rpc("community_recount_discussion_stats", {
      target_discussion_id: discussionId,
    });
  }
  revalidatePath(returnPath);
  redirect(withQueryParam(returnPath, "reported", "1"));
}
