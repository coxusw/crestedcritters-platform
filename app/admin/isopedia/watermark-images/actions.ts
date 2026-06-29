"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import {
  watermarkImageBuffer,
  watermarkedImageContentType,
} from "@/lib/isopedia-image-watermark";

const BUCKET = "isopedia-images";

const IMAGE_SOURCES = [
  { table: "isopedia_species", columns: ["image_url"] },
  { table: "isopedia_species_images", columns: ["image_url"] },
  { table: "isopedia_submissions", columns: ["image_url"] },
  { table: "isopedia_guide_images", columns: ["image_url"] },
  { table: "isopedia_suggested_edits", columns: ["current_value", "proposed_value"] },
];

type ImageSource = {
  table: string;
  columns: string[];
};

function cleanLimit(value: FormDataEntryValue | null) {
  const limit = Number(value || 10);
  if (!Number.isFinite(limit)) return 10;
  return Math.min(25, Math.max(1, Math.round(limit)));
}

function storagePathFromPublicUrl(url: string, supabaseUrl: string) {
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

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const [{ data: adminProfile }, { data: roleProfile }] = await Promise.all([
    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle(),
  ]);

  if (!adminProfile && roleProfile?.role !== "admin") {
    redirect("/admin/login");
  }
}

async function collectImagePaths(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  supabaseUrl: string,
  source: ImageSource
) {
  const { data, error } = await supabase
    .from(source.table)
    .select(source.columns.join(","));

  if (error) {
    throw new Error(`Could not read ${source.table}: ${error.message}`);
  }

  const paths = new Set<string>();

  for (const row of (data || []) as unknown[]) {
    const values = row as Record<string, unknown>;

    for (const column of source.columns) {
      const storagePath = storagePathFromPublicUrl(String(values[column] || ""), supabaseUrl);
      if (storagePath) paths.add(storagePath);
    }
  }

  return paths;
}

async function collectAllImagePaths(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");

  const allPaths = new Set<string>();

  for (const source of IMAGE_SOURCES) {
    const sourcePaths = await collectImagePaths(supabase, supabaseUrl, source);
    sourcePaths.forEach((path) => allPaths.add(path));
  }

  return [...allPaths].sort();
}

function isAlreadyWatermarked(info: unknown) {
  const metadata = (info as { metadata?: Record<string, unknown> | null })?.metadata;
  return (
    metadata?.isopediaWatermarked === "true" ||
    metadata?.isopediaWatermarked === true
  );
}

export async function watermarkExistingIsopediaImages(formData: FormData) {
  await requireAdmin();

  const limit = cleanLimit(formData.get("limit"));
  const supabase = createSupabaseAdminClient();
  const paths = await collectAllImagePaths(supabase);
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const storagePath of paths) {
    if (processed >= limit) break;

    const { data: info } = await supabase.storage.from(BUCKET).info(storagePath);
    if (isAlreadyWatermarked(info)) {
      skipped += 1;
      continue;
    }

    const { data: original, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(storagePath);

    if (downloadError || !original) {
      failed += 1;
      continue;
    }

    try {
      const watermarked = await watermarkImageBuffer(
        Buffer.from(await original.arrayBuffer())
      );

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, watermarked, {
          upsert: true,
          cacheControl: "3600",
          contentType: watermarkedImageContentType(),
          metadata: { isopediaWatermarked: "true" },
        });

      if (uploadError) {
        failed += 1;
        continue;
      }

      processed += 1;
    } catch {
      failed += 1;
    }
  }

  revalidatePath("/admin/isopedia/watermark-images");
  revalidatePath("/isopedia");

  const params = new URLSearchParams({
    processed: String(processed),
    skipped: String(skipped),
    failed: String(failed),
    limit: String(limit),
  });

  redirect(`/admin/isopedia/watermark-images?${params.toString()}`);
}
