"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const US_STATES = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
]);

const MAX_FLYER_SIZE_BYTES = 5 * 1024 * 1024;

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function addYears(date: Date, years: number) {
  const copy = new Date(date);
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
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

export async function submitExpo(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/isopedia/expos/submit");
  }

  const name = cleanText(formData.get("name"));
  const city = cleanText(formData.get("city"));
  const state = cleanText(formData.get("state")).toUpperCase();
  const venue = cleanText(formData.get("venue")) || null;
  const startsAtRaw = cleanText(formData.get("starts_at"));
  const endsAtRaw = cleanText(formData.get("ends_at"));
  const description = cleanText(formData.get("description")) || null;
  const flyerFile = formData.get("flyer_image");

  if (!name || name.length < 3) {
    throw new Error("Expo name is required.");
  }

  if (!city || city.length < 2) {
    throw new Error("City/town is required.");
  }

  if (!US_STATES.has(state)) {
    throw new Error("Please choose a valid US state.");
  }

  if (!startsAtRaw) {
    throw new Error("Start date and time are required.");
  }

  const startsAt = new Date(startsAtRaw);
  const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;
  const now = new Date();
  const maxFuture = addYears(now, 5);

  if (Number.isNaN(startsAt.getTime())) {
    throw new Error("Invalid start date.");
  }

  if (startsAt > maxFuture) {
    throw new Error("Expo date cannot be more than 5 years in the future.");
  }

  if (endsAt && Number.isNaN(endsAt.getTime())) {
    throw new Error("Invalid end date.");
  }

  if (endsAt && endsAt < startsAt) {
    throw new Error("End date cannot be before the start date.");
  }

  const baseSlug = slugify(`${name}-${city}-${state}-${startsAt.getFullYear()}`);
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

  let flyerImageUrl: string | null = null;

  if (flyerFile instanceof File && flyerFile.size > 0) {
    if (!isValidImage(flyerFile)) {
      throw new Error("Flyer must be a JPG, PNG, or WEBP image.");
    }

    if (flyerFile.size > MAX_FLYER_SIZE_BYTES) {
      throw new Error("Flyer image must be 5MB or smaller.");
    }

    const extension = getFileExtension(flyerFile);
    const filePath = `${user.id}/${slug}-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("expo-flyers")
      .upload(filePath, flyerFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: flyerFile.type,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicUrlData } = supabase.storage
      .from("expo-flyers")
      .getPublicUrl(filePath);

    flyerImageUrl = publicUrlData.publicUrl;
  }

  const { error } = await supabase.from("isopedia_expos").insert({
    name,
    slug,
    city,
    state,
    venue,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt ? endsAt.toISOString() : null,
    description,
    flyer_image_url: flyerImageUrl,
    status: "pending",
    submitted_by: user.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/isopedia/expos");
  revalidatePath("/admin/isopedia/expos");

  redirect("/isopedia/expos?submitted=true");
}