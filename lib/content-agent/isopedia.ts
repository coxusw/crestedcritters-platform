import { createSupabaseAdminClient } from "./supabase-admin";
import { getPage, insertGeneratedPost, logContentAgent } from "./db";
import { generatePostText } from "./openai";
import type { ContentAgentTopic, NextSlot } from "./types";

type ProfileLite = {
  id: string;
  username: string | null;
  display_name: string | null;
  business_name: string | null;
};

type SubmissionLite = {
  id: string;
  common_name: string | null;
  scientific_name: string | null;
  genus: string | null;
  species: string | null;
  morph: string | null;
  image_url: string | null;
  submitted_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string | null;
};

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://isopedia.crestedcritters.com").replace(/\/$/, "");
}

function safeIso(value: Date) {
  return value.toISOString();
}

function profileName(profile: ProfileLite | null | undefined, fallback: string) {
  return (
    profile?.display_name ||
    profile?.business_name ||
    profile?.username ||
    fallback
  );
}

function appendCreditToCaption(
  caption: string,
  submitterName: string,
  verifierName: string
) {
  const cleanCaption = caption.trim();
  const cleanSubmitter = submitterName.trim() || "the contributing keeper";
  const cleanVerifier = verifierName.trim() || "the Isopedia verification team";

  const credit =
    cleanSubmitter === cleanVerifier
      ? `Thank you to ${cleanSubmitter} for helping add and verify this entry for the community.`
      : `Thank you to ${cleanSubmitter} for submitting this entry and ${cleanVerifier} for verifying it for the community.`;

  if (cleanCaption.toLowerCase().includes(cleanSubmitter.toLowerCase())) {
    return cleanCaption;
  }

  return `${cleanCaption}\n\n${credit}`;
}

async function safeCount(
  table: string,
  build?: (query: any) => any
): Promise<number> {
  const supabase = createSupabaseAdminClient();

  try {
    let query = supabase.from(table).select("id", { count: "exact", head: true });
    if (build) query = build(query);

    const { count, error } = await query;

    if (error) {
      await logContentAgent("isopedia_safe_count", "ERROR", `${table}: ${error.message}`);
      return 0;
    }

    return count || 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logContentAgent("isopedia_safe_count", "ERROR", `${table}: ${message}`);
    return 0;
  }
}

function speciesMatchesSubmission(species: any, submission: SubmissionLite) {
  const speciesCommon = String(species.common_name || "").trim().toLowerCase();
  const subCommon = String(submission.common_name || "").trim().toLowerCase();

  if (speciesCommon && subCommon && speciesCommon === subCommon) return true;

  const speciesScientific = String(species.scientific_name || "").trim().toLowerCase();
  const subScientific = String(submission.scientific_name || "").trim().toLowerCase();

  if (speciesScientific && subScientific && speciesScientific === subScientific) {
    return true;
  }

  if (species.image_url && submission.image_url && species.image_url === submission.image_url) {
    return true;
  }

  const speciesParts = [species.genus, species.species, species.morph]
    .filter(Boolean)
    .join(" ")
    .trim()
    .toLowerCase();

  const subParts = [submission.genus, submission.species, submission.morph]
    .filter(Boolean)
    .join(" ")
    .trim()
    .toLowerCase();

  return Boolean(speciesParts && subParts && speciesParts === subParts);
}

async function findMatchingVerifiedSubmission(species: any) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("isopedia_submissions")
    .select(
      `
      id,
      common_name,
      scientific_name,
      genus,
      species,
      morph,
      image_url,
      submitted_by,
      verified_by,
      verified_at,
      created_at
      `
    )
    .eq("status", "verified")
    .order("verified_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    await logContentAgent(
      "find_matching_verified_submission",
      "ERROR",
      error.message
    );
    return null;
  }

  const submissions = (data || []) as SubmissionLite[];
  return submissions.find((item) => speciesMatchesSubmission(species, item)) || null;
}

async function getProfilesByIds(ids: Array<string | null | undefined>) {
  const cleanIds = Array.from(new Set(ids.filter(Boolean))) as string[];

  if (!cleanIds.length) return new Map<string, ProfileLite>();

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, business_name")
    .in("id", cleanIds);

  if (error) {
    await logContentAgent("get_profiles_by_ids", "ERROR", error.message);
    return new Map<string, ProfileLite>();
  }

  return new Map((data || []).map((profile) => [profile.id, profile as ProfileLite]));
}

