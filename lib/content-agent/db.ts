import { createSupabaseAdminClient } from "./supabase-admin";
import type { ContentAgentPage, ContentAgentPost, ContentAgentTopic } from "./types";
import { areSimilarTopics } from "./topic-normalization";

export async function logContentAgent(action: string, result: string, details: string, entityType?: string, entityId?: string) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("content_agent_logs").insert({ action, result, details, entity_type: entityType || null, entity_id: entityId || null });
}

export async function getActivePages() {
  const { data, error } = await createSupabaseAdminClient().from("content_agent_pages").select("*").eq("active", true).order("page_name");
  if (error) throw new Error(error.message);
  return (data || []) as ContentAgentPage[];
}

export async function getPage(pageKey: string) {
  const { data, error } = await createSupabaseAdminClient().from("content_agent_pages").select("*").eq("page_key", pageKey).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ContentAgentPage | null;
}

export async function getRecentPosts(limit = 25, status?: string) {
  let query = createSupabaseAdminClient()
    .from("content_agent_posts")
    .select("*")
    .order("scheduled_at", { ascending: false })
    .limit(limit);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as ContentAgentPost[];
}

export async function getDashboardCounts() {
  const supabase = createSupabaseAdminClient();
  const [draft, approved, posted, error, pages, topics] = await Promise.all([
    supabase.from("content_agent_posts").select("id", { count: "exact", head: true }).eq("status", "Draft"),
    supabase.from("content_agent_posts").select("id", { count: "exact", head: true }).eq("status", "Approved"),
    supabase.from("content_agent_posts").select("id", { count: "exact", head: true }).eq("status", "Posted"),
    supabase.from("content_agent_posts").select("id", { count: "exact", head: true }).eq("status", "Error"),
    supabase.from("content_agent_pages").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("content_agent_topics").select("id", { count: "exact", head: true }).eq("active", true),
  ]);
  return {
    draft: draft.count || 0,
    approved: approved.count || 0,
    posted: posted.count || 0,
    error: error.count || 0,
    pages: pages.count || 0,
    topics: topics.count || 0,
    pendingImages: 0,
  };
}

export async function getNextTopicForPage(pageKey: string, postType: string) {
  const supabase = createSupabaseAdminClient();
  const { data: exactTopics, error: exactError } = await supabase
    .from("content_agent_topics")
    .select("*")
    .eq("page_key", pageKey)
    .eq("post_type", postType)
    .eq("active", true)
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .order("use_count", { ascending: true })
    .returns<ContentAgentTopic[]>();

  if (exactError) throw new Error(exactError.message);

  const exactTopic = await chooseLeastRepeatedTopic(supabase, pageKey, postType, exactTopics || []);
  if (exactTopic) return exactTopic;

  const { data: fallbackTopics, error: fallbackError } = await supabase
    .from("content_agent_topics")
    .select("*")
    .eq("page_key", pageKey)
    .eq("active", true)
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .order("use_count", { ascending: true })
    .returns<ContentAgentTopic[]>();

  if (fallbackError) throw new Error(fallbackError.message);

  return chooseLeastRepeatedTopic(supabase, pageKey, null, fallbackTopics || []);
}

async function chooseLeastRepeatedTopic(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  pageKey: string,
  postType: string | null,
  topics: ContentAgentTopic[]
) {
  if (topics.length === 0) return null;

  let usedQuery = supabase
    .from("content_agent_posts")
    .select("topic_id, topic")
    .eq("page_key", pageKey)
    .not("topic_id", "is", null)
    .neq("status", "Rejected");

  if (postType) usedQuery = usedQuery.eq("post_type", postType);

  const { data: usedRows, error } = await usedQuery.returns<Array<{ topic_id: string | null; topic: string | null }>>();
  if (error) throw new Error(error.message);

  const usedTopicIds = new Set((usedRows || []).map((row) => row.topic_id).filter(Boolean));
  const usedTopicTexts = (usedRows || []).map((row) => row.topic).filter(Boolean) as string[];
  const freshTopic = topics.find(
    (topic) =>
      !usedTopicIds.has(topic.id) &&
      !usedTopicTexts.some((usedTopic) => areSimilarTopics(usedTopic, topic.topic))
  );
  const neverGenerated = topics.find((topic) => !usedTopicIds.has(topic.id));
  return freshTopic || neverGenerated || topics[0];
}

export async function markTopicUsed(topicId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: topic, error: readError } = await supabase.from("content_agent_topics").select("use_count").eq("id", topicId).maybeSingle();
  if (readError) throw new Error(readError.message);
  const { error } = await supabase.from("content_agent_topics").update({ last_used_at: new Date().toISOString(), use_count: Number(topic?.use_count || 0) + 1, updated_at: new Date().toISOString() }).eq("id", topicId);
  if (error) throw new Error(error.message);
}

export async function insertGeneratedPost(input: {
  pageKey: string; scheduledAt: Date; postType: string; topicId?: string | null; topic?: string | null;
  caption: string; hashtags: string; memeTopText?: string; memeBottomText?: string; imagePrompt?: string;
  status?: string; sourceType?: string; sourceRefId?: string | null; rawPayload?: Record<string, unknown>;
}) {
  const { data, error } = await createSupabaseAdminClient().from("content_agent_posts").insert({
    page_key: input.pageKey, scheduled_at: input.scheduledAt.toISOString(), post_type: input.postType,
    topic_id: input.topicId || null, topic: input.topic || null, caption: input.caption, hashtags: input.hashtags,
    meme_top_text: input.memeTopText || null, meme_bottom_text: input.memeBottomText || null, image_prompt: input.imagePrompt || null,
    status: input.status || "Draft", source_type: input.sourceType || "scheduled_topic", source_ref_id: input.sourceRefId || null, raw_payload: input.rawPayload || {},
  }).select("*").single();
  if (error) throw new Error(error.message);
  return data as ContentAgentPost;
}
