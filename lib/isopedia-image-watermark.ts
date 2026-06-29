import sharp from "sharp";

const WATERMARK_TEXT = "ISOPEDIA";
const WATERMARK_VERSION = "soft-dot-20260629";

const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
};

function watermarkSvg(width: number) {
  const pixel = Math.max(1.1, Math.min(2.4, width * 0.0023));
  const gap = Math.max(0.6, pixel * 0.55);
  const letterGap = Math.max(1.5, pixel * 1.15);
  const padding = Math.max(7, width * 0.012);
  const glyphWidth = 5 * pixel + 4 * gap;
  const glyphHeight = 7 * pixel + 6 * gap;
  const textWidth =
    WATERMARK_TEXT.length * glyphWidth + (WATERMARK_TEXT.length - 1) * letterGap;
  const svgWidth = textWidth + padding * 2;
  const svgHeight = glyphHeight + padding * 2;
  let cursor = padding;
  let blocks = "";

  for (const char of WATERMARK_TEXT) {
    const glyph = GLYPHS[char];
    if (!glyph) continue;

    glyph.forEach((row, y) => {
      [...row].forEach((value, x) => {
        if (value !== "1") return;
        blocks += `<rect x="${cursor + x * (pixel + gap)}" y="${
          padding + y * (pixel + gap)
        }" width="${pixel}" height="${pixel}" rx="${Math.max(
          0.6,
          pixel * 0.25
        )}" />`;
      });
    });

    cursor += glyphWidth + letterGap;
  }

  return Buffer.from(`
    <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="${Math.max(
        0.7,
        pixel * 0.55
      )}" stroke-linejoin="round">${blocks}</g>
      <g fill="rgba(255,255,255,0.24)">${blocks}</g>
    </svg>
  `);
}

export async function watermarkImageBuffer(input: Buffer) {
  const image = sharp(input, { animated: false }).rotate();
  const metadata = await image.metadata();
  const width = metadata.width || 1200;

  return await image
    .resize({
      width: width > 1800 ? 1800 : undefined,
      height: metadata.height && metadata.height > 1800 ? 1800 : undefined,
      fit: "inside",
      withoutEnlargement: true,
    })
    .composite([
      {
        input: watermarkSvg(Math.min(width, 1800)),
        gravity: "northeast",
      },
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

export function watermarkedImageContentType() {
  return "image/jpeg";
}

export function watermarkedImageVersion() {
  return WATERMARK_VERSION;
}
