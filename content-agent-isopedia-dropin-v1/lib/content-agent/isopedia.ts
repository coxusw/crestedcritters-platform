import { createSupabaseAdminClient } from "./supabase-admin";
import { getPage, insertGeneratedPost, logContentAgent } from "./db";
import { generatePostText } from "./openai";
import type { ContentAgentTopic, NextSlot } from "./types";

function siteUrl() { return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.crestedcritters.com").replace(/\/$/, ""); }

export async function createLatestSpeciesAnnouncement() {
  const supabase = createSupabaseAdminClient();
  const page = await getPage("isopedia");
  if (!page) throw new Error("Isopedia content agent page is missing.");

  const { data: species, error } = await supabase.from("isopedia_species").select("id, common_name, scientific_name, slug, organism_type, difficulty, image_url, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!species) return "No species found.";

  const existing = await supabase.from("content_agent_posts").select("id").eq("source_type", "isopedia_species_verified").eq("source_ref_id", String(species.id)).maybeSingle();
  if (existing.data) return "Latest species already has a content post.";

  const topic: ContentAgentTopic = {
    id: "virtual-isopedia-species", page_key: "isopedia", topic: `New verified species: ${species.common_name}`, post_type: "Verified Species Announcement",
    notes: [`Common name: ${species.common_name}`, species.scientific_name ? `Scientific name: ${species.scientific_name}` : "", species.organism_type ? `Type: ${species.organism_type}` : "", species.difficulty ? `Difficulty: ${species.difficulty}` : "", `URL: ${siteUrl()}/isopedia/${species.slug}`, "Mention that this species is now live in the Isopedia database."].filter(Boolean).join("\n"),
    active: true, last_used_at: null, use_count: 0,
  };

  const slot: NextSlot = { pageKey: "isopedia", pageName: page.page_name, scheduledAt: new Date(Date.now() + 60 * 60 * 1000), postType: "Verified Species Announcement" };
  const generated = await generatePostText({ page, slot, topic });

  const post = await insertGeneratedPost({ pageKey: "isopedia", scheduledAt: slot.scheduledAt, postType: slot.postType, topic: generated.topic || topic.topic, caption: generated.caption, hashtags: generated.hashtags || page.default_hashtags || "", imagePrompt: generated.imagePrompt || "", status: "Draft", sourceType: "isopedia_species_verified", sourceRefId: String(species.id), rawPayload: { species, generated } });

  if (species.image_url) await supabase.from("content_agent_posts").update({ image_url: species.image_url, updated_at: new Date().toISOString() }).eq("id", post.id);
  await logContentAgent("isopedia_species_announcement", "OK", `Created post for ${species.common_name}`, "post", post.id);
  return `Created species announcement for ${species.common_name}.`;
}

export async function createIsopediaStatsPost() {
  const supabase = createSupabaseAdminClient();
  const page = await getPage("isopedia");
  if (!page) throw new Error("Isopedia content agent page is missing.");
  const [verifiedSpecies, pendingSubmissions, contributors, pendingExpos, totalExpos] = await Promise.all([
    supabase.from("isopedia_species").select("id", { count: "exact", head: true }),
    supabase.from("isopedia_submissions").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("isopedia_expos").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("isopedia_expos").select("id", { count: "exact", head: true }),
  ]);
  const topic: ContentAgentTopic = { id: "virtual-isopedia-stats", page_key: "isopedia", topic: "Isopedia community stats recap", post_type: "Community Stats", notes: [`Verified entries: ${verifiedSpecies.count || 0}`, `Submissions needing review: ${pendingSubmissions.count || 0}`, `Contributors/users: ${contributors.count || 0}`, `Expo listings: ${totalExpos.count || 0}`, `Pending expos: ${pendingExpos.count || 0}`].join("\n"), active: true, last_used_at: null, use_count: 0 };
  const slot: NextSlot = { pageKey: "isopedia", pageName: page.page_name, scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000), postType: "Community Stats" };
  const generated = await generatePostText({ page, slot, topic });
  const post = await insertGeneratedPost({ pageKey: "isopedia", scheduledAt: slot.scheduledAt, postType: slot.postType, topic: generated.topic || topic.topic, caption: generated.caption, hashtags: generated.hashtags || page.default_hashtags || "", status: "Draft", sourceType: "isopedia_stats", rawPayload: { generated } });
  await logContentAgent("isopedia_stats", "OK", "Created stats post.", "post", post.id);
  return "Created Isopedia stats post.";
}

export async function createExpoRoundupPost() {
  const supabase = createSupabaseAdminClient();
  const page = await getPage("isopedia");
  if (!page) throw new Error("Isopedia content agent page is missing.");
  const now = new Date();
  const weekOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const { data: expos, error } = await supabase.from("isopedia_expos").select("*").gte("start_date", now.toISOString().slice(0, 10)).lte("start_date", weekOut.toISOString().slice(0, 10)).order("start_date", { ascending: true }).limit(10);
  if (error) throw new Error(error.message);
  const topic: ContentAgentTopic = { id: "virtual-isopedia-expos", page_key: "isopedia", topic: "Upcoming expo roundup", post_type: "Weekly Expo Roundup", notes: `Create a weekly upcoming expo roundup. Expo rows: ${JSON.stringify(expos || [])}. If no expos are listed, ask people to submit upcoming expos to Isopedia.`, active: true, last_used_at: null, use_count: 0 };
  const slot: NextSlot = { pageKey: "isopedia", pageName: page.page_name, scheduledAt: new Date(Date.now() + 3 * 60 * 60 * 1000), postType: "Weekly Expo Roundup" };
  const generated = await generatePostText({ page, slot, topic });
  const post = await insertGeneratedPost({ pageKey: "isopedia", scheduledAt: slot.scheduledAt, postType: slot.postType, topic: generated.topic || topic.topic, caption: generated.caption, hashtags: generated.hashtags || page.default_hashtags || "", status: "Draft", sourceType: "isopedia_expo_roundup", rawPayload: { expos, generated } });
  await logContentAgent("isopedia_expo_roundup", "OK", "Created expo roundup post.", "post", post.id);
  return "Created Isopedia expo roundup post.";
}
