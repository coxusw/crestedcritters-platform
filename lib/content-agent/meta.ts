import type { ContentAgentPage, ContentAgentPost } from "./types";

function getPageToken(page: ContentAgentPage) {
  const key = page.token_env_key || "";
  const token = key ? process.env[key] : "";
  if (!token) throw new Error(`Missing Meta page token env var: ${key}`);
  return token;
}
function getMetaVersion() { return process.env.META_API_VERSION || "v25.0"; }

export async function publishPostToFacebook(page: ContentAgentPage, post: ContentAgentPost) {
  if (!page.meta_page_id) throw new Error(`Missing Meta Page ID for ${page.page_name}.`);
  const token = getPageToken(page);
  const message = [post.caption, post.hashtags].filter(Boolean).join("\n\n");

  if (post.image_url && (post.post_type === "Meme" || post.post_type === "Broke Meme" || post.image_prompt)) {
    const url = `https://graph.facebook.com/${encodeURIComponent(getMetaVersion())}/${encodeURIComponent(page.meta_page_id)}/photos`;
    const response = await fetch(url, { method: "POST", body: new URLSearchParams({ caption: message, url: post.image_url, published: "true", access_token: token }) });
    const raw = await response.text();
    if (!response.ok) throw new Error(`Facebook photo error ${response.status}: ${raw}`);
    return JSON.parse(raw);
  }

  const url = `https://graph.facebook.com/${encodeURIComponent(getMetaVersion())}/${encodeURIComponent(page.meta_page_id)}/feed`;
  const response = await fetch(url, { method: "POST", body: new URLSearchParams({ message, access_token: token }) });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Facebook feed error ${response.status}: ${raw}`);
  return JSON.parse(raw);
}
