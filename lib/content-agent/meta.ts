import type { ContentAgentPage, ContentAgentPost } from "./types";

function getPageToken(page: ContentAgentPage) {
  const key = page.token_env_key || "";
  const token = key ? process.env[key] : "";

  if (!token) {
    throw new Error(`Missing Meta page token env var: ${key}`);
  }

  return token;
}

function getMetaVersion() {
  return process.env.META_API_VERSION || "v25.0";
}

function cleanMessage(post: ContentAgentPost) {
  return [post.caption, post.hashtags].filter(Boolean).join("\n\n").trim();
}

function isPublicHttpUrl(value: string | null | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function facebookPostUrlFromResult(result: any) {
  const postId = result?.post_id || result?.id || null;
  return postId ? `https://www.facebook.com/${postId}` : null;
}

export async function publishPostToFacebook(
  page: ContentAgentPage,
  post: ContentAgentPost
) {
  if (!page.meta_page_id) {
    throw new Error(`Missing Meta Page ID for ${page.page_name}.`);
  }

  const token = getPageToken(page);
  const version = getMetaVersion();
  const message = cleanMessage(post);

  // Important:
  // Publish ANY content-agent row with image_url as a Facebook photo post.
  // This includes Isopedia verified species announcements using the uploaded species photo.
  if (isPublicHttpUrl(post.image_url)) {
    const url = `https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(page.meta_page_id)}/photos`;

    const body = new URLSearchParams({
      caption: message,
      url: post.image_url as string,
      published: "true",
      access_token: token,
    });

    const response = await fetch(url, {
      method: "POST",
      body,
    });

    const raw = await response.text();

    if (!response.ok) {
      throw new Error(`Facebook photo error ${response.status}: ${raw}`);
    }

    const result = JSON.parse(raw);

    return {
      ...result,
      post_url: facebookPostUrlFromResult(result),
      published_as: "photo",
    };
  }

  const url = `https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(page.meta_page_id)}/feed`;

  const body = new URLSearchParams({
    message,
    access_token: token,
  });

  const response = await fetch(url, {
    method: "POST",
    body,
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`Facebook feed error ${response.status}: ${raw}`);
  }

  const result = JSON.parse(raw);

  return {
    ...result,
    post_url: facebookPostUrlFromResult(result),
    published_as: "feed",
  };
}
