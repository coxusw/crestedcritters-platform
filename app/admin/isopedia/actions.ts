"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "../../../lib/supabase-server";
import {
  watermarkImageBuffer,
  watermarkedImageContentType,
} from "@/lib/isopedia-image-watermark";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text.length ? text : null;
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/admin/login");

  return supabase;
}

async function uploadSpeciesImage(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  file: File | null,
  slug: string
) {
  if (!file || file.size === 0) return null;

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Image must be JPG, PNG, WEBP, or GIF.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be smaller than 5MB.");
  }

  const extension = "jpg";
  const filePath = `${slug}/${Date.now()}.${extension}`;
  const watermarkedImage = await watermarkImageBuffer(
    Buffer.from(await file.arrayBuffer())
  );

  const { error: uploadError } = await supabase.storage
    .from("isopedia-images")
    .upload(filePath, watermarkedImage, {
      cacheControl: "3600",
      upsert: false,
      contentType: watermarkedImageContentType(),
      metadata: { isopediaWatermarked: "true" },
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage
    .from("isopedia-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

function buildPayload(formData: FormData, imageUrl: string | null, slug: string) {
  return {
    organism_type: cleanText(formData.get("organism_type")) || "Isopod",
    genus: cleanText(formData.get("genus")),
    species: cleanText(formData.get("species")),
    morph: cleanText(formData.get("morph")),
    trade_names: cleanText(formData.get("trade_names")),

    common_name: String(formData.get("common_name") || "").trim(),
    scientific_name: cleanText(formData.get("scientific_name")),
    slug,
    difficulty: cleanText(formData.get("difficulty")),
    origin: cleanText(formData.get("origin")),
    temperature: cleanText(formData.get("temperature")),
    humidity: cleanText(formData.get("humidity")),
    diet: cleanText(formData.get("diet")),
    substrate: cleanText(formData.get("substrate")),
    notes: cleanText(formData.get("notes")),
    image_url: imageUrl,
    updated_at: new Date().toISOString(),
  };
}

export async function createSpecies(formData: FormData) {
  const supabase = await requireAdmin();

  const commonName = String(formData.get("common_name") || "").trim();
  const slugInput = String(formData.get("slug") || "").trim();

  if (!commonName) {
    throw new Error("Common name is required.");
  }

  const genus = cleanText(formData.get("genus"));
  const species = cleanText(formData.get("species"));
  const morph = cleanText(formData.get("morph"));

  const slugBase = [genus, species, morph, commonName]
    .filter(Boolean)
    .join(" ");

  const slug = slugInput ? slugify(slugInput) : slugify(slugBase || commonName);

  const uploadedFile = formData.get("image_file");
  const uploadedImageUrl =
    uploadedFile instanceof File
      ? await uploadSpeciesImage(supabase, uploadedFile, slug)
      : null;

  const manualImageUrl = cleanText(formData.get("image_url"));
  const payload = buildPayload(
    formData,
    uploadedImageUrl || manualImageUrl,
    slug
  );

  const { error } = await supabase.from("isopedia_species").insert(payload);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/isopedia");
  revalidatePath(`/isopedia/${slug}`);

  redirect("/admin/isopedia");
}

export async function updateSpecies(
  id: string,
  oldSlug: string,
  formData: FormData
) {
  const supabase = await requireAdmin();

  const commonName = String(formData.get("common_name") || "").trim();
  const slugInput = String(formData.get("slug") || "").trim();

  if (!commonName) {
    throw new Error("Common name is required.");
  }

  const genus = cleanText(formData.get("genus"));
  const species = cleanText(formData.get("species"));
  const morph = cleanText(formData.get("morph"));

  const slugBase = [genus, species, morph, commonName]
    .filter(Boolean)
    .join(" ");

  const slug = slugInput ? slugify(slugInput) : slugify(slugBase || commonName);

  const uploadedFile = formData.get("image_file");
  const uploadedImageUrl =
    uploadedFile instanceof File
      ? await uploadSpeciesImage(supabase, uploadedFile, slug)
      : null;

  const manualImageUrl = cleanText(formData.get("image_url"));
  const payload = buildPayload(
    formData,
    uploadedImageUrl || manualImageUrl,
    slug
  );

  const { error } = await supabase
    .from("isopedia_species")
    .update(payload)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/isopedia");
  revalidatePath(`/isopedia/${oldSlug}`);
  revalidatePath(`/isopedia/${slug}`);

  redirect("/admin/isopedia");
}

export async function deleteSpecies(id: string, slug: string) {
  const supabase = await requireAdmin();

  const { error } = await supabase
    .from("isopedia_species")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/isopedia");
  revalidatePath(`/isopedia/${slug}`);

  redirect("/admin/isopedia");
}
