"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";

const BUCKET = "isopedia-images";
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

const IMAGE_SOURCES = [
  { table: "isopedia_species", columns: ["image_url"] },
  { table: "isopedia_species_images", columns: ["image_url"] },
  { table: "isopedia_submissions", columns: ["image_url"] },
  { table: "isopedia_guide_images", columns: ["image_url"] },
  { table: "isopedia_suggested_edits", columns: ["current_value", "proposed_value"] },
];

type ImageReference = {
  table: string;
  id: string;
  column: string;
  value: string;
};

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

function cacheBustedUrl(url: string, marker: string) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("wm", marker);
    return parsed.toString();
  } catch {
    return url;
  }
}

async function collectReferencesForPath(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  storagePath: string,
  supabaseUrl: string
) {
  const refs: ImageReference[] = [];

  for (const source of IMAGE_SOURCES) {
    const { data, error } = await supabase
      .from(source.table)
      .select(["id", ...source.columns].join(","));

    if (error) throw new Error(`Could not read ${source.table}: ${error.message}`);

    for (const row of (data || []) as unknown[]) {
      const values = row as Record<string, unknown>;
      const id = String(values.id || "");
      if (!id) continue;

      for (const column of source.columns) {
        const value = String(values[column] || "");
        if (storagePathFromPublicUrl(value, supabaseUrl) !== storagePath) continue;

        refs.push({ table: source.table, id, column, value });
      }
    }
  }

  return refs;
}

async function refreshReferences(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  refs: ImageReference[],
  marker: string
) {
  for (const ref of refs) {
    const nextValue = cacheBustedUrl(ref.value, marker);
    if (nextValue === ref.value) continue;

    await supabase
      .from(ref.table)
      .update({ [ref.column]: nextValue })
      .eq("id", ref.id)
      .eq(ref.column, ref.value);
  }
}

export async function repairWatermarkedImage(formData: FormData) {
  await requireContentAgentAdmin();

  const imageUrl = String(formData.get("image_url") || "").trim();
  const file = formData.get("replacement_image");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    redirect("/admin/isopedia/repair-image?error=missing-supabase-url");
  }

  const storagePath = storagePathFromPublicUrl(imageUrl, supabaseUrl);
  if (!storagePath) {
    redirect("/admin/isopedia/repair-image?error=invalid-image-url");
  }

  if (!(file instanceof File) || file.size === 0) {
    redirect("/admin/isopedia/repair-image?error=missing-file");
  }

  if (!file.type.startsWith("image/")) {
    redirect("/admin/isopedia/repair-image?error=invalid-file-type");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    redirect("/admin/isopedia/repair-image?error=file-too-large");
  }

  const supabase = createSupabaseAdminClient();
  const refs = await collectReferencesForPath(supabase, storagePath, supabaseUrl);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type || "image/jpeg",
    });

  if (uploadError) {
    redirect(
      `/admin/isopedia/repair-image?error=${encodeURIComponent(uploadError.message)}`
    );
  }

  await refreshReferences(supabase, refs, Date.now().toString());

  revalidatePath("/admin/isopedia/repair-image");
  revalidatePath("/admin/isopedia");
  revalidatePath("/isopedia");

  redirect(
    `/admin/isopedia/repair-image?repaired=true&refs=${refs.length.toString()}`
  );
}
