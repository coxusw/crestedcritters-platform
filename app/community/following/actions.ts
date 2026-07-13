"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function checked(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function speciesIdValue(formData: FormData) {
  const speciesId = Number(formData.get("species_id"));
  if (!Number.isFinite(speciesId)) {
    throw new Error("Missing species follow.");
  }
  return speciesId;
}

function revalidateFollowingPages() {
  revalidatePath("/community/following");
  revalidatePath("/isopedia/community/following");
}

function followingNoticePath(key: "saved" | "unfollowed" | "error", message?: string) {
  const params = new URLSearchParams();
  if (key === "error") {
    params.set("error", message || "Could not update species follow settings.");
  } else {
    params.set("saved", key);
  }
  return `/community/following?${params.toString()}`;
}

export async function updateSpeciesFollowPreferences(formData: FormData) {
  const speciesId = speciesIdValue(formData);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/community/following");

  const { error } = await supabase
    .from("species_follows")
    .update({
      notify_discussions: checked(formData.get("notify_discussions")),
      notify_guides: checked(formData.get("notify_guides")),
      notify_marketplace: checked(formData.get("notify_marketplace")),
      notify_photos: checked(formData.get("notify_photos")),
    })
    .eq("species_id", speciesId)
    .eq("profile_id", user.id);

  if (error) redirect(followingNoticePath("error", error.message));

  revalidateFollowingPages();
  redirect(followingNoticePath("saved"));
}

export async function unfollowSpeciesFromCommunity(formData: FormData) {
  const speciesId = speciesIdValue(formData);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/community/following");

  const { error } = await supabase
    .from("species_follows")
    .delete()
    .eq("species_id", speciesId)
    .eq("profile_id", user.id);

  if (error) redirect(followingNoticePath("error", error.message));

  revalidateFollowingPages();
  redirect(followingNoticePath("unfollowed"));
}
