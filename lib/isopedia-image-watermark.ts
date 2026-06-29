import sharp from "sharp";

const WATERMARK_TEXT = "Isopedia";

function watermarkSvg(width: number) {
  const fontSize = Math.max(24, Math.min(54, Math.round(width * 0.06)));
  const padding = Math.max(12, Math.round(width * 0.022));
  const textWidth = Math.ceil(fontSize * 4.7);
  const svgWidth = textWidth + padding * 2;
  const svgHeight = fontSize + padding * 2;

  return Buffer.from(`
    <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="${svgWidth - padding}"
        y="${padding}"
        dominant-baseline="text-before-edge"
        text-anchor="end"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}"
        font-weight="800"
        fill="rgba(255,255,255,0.42)"
        stroke="rgba(0,0,0,0.46)"
        stroke-width="${Math.max(1, Math.round(fontSize * 0.055))}"
        paint-order="stroke fill"
      >${WATERMARK_TEXT}</text>
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
