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

const blockFont: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "$": ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "00000", "01100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
};

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

function normalizeBlockText(text: string) {
  return cleanMemeText(text).replace(/[^A-Z0-9?!&$#\-'., ]/g, "");
}

function blockLineWidth(line: string, scale: number) {
  return Array.from(line).reduce((width, character, index) => {
    const glyphWidth = character === " " ? 3 : 5;
    const spacing = index === 0 ? 0 : 1;
    return width + (glyphWidth + spacing) * scale;
  }, 0);
}

function wrapBlockText(text: string, scale: number, maxWidth: number) {
  const words = normalizeBlockText(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (blockLineWidth(next, scale) <= maxWidth || !current) {
      current = next;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function drawBlockLine(
  context: CanvasContext,
  line: string,
  x: number,
  y: number,
  scale: number,
  color: string
) {
  let cursorX = x;
  context.fillStyle = color;

  for (const character of Array.from(line)) {
    if (character === " ") {
      cursorX += 4 * scale;
      continue;
    }

    const glyph = blockFont[character] || blockFont["?"];

    for (let row = 0; row < glyph.length; row += 1) {
      for (let col = 0; col < glyph[row].length; col += 1) {
        if (glyph[row][col] !== "1") continue;
        context.fillRect(cursorX + col * scale, y + row * scale, scale, scale);
      }
    }

    cursorX += 6 * scale;
  }
}

function drawMemeText(context: CanvasContext, text: string, position: "top" | "bottom") {
  const cleanText = normalizeBlockText(text);
  if (!cleanText) return;

  const maxWidth = CANVAS_SIZE - SIDE_PADDING * 2;
  let scale = 15;
  let lines: string[] = [];

  while (scale >= 7) {
    lines = wrapBlockText(cleanText, scale, maxWidth);

    if (lines.every((line) => blockLineWidth(line, scale) <= maxWidth)) break;
    scale -= 1;
  }

  const lineHeight = Math.round(8.5 * scale);
  const blockHeight = lineHeight * lines.length;
  const startY =
    position === "top"
      ? 66
      : CANVAS_SIZE - 66 - blockHeight;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineWidth = blockLineWidth(line, scale);
    const x = (CANVAS_SIZE - lineWidth) / 2;
    const y = startY + index * lineHeight;

    for (const [offsetX, offsetY] of [
      [-scale, 0],
      [scale, 0],
      [0, -scale],
      [0, scale],
      [-scale, -scale],
      [scale, -scale],
      [-scale, scale],
      [scale, scale],
    ]) {
      drawBlockLine(context, line, x + offsetX, y + offsetY, scale, "#050505");
    }

    drawBlockLine(context, line, x, y, scale, "#ffffff");
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
