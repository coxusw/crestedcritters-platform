const STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "and",
  "are",
  "before",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "what",
  "when",
  "why",
  "with",
  "without",
  "your",
]);

export function normalizeTopicText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .join(" ");
}

export function topicTokens(value: string | null | undefined) {
  return new Set(normalizeTopicText(value).split(" ").filter(Boolean));
}

export function topicSimilarity(a: string | null | undefined, b: string | null | undefined) {
  const aTokens = topicTokens(a);
  const bTokens = topicTokens(b);

  if (!aTokens.size || !bTokens.size) return 0;

  let overlap = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) overlap += 1;
  });

  return overlap / Math.min(aTokens.size, bTokens.size);
}

export function areSimilarTopics(a: string | null | undefined, b: string | null | undefined) {
  const normalizedA = normalizeTopicText(a);
  const normalizedB = normalizeTopicText(b);

  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) {
    return Math.min(normalizedA.length, normalizedB.length) >= 18;
  }

  return topicSimilarity(normalizedA, normalizedB) >= 0.72;
}
