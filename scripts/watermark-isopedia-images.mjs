import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = "isopedia-images";
const WATERMARK_TEXT = "ISOPEDIA";

const GLYPHS = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
};

const IMAGE_SOURCES = [
  { table: "isopedia_species", columns: ["image_url"] },
  { table: "isopedia_species_images", columns: ["image_url"] },
  { table: "isopedia_submissions", columns: ["image_url"] },
  { table: "isopedia_guide_images", columns: ["image_url"] },
  { table: "isopedia_suggested_edits", columns: ["current_value", "proposed_value"] },
];

function loadEnvFile(fileName) {
  const filePath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

function argValue(name) {
  const prefix = `${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : "";
}

function storagePathFromPublicUrl(url, supabaseUrl) {
  if (!url || !url.includes(`/storage/v1/object/public/${BUCKET}/`)) return "";

  try {
    const parsed = new URL(url);
    const expectedHost = new URL(supabaseUrl).host;
    if (parsed.host !== expectedHost) return "";

    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return "";

    return decodeURIComponent(parsed.pathname.slice(index + marker.length));
  } catch {
    return "";
  }
}

function watermarkSvg(width) {
  const pixel = Math.max(2, Math.min(5, Math.round(width * 0.004)));
  const gap = Math.max(1, Math.round(pixel * 0.8));
  const letterGap = Math.max(3, Math.round(pixel * 1.6));
  const padding = Math.max(8, Math.round(width * 0.015));
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
      <g fill="none" stroke="rgba(0,0,0,0.36)" stroke-width="${Math.max(
        1,
        Math.round(pixel * 0.75)
      )}" stroke-linejoin="round">${blocks}</g>
      <g fill="rgba(255,255,255,0.38)">${blocks}</g>
    </svg>
  `);
}

async function watermarkImage(input) {
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
    .composite([{ input: watermarkSvg(Math.min(width, 1800)), gravity: "northeast" }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

async function collectImagePaths(supabase, supabaseUrl) {
  const paths = new Set();

  for (const source of IMAGE_SOURCES) {
    const { data, error } = await supabase
      .from(source.table)
      .select(source.columns.join(","));

    if (error) {
      console.warn(`Skipping ${source.table}: ${error.message}`);
      continue;
    }

    for (const row of data || []) {
      for (const column of source.columns) {
        const storagePath = storagePathFromPublicUrl(String(row[column] || ""), supabaseUrl);
        if (storagePath) paths.add(storagePath);
      }
    }
  }

  return [...paths].sort();
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  const apply = process.argv.includes("--apply");
  const limit = Number(argValue("--limit") || 0);

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local or your shell."
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const allPaths = await collectImagePaths(supabase, supabaseUrl);
  const paths = limit > 0 ? allPaths.slice(0, limit) : allPaths;

  console.log(`${apply ? "Applying" : "Dry run:"} ${paths.length} Isopedia image object(s).`);

  if (!apply) {
    for (const imagePath of paths) console.log(`would watermark ${imagePath}`);
    console.log("Run with --apply to overwrite these storage objects.");
    return;
  }

  for (const imagePath of paths) {
    const { data: original, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(imagePath);

    if (downloadError || !original) {
      console.warn(`Could not download ${imagePath}: ${downloadError?.message || "unknown error"}`);
      continue;
    }

    const watermarked = await watermarkImage(Buffer.from(await original.arrayBuffer()));
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(imagePath, watermarked, {
        upsert: true,
        cacheControl: "3600",
        contentType: "image/jpeg",
        metadata: { isopediaWatermarked: "true" },
      });

    if (uploadError) {
      console.warn(`Could not upload ${imagePath}: ${uploadError.message}`);
      continue;
    }

    console.log(`watermarked ${imagePath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
