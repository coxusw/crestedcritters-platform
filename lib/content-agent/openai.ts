import type { ContentAgentPage, ContentAgentTopic, GeneratedPostPayload, NextSlot } from "./types";
import { createSupabaseAdminClient } from "./supabase-admin";
import { getTractionGuidanceForPage } from "./traction";

function getOpenAIKey() { const key = process.env.OPENAI_API_KEY; if (!key) throw new Error("Missing OPENAI_API_KEY."); return key; }
function extractJsonObject(text: string) { const trimmed = text.trim().replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim(); const start = trimmed.indexOf("{"); const end = trimmed.lastIndexOf("}"); return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed; }

export async function generatePostText(input: { page: ContentAgentPage; slot: NextSlot; topic: ContentAgentTopic | null; }) {
  const model = process.env.CONTENT_AGENT_TEXT_MODEL || "gpt-5.5";
  const tractionGuidance = await getTractionGuidanceForPage(input.page.page_key);
  const system = [`You are a Facebook content assistant for ${input.page.page_name}.`, "Generate only family-friendly content.", "Return valid JSON only."].join("\n");
  const user = {
    page: { key: input.page.page_key, name: input.page.page_name, websiteUrl: input.page.website_url },
    selectedTopic: input.topic?.topic || input.slot.postType,
    selectedTopicNotes: input.topic?.notes || "",
    tractionGuidance,
    slot: { scheduledAt: input.slot.scheduledAt.toISOString(), postType: input.slot.postType },
    instructions: {
      brandRules: input.page.brand_rules, textStyle: input.page.text_style, memeStyle: input.page.meme_style, defaultHashtags: input.page.default_hashtags,
      outputShape: '{ "topic": "...", "caption": "...", "hashtags": "...", "memeTopText": "", "memeBottomText": "", "imagePrompt": "" }',
      rules: [
        "Use the selected topic and notes.",
        "For text-only posts, leave memeTopText, memeBottomText, and imagePrompt blank.",
        "For Meme, Broke Meme, Broke Roast, or Satire Humor image posts, write a short caption, punchy memeTopText/memeBottomText, and a clear imagePrompt.",
        "Meme text should be short, readable, and split naturally between top and bottom text. Avoid long sentences in memeTopText or memeBottomText.",
        "The imagePrompt should describe the visual scene only. Do not ask the image model to render words or captions inside the image.",
        "Tap-Deck should remain text-only.",
        "Poverty Finance satire must clearly include #satire.",
        "For Poverty Finance, the joke can roast broke-budget habits and chaotic money choices, but keep it obviously playful and include one useful financial move.",
        "Do not reuse stale Poverty Finance phrasing such as opening the bank app like a horror movie. Make each joke feel like a new angle tied to the selected topic.",
        "Keep captions Facebook-friendly and not too long."
      ],
    },
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${getOpenAIKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(user, null, 2) }], response_format: { type: "json_object" } }),
  });
  const raw = await response.text();
  await createSupabaseAdminClient().from("content_agent_prompt_history").insert({ action: `generate:${input.page.page_key}:${input.slot.postType}`, prompt: JSON.stringify(user, null, 2), raw_response: raw });
  if (!response.ok) throw new Error(`OpenAI text error ${response.status}: ${raw}`);
  const parsed = JSON.parse(raw);
  const content = parsed.choices?.[0]?.message?.content;
  if (!content) throw new Error(`OpenAI response missing content: ${raw}`);
  return JSON.parse(extractJsonObject(content)) as GeneratedPostPayload;
}

export async function generateImageBase64(prompt: string) {
  const model = process.env.CONTENT_AGENT_IMAGE_MODEL || "gpt-image-2";
  const quality = process.env.CONTENT_AGENT_IMAGE_QUALITY || "high";
  const size = process.env.CONTENT_AGENT_IMAGE_SIZE || "1024x1024";
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${getOpenAIKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, size, quality, n: 1 }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`OpenAI image error ${response.status}: ${raw}`);
  const parsed = JSON.parse(raw);
  const b64 = parsed.data?.[0]?.b64_json || parsed.data?.[0]?.base64;
  if (!b64) throw new Error(`OpenAI image response missing b64_json: ${raw}`);
  return { base64: b64, model, quality, size };
}