export async function createLatestSpeciesAnnouncement() {
  const supabase = createSupabaseAdminClient();
  const page = await getPage("isopedia");

  if (!page) throw new Error("Isopedia content agent page is missing.");

  const { data: species, error } = await supabase
    .from("isopedia_species")
    .select(
      `
      id,
      common_name,
      scientific_name,
      slug,
      organism_type,
      genus,
      species,
      morph,
      difficulty,
      image_url,
      created_at
      `
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!species) return "No species found in isopedia_species.";

  const existing = await supabase
    .from("content_agent_posts")
    .select("id")
    .eq("source_type", "isopedia_species_verified")
    .eq("source_ref_id", String(species.id))
    .maybeSingle();

  if (existing.error) throw new Error(existing.error.message);

  if (existing.data) {
    return `Latest species already has a content post: ${species.common_name || species.slug}.`;
  }

  const matchingSubmission = await findMatchingVerifiedSubmission(species);
  const profilesById = await getProfilesByIds([
    matchingSubmission?.submitted_by,
    matchingSubmission?.verified_by,
  ]);

  const submitterProfile = matchingSubmission?.submitted_by
    ? profilesById.get(matchingSubmission.submitted_by)
    : null;

  const verifierProfile = matchingSubmission?.verified_by
    ? profilesById.get(matchingSubmission.verified_by)
    : null;

  const submitterName = profileName(submitterProfile, "the contributing keeper");
  const verifierName = profileName(verifierProfile, "the Isopedia verification team");

  const speciesUrl = `${siteUrl()}/isopedia/${species.slug}`;

  const topic: ContentAgentTopic = {
    id: "virtual-isopedia-species",
    page_key: "isopedia",
    topic: `New verified species: ${species.common_name || species.slug}`,
    post_type: "Verified Species Announcement",
    notes: [
      `Common name: ${species.common_name || "Unknown"}`,
      species.scientific_name ? `Scientific name: ${species.scientific_name}` : "",
      species.organism_type ? `Type: ${species.organism_type}` : "",
      species.genus ? `Genus: ${species.genus}` : "",
      species.species ? `Species: ${species.species}` : "",
      species.morph ? `Morph: ${species.morph}` : "",
      species.difficulty ? `Difficulty: ${species.difficulty}` : "",
      `URL: ${speciesUrl}`,
      `Submitted by: ${submitterName}`,
      `Verified by: ${verifierName}`,
      "IMPORTANT: Include a short thank-you/shoutout to both the submitter and verifier in the caption.",
      "Mention that this species is now live in the Isopedia database.",
      "Invite keepers to view the entry, discuss, and contribute knowledge.",
    ]
      .filter(Boolean)
      .join("\n"),
    active: true,
    last_used_at: null,
    use_count: 0,
  };

  const slot: NextSlot = {
    pageKey: "isopedia",
    pageName: page.page_name,
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    postType: "Verified Species Announcement",
  };

  const generated = await generatePostText({ page, slot, topic });
  const captionWithCredit = appendCreditToCaption(
    generated.caption,
    submitterName,
    verifierName
  );

  const post = await insertGeneratedPost({
    pageKey: "isopedia",
    scheduledAt: slot.scheduledAt,
    postType: slot.postType,
    topicId: null,
    topic: generated.topic || topic.topic,
    caption: captionWithCredit,
    hashtags: generated.hashtags || page.default_hashtags || "",
    imagePrompt: generated.imagePrompt || "",
    status: "Draft",
    sourceType: "isopedia_species_verified",
    sourceRefId: String(species.id),
    rawPayload: {
      species,
      speciesUrl,
      matchingSubmission,
      credits: {
        submitterName,
        verifierName,
      },
      generated,
    },
  });

  if (species.image_url) {
    const { error: updateError } = await supabase
      .from("content_agent_posts")
      .update({
        image_url: species.image_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    if (updateError) throw new Error(updateError.message);
  }

  await logContentAgent(
    "isopedia_species_announcement",
    "OK",
    `Created post for ${species.common_name || species.slug} with submitter=${submitterName}, verifier=${verifierName}`,
    "post",
    post.id
  );

  return `Created species announcement draft for ${species.common_name || species.slug}.`;
}

export async function createIsopediaStatsPost() {
  const page = await getPage("isopedia");

  if (!page) throw new Error("Isopedia content agent page is missing.");

  const [
    verifiedSpecies,
    pendingSubmissions,
    suggestedEdits,
    contributors,
    pendingExpos,
    totalExpos,
    openDiscussionReports,
  ] = await Promise.all([
    safeCount("isopedia_species"),
    safeCount("isopedia_submissions", (query) => query.eq("status", "unverified")),
    safeCount("isopedia_suggested_edits"),
    safeCount("profiles"),
    safeCount("isopedia_expos", (query) => query.eq("status", "pending")),
    safeCount("isopedia_expos"),
    safeCount("isopedia_discussion_reports", (query) => query.eq("status", "open")),
  ]);

  const topic: ContentAgentTopic = {
    id: "virtual-isopedia-stats",
    page_key: "isopedia",
    topic: "Isopedia community stats recap",
    post_type: "Community Stats",
    notes: [
      `Verified species/entries: ${verifiedSpecies}`,
      `Submissions needing review: ${pendingSubmissions}`,
      `Suggested edits: ${suggestedEdits}`,
      `Contributors/users: ${contributors}`,
      `Expo listings: ${totalExpos}`,
      `Pending expos: ${pendingExpos}`,
      `Open discussion reports: ${openDiscussionReports}`,
      "Make this sound like a community progress update.",
      "Invite keepers to contribute species, expo listings, corrections, and experience.",
      `Main URL: ${page.website_url || `${siteUrl()}/isopedia`}`,
    ].join("\n"),
    active: true,
    last_used_at: null,
    use_count: 0,
  };

  const slot: NextSlot = {
    pageKey: "isopedia",
    pageName: page.page_name,
    scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    postType: "Community Stats",
  };

  const generated = await generatePostText({ page, slot, topic });

  const post = await insertGeneratedPost({
    pageKey: "isopedia",
    scheduledAt: slot.scheduledAt,
    postType: slot.postType,
    topic: generated.topic || topic.topic,
    caption: generated.caption,
    hashtags: generated.hashtags || page.default_hashtags || "",
    status: "Draft",
    sourceType: "isopedia_stats",
    rawPayload: {
      stats: {
        verifiedSpecies,
        pendingSubmissions,
        suggestedEdits,
        contributors,
        totalExpos,
        pendingExpos,
        openDiscussionReports,
      },
      generated,
    },
  });

  await logContentAgent("isopedia_stats", "OK", "Created stats post.", "post", post.id);

  return "Created Isopedia stats recap draft.";
}

export async function createExpoRoundupPost() {
  const supabase = createSupabaseAdminClient();
  const page = await getPage("isopedia");

  if (!page) throw new Error("Isopedia content agent page is missing.");

  const now = new Date();
  const weekOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const { data: expos, error } = await supabase
    .from("isopedia_expos")
    .select(
      `
      id,
      name,
      slug,
      city,
      state,
      venue,
      starts_at,
      ends_at,
      description,
      flyer_image_url
      `
    )
    .eq("status", "approved")
    .gte("starts_at", safeIso(now))
    .lte("starts_at", safeIso(weekOut))
    .order("starts_at", { ascending: true })
    .limit(10);

  if (error) throw new Error(error.message);

  const expoUrl = `${siteUrl()}/isopedia/expos`;

  const topic: ContentAgentTopic = {
    id: "virtual-isopedia-expos",
    page_key: "isopedia",
    topic: "Upcoming expo roundup",
    post_type: "Weekly Expo Roundup",
    notes: [
      "Create a weekly upcoming expo roundup.",
      `Expo calendar URL: ${expoUrl}`,
      `Expo rows: ${JSON.stringify(expos || [], null, 2)}`,
      "If no expos are listed, ask people to submit upcoming expos to Isopedia.",
      "Mention the expo calendar and invite people to add shows they know about.",
    ].join("\n"),
    active: true,
    last_used_at: null,
    use_count: 0,
  };

  const slot: NextSlot = {
    pageKey: "isopedia",
    pageName: page.page_name,
    scheduledAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
    postType: "Weekly Expo Roundup",
  };

  const generated = await generatePostText({ page, slot, topic });

  const post = await insertGeneratedPost({
    pageKey: "isopedia",
    scheduledAt: slot.scheduledAt,
    postType: slot.postType,
    topic: generated.topic || topic.topic,
    caption: generated.caption,
    hashtags: generated.hashtags || page.default_hashtags || "",
    status: "Draft",
    sourceType: "isopedia_expo_roundup",
    rawPayload: { expos: expos || [], expoUrl, generated },
  });

  await logContentAgent("isopedia_expo_roundup", "OK", "Created expo roundup post.", "post", post.id);

  return `Created Isopedia expo roundup draft with ${(expos || []).length} upcoming expo(s).`;
}
