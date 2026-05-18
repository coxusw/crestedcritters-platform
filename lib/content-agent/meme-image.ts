import sharp from "sharp";

const CANVAS_SIZE = 1024;
const SIDE_PADDING = 70;
const MAX_LINE_CHARS = 22;
const fakeTextTerms = [
  "caption",
  "meme text",
  "top text",
  "bottom text",
  "overlay text",
  "speech bubble",
  "word",
  "words",
  "letters",
  "readable text",
  "sign says",
  "screen says",
];

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanMemeText(value: string | null | undefined) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function sanitizeVisualPrompt(value: string | null | undefined) {
  return String(value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => {
      const cleanLine = line.toLowerCase();
      return !fakeTextTerms.some((term) => cleanLine.includes(term));
    })
    .join("\n")
    .trim();
}

function stripTopicPrefix(value: string | null | undefined) {
  return String(value || "")
    .replace(/^(broke|crested critters|informational|sassy|satire|real finance|keeper|community|bioactive)?\s*(meme|roast|tip|question)?\s*\d*\s*:\s*/i, "")
    .replace(/^(when|if)\s+/i, "")
    .trim();
}

export function fallbackMemeText({
  pageKey,
  topic,
  caption,
  topText,
  bottomText,
}: {
  pageKey: string;
  topic: string | null;
  caption: string | null;
  topText?: string | null;
  bottomText?: string | null;
}) {
  const cleanTop = cleanMemeText(topText);
  const cleanBottom = cleanMemeText(bottomText);

  if (cleanTop || cleanBottom) {
    return { topText: cleanTop, bottomText: cleanBottom };
  }

  const subject =
    stripTopicPrefix(topic) ||
    String(caption || "")
      .split(/[.!?]/)[0]
      .trim();

  if (!subject) {
    return {
      topText: "WHEN THE HOBBY GETS SERIOUS",
      bottomText: "AND THE BUDGET WAS NOT CONSULTED",
    };
  }

  const cleanPageKey = String(pageKey || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const bottom =
    cleanPageKey === "povertyfinance"
      ? "BROKE MATH STRIKES AGAIN"
      : "TINY CREATURES, BIG DRAMA";

  return {
    topText: `WHEN ${subject}`,
    bottomText: bottom,
  };
}

function wrapText(text: string) {
  const words = text.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= MAX_LINE_CHARS || !current) {
      current = next;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function fontSizeFor(lines: string[]) {
  const longest = Math.max(...lines.map((line) => line.length), 1);
  const byLength = Math.floor(900 / Math.max(longest, 8));
  const byLineCount = lines.length >= 3 ? 78 : lines.length === 2 ? 88 : 104;
  return Math.max(48, Math.min(byLength, byLineCount));
}

function textBlockSvg(text: string, position: "top" | "bottom") {
  const cleanText = cleanMemeText(text);
  if (!cleanText) return "";

  const lines = wrapText(cleanText);
  const fontSize = fontSizeFor(lines);
  const lineHeight = Math.round(fontSize * 1.08);
  const blockHeight = lineHeight * lines.length;
  const startY =
    position === "top"
      ? 58 + fontSize
      : CANVAS_SIZE - 58 - blockHeight + fontSize;

  const textLines = lines
    .map((line, index) => {
      const y = startY + index * lineHeight;
      return `<text x="${CANVAS_SIZE / 2}" y="${y}" text-anchor="middle">${escapeXml(line)}</text>`;
    })
    .join("");

  return `<g class="meme-text">${textLines}</g>`;
}

export function buildMemeImagePrompt({
  pageKey,
  imagePrompt,
  caption,
}: {
  pageKey: string;
  imagePrompt: string | null;
  caption: string | null;
}) {
  const cleanPageKey = String(pageKey || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const visualStyle =
    cleanPageKey === "povertyfinance"
      ? "Funny, expressive editorial meme background with a relatable broke-budget scene, polished social media illustration, strong facial expressions, clean composition, high contrast."
      : "Funny, expressive isopod and bioactive terrarium meme background, polished social media illustration, charming tiny-critter details, clean composition, high contrast.";

  const cleanPrompt = sanitizeVisualPrompt(imagePrompt) || sanitizeVisualPrompt(caption);

  return [
    cleanPrompt || "Create a funny meme background.",
    visualStyle,
    "Create only background art for a meme template.",
    "ABSOLUTELY NO TEXT OF ANY KIND: no captions, words, letters, numbers, symbols, fake app text, labels, signs, speech bubbles, logos, watermarks, price tags, handwriting, or UI words.",
    "Any screens, phones, receipts, cards, books, shelves, signs, documents, product packaging, or posters must be blank or abstract color blocks with no characters.",
    "Leave the upper and lower portions visually simple for large app-added overlay text.",
    "Square 1:1 Facebook-ready image, crisp details, professional lighting, vibrant but natural colors.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function composeMemeImage(
  baseBuffer: Buffer,
  options: {
    topText?: string | null;
    bottomText?: string | null;
  }
) {
  const topText = cleanMemeText(options.topText);
  const bottomText = cleanMemeText(options.bottomText);

  const image = sharp(baseBuffer)
    .resize(CANVAS_SIZE, CANVAS_SIZE, { fit: "cover", position: "attention" })
    .png();

  if (!topText && !bottomText) return image.toBuffer();

  const svg = `
    <svg width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="topShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.70"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="bottomShade" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.76"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${CANVAS_SIZE}" height="280" fill="url(#topShade)"/>
      <rect x="0" y="${CANVAS_SIZE - 310}" width="${CANVAS_SIZE}" height="310" fill="url(#bottomShade)"/>
      <style>
        .meme-text text {
          font-family: Impact, "Arial Black", Arial, sans-serif;
          font-weight: 900;
          letter-spacing: 1px;
          fill: #ffffff;
          stroke: #050505;
          stroke-width: 9px;
          paint-order: stroke fill;
          dominant-baseline: alphabetic;
        }
      </style>
      <g transform="translate(${SIDE_PADDING}, 0) scale(${(CANVAS_SIZE - SIDE_PADDING * 2) / CANVAS_SIZE}, 1)">
        ${textBlockSvg(topText, "top")}
        ${textBlockSvg(bottomText, "bottom")}
      </g>
    </svg>`;

  return image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
