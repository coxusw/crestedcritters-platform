import { createCanvas, loadImage } from "canvas";
import sharp from "sharp";

const CANVAS_SIZE = 1024;
const SIDE_PADDING = 70;
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

type CanvasContext = ReturnType<ReturnType<typeof createCanvas>["getContext"]>;

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
      ? "Realistic candid social-media photo style, relatable broke-budget scene, natural lighting, believable human expression, real grocery store or home setting, crisp details, high contrast, not a cartoon, not an illustration."
      : "Ultra-realistic macro pet photography of a real terrestrial isopod or springtails in a bioactive terrarium. Real segmented exoskeleton, many small legs, antennae, natural body plates, no cartoon eyes, no toy look, no wire coil, no metal, no plastic creature, shallow depth of field, natural cork bark, leaf litter, soil, moss, and terrarium plants.";

  const cleanPrompt = sanitizeVisualPrompt(imagePrompt) || sanitizeVisualPrompt(caption);

  return [
    cleanPrompt || "Create a funny meme background.",
    visualStyle,
    "Create only background art for a meme template.",
    "ABSOLUTELY NO TEXT OF ANY KIND: no captions, words, letters, numbers, symbols, fake app text, labels, signs, speech bubbles, logos, watermarks, price tags, handwriting, or UI words.",
    "Any screens, phones, receipts, cards, books, shelves, signs, documents, product packaging, or posters must be blank or abstract color blocks with no characters.",
    cleanPageKey === "crested"
      ? "The main animal must look like a real isopod or springtail photographed in macro, not a fantasy creature, not a snail, not a worm, not a coiled wire, not jewelry, not a toy, not a cartoon."
      : "",
    "Leave the upper and lower portions visually simple for large app-added overlay text.",
    "Square 1:1 Facebook-ready image, crisp details, professional lighting, vibrant but natural colors.",
  ]
    .filter(Boolean)
    .join("\n");
}

function wrapCanvasText(context: CanvasContext, text: string, maxWidth: number) {
  const words = text.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (context.measureText(next).width <= maxWidth || !current) {
      current = next;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function drawMemeText(context: CanvasContext, text: string, position: "top" | "bottom") {
  const cleanText = cleanMemeText(text);
  if (!cleanText) return;

  const maxWidth = CANVAS_SIZE - SIDE_PADDING * 2;
  let fontSize = 92;
  let lines: string[] = [];

  while (fontSize >= 46) {
    context.font = `900 ${fontSize}px Arial`;
    lines = wrapCanvasText(context, cleanText, maxWidth);

    if (lines.every((line) => context.measureText(line).width <= maxWidth)) break;
    fontSize -= 4;
  }

  const lineHeight = Math.round(fontSize * 1.08);
  const blockHeight = lineHeight * lines.length;
  const startY =
    position === "top"
      ? 66 + fontSize
      : CANVAS_SIZE - 66 - blockHeight + fontSize;

  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.lineJoin = "round";
  context.strokeStyle = "#050505";
  context.fillStyle = "#ffffff";
  context.lineWidth = Math.max(8, Math.round(fontSize * 0.12));
  context.font = `900 ${fontSize}px Arial`;

  for (let index = 0; index < lines.length; index += 1) {
    const y = startY + index * lineHeight;
    context.strokeText(lines[index], CANVAS_SIZE / 2, y);
    context.fillText(lines[index], CANVAS_SIZE / 2, y);
  }
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

  const normalizedBase = await sharp(baseBuffer)
    .resize(CANVAS_SIZE, CANVAS_SIZE, { fit: "cover", position: "attention" })
    .png()
    .toBuffer();

  if (!topText && !bottomText) return normalizedBase;

  const loadedImage = await loadImage(normalizedBase);
  const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  const context = canvas.getContext("2d");

  context.drawImage(loadedImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const topGradient = context.createLinearGradient(0, 0, 0, 280);
  topGradient.addColorStop(0, "rgba(0,0,0,0.70)");
  topGradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = topGradient;
  context.fillRect(0, 0, CANVAS_SIZE, 280);

  const bottomGradient = context.createLinearGradient(0, CANVAS_SIZE, 0, CANVAS_SIZE - 310);
  bottomGradient.addColorStop(0, "rgba(0,0,0,0.76)");
  bottomGradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = bottomGradient;
  context.fillRect(0, CANVAS_SIZE - 310, CANVAS_SIZE, 310);

  drawMemeText(context, topText, "top");
  drawMemeText(context, bottomText, "bottom");

  return canvas.toBuffer("image/png");
}
