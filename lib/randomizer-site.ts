export const randomizerBaseUrl = (
  process.env.RANDOMIZER_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_RANDOMIZER_URL ||
  "https://randomizer.crestedcritters.com"
).replace(/\/$/, "");

export function absoluteRandomizerUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${randomizerBaseUrl}${normalizedPath}`;
}
