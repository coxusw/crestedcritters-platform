import { createSupabaseAdminClient } from "./supabase-admin";
import {
  getActivePages,
  getNextTopicForPage,
  insertGeneratedPost,
  logContentAgent,
  markTopicUsed,
} from "./db";
import { findNextMissingSlot } from "./scheduler";
import { generatePostText } from "./openai";
import { publishPostToFacebook } from "./meta";

export async function generateNextPostsForActivePages() {
  const pages = await getActivePages();
  const results: string[] = [];

  for (const page of pages) {
    try {
      const slot = await findNextMissingSlot(page);
      if (!slot) {
        results.push(`${page.page_name}: buffer full`);
        continue;
      }

      const topic = await getNextTopicForPage(page.page_key, slot.postType);
      const generated = await generatePostText({ page, slot, topic });

      const status = page.auto_approve_generated ? "Approved" : "Draft";

      const post = await insertGeneratedPost({
        pageKey: page.page_key,
        scheduledAt: slot.scheduledAt,
        postType: slot.postType,
        topicId: topic?.id || null,
        topic: generated.topic || topic?.topic || slot.postType,
        caption: generated.caption,
        hashtags: generated.hashtags || page.default_hashtags || "",
        memeTopText: generated.memeTopText || "",
        memeBottomText: generated.memeBottomText || "",
        imagePrompt: generated.imagePrompt || "",
        status,
        sourceType: "scheduled_topic",
        rawPayload: generated,
      });

      if (topic?.id) await markTopicUsed(topic.id);

      results.push(`${page.page_name}: generated ${slot.postType}`);
      await logContentAgent("generate_next", "OK", `Generated ${slot.postType}`, "post", post.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push(`${page.page_name}: ERROR ${message}`);
      await logContentAgent("generate_next", "ERROR", `${page.page_name}: ${message}`);
    }
  }

  return results;
}

export async function postApprovedDueContent() {
  const supabase = createSupabaseAdminClient();

  const { data: posts, error } = await supabase
    .from("content_agent_posts")
    .select("*")
    .eq("status", "Approved")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(20);

  if (error) throw new Error(error.message);

  const results: string[] = [];

  for (const post of posts || []) {
    try {
      const { data: page, error: pageError } = await supabase
        .from("content_agent_pages")
        .select("*")
        .eq("page_key", post.page_key)
        .maybeSingle();

      if (pageError) throw new Error(pageError.message);
      if (!page) throw new Error(`No page found for ${post.page_key}`);

      if (!page.auto_publish_enabled) {
        results.push(`${page.page_name}: auto publish disabled`);
        continue;
      }

      const result = await publishPostToFacebook(page, post);

      await supabase
        .from("content_agent_posts")
        .update({
          status: "Posted",
          posted_at: new Date().toISOString(),
          facebook_post_id: result.post_id || result.id || null,
          facebook_post_url: result.post_id ? `https://www.facebook.com/${result.post_id}` : null,
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", post.id);

      results.push(`${page.page_name}: posted ${post.id}`);
      await logContentAgent("post_due", "OK", JSON.stringify(result), "post", post.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await supabase
        .from("content_agent_posts")
        .update({
          status: "Error",
          error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", post.id);

      results.push(`${post.page_key}: ERROR ${message}`);
      await logContentAgent("post_due", "ERROR", message, "post", post.id);
    }
  }

  return results;
}

export async function publishSingleContentPost(postId: string) {
  const supabase = createSupabaseAdminClient();

  const { data: post, error: postError } = await supabase
    .from("content_agent_posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();

  if (postError) throw new Error(postError.message);
  if (!post) throw new Error("Post not found.");

  if (post.status === "Posted") {
    return `Already posted: ${post.topic || post.id}`;
  }

  if (post.status === "Rejected") {
    throw new Error("Rejected posts cannot be published. Approve or regenerate it first.");
  }

  const { data: page, error: pageError } = await supabase
    .from("content_agent_pages")
    .select("*")
    .eq("page_key", post.page_key)
    .maybeSingle();

  if (pageError) throw new Error(pageError.message);
  if (!page) throw new Error(`No page found for ${post.page_key}`);

  // This is a manual admin action, so it intentionally bypasses:
  // - scheduled_at due check
  // - page.auto_publish_enabled
  // It still uses the page's Meta token and Page ID.
  try {
    const result = await publishPostToFacebook(page, post);

    const facebookPostId = result.post_id || result.id || null;

    const { error: updateError } = await supabase
      .from("content_agent_posts")
      .update({
        status: "Posted",
        posted_at: new Date().toISOString(),
        facebook_post_id: facebookPostId,
        facebook_post_url: facebookPostId ? `https://www.facebook.com/${facebookPostId}` : null,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    if (updateError) throw new Error(updateError.message);

    await logContentAgent(
      "publish_now",
      "OK",
      `${page.page_name}: manually published ${post.topic || post.id}. Result: ${JSON.stringify(result)}`,
      "post",
      post.id
    );

    return `${page.page_name}: published "${post.topic || post.post_type}" now.`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await supabase
      .from("content_agent_posts")
      .update({
        status: "Error",
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    await logContentAgent("publish_now", "ERROR", message, "post", post.id);

    throw error;
  }
}
