import { createSupabaseAdminClient } from "./supabase-admin";
import { generateImageBase64 } from "./openai";
import { buildMemeImagePrompt, composeMemeImage, fallbackMemeText } from "./meme-image";
import { isImagePostTypeForPage } from "./scheduler";
import type { ContentAgentPost } from "./types";

export async function generateImageForNextPost() {
  const supabase = createSupabaseAdminClient();
  const { data: posts, error } = await supabase
    .from("content_agent_posts")
    .select("*")
    .is("image_url", null)
    .not("status", "in", '("Rejected","Posted")')
    .order("scheduled_at", { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);
  const post = (posts || []).find((item) =>
    isImagePostTypeForPage(item.page_key, item.post_type)
  ) as ContentAgentPost | undefined;
  if (!post) return { generated: false, message: "No eligible missing image posts." };

  const prompt = buildMemeImagePrompt({
    pageKey: post.page_key,
    imagePrompt: post.image_prompt,
    caption: post.caption,
  });
  const image = await generateImageBase64(prompt);
  const memeText = fallbackMemeText({
    pageKey: post.page_key,
    topic: post.topic,
    caption: post.caption,
    topText: post.meme_top_text,
    bottomText: post.meme_bottom_text,
  });
  const buffer = await composeMemeImage(Buffer.from(image.base64, "base64"), {
    topText: memeText.topText,
    bottomText: memeText.bottomText,
  });
  const path = `${post.page_key}/${post.id}.png`;

  const upload = await supabase.storage.from("content-agent-media").upload(path, buffer, { contentType: "image/png", upsert: true });
  if (upload.error) throw new Error(upload.error.message);
  const { data: publicData } = supabase.storage.from("content-agent-media").getPublicUrl(path);

  const { error: updateError } = await supabase.from("content_agent_posts").update({ image_url: publicData.publicUrl, image_storage_path: path, updated_at: new Date().toISOString() }).eq("id", post.id);
  if (updateError) throw new Error(updateError.message);

  await supabase.from("content_agent_media_assets").insert({ post_id: post.id, page_key: post.page_key, storage_path: path, public_url: publicData.publicUrl, model: image.model, prompt, status: "Ready" });
  return { generated: true, postId: post.id, imageUrl: publicData.publicUrl };
}
