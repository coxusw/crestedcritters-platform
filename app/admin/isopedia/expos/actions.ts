"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const MAX_FLYER_SIZE_BYTES = 5 * 1024 * 1024;

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function getFileExtension(file: File) {
  const extensionFromName = file.name.split(".").pop()?.toLowerCase();

  if (extensionFromName) return extensionFromName;

  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";

  return "jpg";
}

function isValidImage(file: File) {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type);
}

async function requireModerator() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const [{ data: profile }, { data: adminProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role: string | null }>(),

    supabase
      .from("admin_profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const canModerate =
    Boolean(adminProfile) ||
    profile?.role === "admin" ||
    profile?.role === "moderator";

  if (!canModerate) redirect("/admin/isopedia");

  return { supabase, user };
}

export async function deleteExpo(formData: FormData) {
  const { supabase } = await requireModerator();

  const expoId = cleanText(formData.get("expo_id"));

  if (!expoId) throw new Error("Missing expo id.");

  const { error } = await supabase
    .from("isopedia_expos")
    .delete()
    .eq("id", expoId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/isopedia/expos");
  revalidatePath("/admin/isopedia");
  revalidatePath("/isopedia/expos");

  redirect("/admin/isopedia/expos?deleted=true");
}

export async function updateExpo(formData: FormData) {
  const { supabase, user } = await requireModerator();

  const expoId = cleanText(formData.get("expo_id"));
  const name = cleanText(formData.get("name"));
  const city = cleanText(formData.get("city"));
  const state = cleanText(formData.get("state")).toUpperCase();
  const venue = cleanText(formData.get("venue")) || null;
  const startsAtRaw = cleanText(formData.get("starts_at"));
  const endsAtRaw = cleanText(formData.get("ends_at"));
  const description = cleanText(formData.get("description")) || null;
  const status = cleanText(formData.get("status"));
  const removeFlyer = cleanText(formData.get("remove_flyer")) === "on";
  const currentFlyerUrl = cleanText(formData.get("current_flyer_url")) || null;
  const flyerFile = formData.get("flyer_image");

  if (!expoId) throw new Error("Missing expo id.");
  if (!name || name.length < 3) throw new Error("Expo name is required.");
  if (!city || city.length < 2) throw new Error("City/town is required.");

  if (!/^[A-Z]{2}$/.test(state)) {
    throw new Error("State must be a valid 2-letter abbreviation.");
  }

  if (!startsAtRaw) throw new Error("Start date/time is required.");

  if (!["pending", "approved", "rejected"].includes(status)) {
    throw new Error("Invalid expo status.");
  }

  const startsAt = new Date(startsAtRaw);
  const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;

  if (Number.isNaN(startsAt.getTime())) {
    throw new Error("Invalid start date.");
  }

  if (endsAt && Number.isNaN(endsAt.getTime())) {
    throw new Error("Invalid end date.");
  }

  if (endsAt && endsAt < startsAt) {
    throw new Error("End date cannot be before start date.");
  }

  let flyerImageUrl = removeFlyer ? null : currentFlyerUrl;

  if (flyerFile instanceof File && flyerFile.size > 0) {
    if (!isValidImage(flyerFile)) {
      throw new Error("Flyer must be a JPG, PNG, or WEBP image.");
    }

    if (flyerFile.size > MAX_FLYER_SIZE_BYTES) {
      throw new Error("Flyer image must be 5MB or smaller.");
    }

    const extension = getFileExtension(flyerFile);
    const filePath = `${user.id}/expo-${expoId}-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("expo-flyers")
      .upload(filePath, flyerFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: flyerFile.type,
      });

    if (uploadError) throw new Error(uploadError.message);

    const { data: publicUrlData } = supabase.storage
      .from("expo-flyers")
      .getPublicUrl(filePath);

    flyerImageUrl = publicUrlData.publicUrl;
  }

  const { error } = await supabase
    .from("isopedia_expos")
    .update({
      name,
      city,
      state,
      venue,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt ? endsAt.toISOString() : null,
      description,
      flyer_image_url: flyerImageUrl,
      status,
      reviewed_by: status === "pending" ? null : user.id,
      reviewed_at: status === "pending" ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", expoId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/isopedia/expos");
  revalidatePath(`/admin/isopedia/expos/${expoId}/edit`);
  revalidatePath("/admin/isopedia");
  revalidatePath("/isopedia/expos");

  redirect("/admin/isopedia/expos?updated=true");
}