import type { ReactNode } from "react";

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING_PUNCTUATION_PATTERN = /[.,!?;:)\]]+$/;

export default function LinkifiedText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const rawUrl = match[0];
    const matchIndex = match.index ?? 0;
    const { url, trailingText } = splitTrailingPunctuation(rawUrl);
    const href = normalizeExternalHref(url);

    if (!href) continue;

    if (matchIndex > lastIndex) {
      nodes.push(text.slice(lastIndex, matchIndex));
    }

    nodes.push(
      <a
        key={`${href}-${matchIndex}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold text-emerald-300 underline decoration-emerald-300/40 underline-offset-4 hover:text-emerald-200"
      >
        {url}
      </a>
    );

    if (trailingText) nodes.push(trailingText);
    lastIndex = matchIndex + rawUrl.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return <>{nodes.length ? nodes : text}</>;
}

function splitTrailingPunctuation(rawUrl: string) {
  const trailingMatch = rawUrl.match(TRAILING_PUNCTUATION_PATTERN);
  const trailingText = trailingMatch?.[0] || "";
  const url = trailingText ? rawUrl.slice(0, -trailingText.length) : rawUrl;

  return { url, trailingText };
}

function normalizeExternalHref(url: string) {
  const href = url.startsWith("www.") ? `https://${url}` : url;

  try {
    const parsed = new URL(href);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}
