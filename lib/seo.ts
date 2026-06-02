export function truncateMetaDescription(value: string, fallback: string, maxLength = 160) {
  const cleaned = value
    .replace(/\s+/g, " ")
    .trim();

  const source = cleaned || fallback;

  if (source.length <= maxLength) return source;

  const clipped = source.slice(0, maxLength - 1).trimEnd();
  const lastSpace = clipped.lastIndexOf(" ");
  const readable = lastSpace > 90 ? clipped.slice(0, lastSpace) : clipped;

  return `${readable.replace(/[.,;:!?-]+$/, "")}...`;
}

export const noIndexRobots = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
};
