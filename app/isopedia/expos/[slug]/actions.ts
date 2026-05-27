"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RsvpStatus = "attending" | "vending";

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

export async function setExpoRsvp(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const expoId = cleanText(formData.get("expo_id"));
  const expoSlug = cleanText(formData.get("expo_slug"));
  const status = cleanText(formData.get("status")) as RsvpStatus;

  if (!user) {
    redirect(`/login?next=/expos/${expoSlug}`);
  }

  if (!expoId || !expoSlug) {
    throw new Error("Missing expo.");
  }

  if (!["attending", "vending"].includes(status)) {
    throw new Error("Invalid RSVP status.");
  }

  const { error } = await supabase.from("isopedia_expo_rsvps").upsert(
    {
      expo_id: expoId,
      user_id: user.id,
      status,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "expo_id,user_id",
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/expos/${expoSlug}`);
}

export async function removeExpoRsvp(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const expoId = cleanText(formData.get("expo_id"));
  const expoSlug = cleanText(formData.get("expo_slug"));

  if (!user) {
    redirect(`/login?next=/expos/${expoSlug}`);
  }

  if (!expoId || !expoSlug) {
    throw new Error("Missing expo.");
  }

  const { error } = await supabase
    .from("isopedia_expo_rsvps")
    .delete()
    .eq("expo_id", expoId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/expos/${expoSlug}`);
}
