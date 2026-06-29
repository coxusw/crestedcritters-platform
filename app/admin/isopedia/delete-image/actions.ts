"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";

const BUCKET = "isopedia-images";

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

async function deleteReferences(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  refs: ImageReference[]
) {
  let cleared = 0;
  let deleted = 0;
  const deletedRows = new Set<string>();

  for (const ref of refs) {
    if (ref.table === "isopedia_species_images" || ref.table === "isopedia_guide_images") {
      const key = `${ref.table}:${ref.id}`;
      if (deletedRows.has(key)) continue;

      const { error } = await supabase.from(ref.table).delete().eq("id", ref.id);
      if (error) throw new Error(error.message);

      deletedRows.add(key);
      deleted += 1;
      continue;
    }

    const { error } = await supabase
      .from(ref.table)
      .update({ [ref.column]: null })
      .eq("id", ref.id)
      .eq(ref.column, ref.value);

    if (error) throw new Error(error.message);
    cleared += 1;
  }

  return { cleared, deleted };
}

export async function deleteIsopediaImage(formData: FormData) {
  await requireContentAgentAdmin();

  const imageUrl = String(formData.get("image_url") || "").trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    redirect("/admin/isopedia/delete-image?error=missing-supabase-url");
  }

  const storagePath = storagePathFromPublicUrl(imageUrl, supabaseUrl);
  if (!storagePath) {
    redirect("/admin/isopedia/delete-image?error=invalid-image-url");
  }

  const supabase = createSupabaseAdminClient();
  const refs = await collectReferencesForPath(supabase, storagePath, supabaseUrl);

  try {
    const { cleared, deleted } = await deleteReferences(supabase, refs);
    const { error: removeError } = await supabase.storage
      .from(BUCKET)
      .remove([storagePath]);

    if (removeError) throw new Error(removeError.message);

    revalidatePath("/admin/isopedia/delete-image");
    revalidatePath("/admin/isopedia");
    revalidatePath("/isopedia");

    redirect(
      `/admin/isopedia/delete-image?deleted=true&refs=${refs.length.toString()}&cleared=${cleared.toString()}&rows=${deleted.toString()}`
    );
  } catch (error) {
    redirect(
      `/admin/isopedia/delete-image?error=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`
    );
  }
}
