"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { raffleSlug } from "@/lib/isopedia-raffles";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const bucket = "isopedia-raffles";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const [{ data: adminProfile }, { data: profile }] = await Promise.all([
    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: string | null }>(),
  ]);

  if (!adminProfile && profile?.role !== "admin" && profile?.role !== "moderator") {
    redirect("/admin/login");
  }
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function intValue(formData: FormData, key: string, fallback: number) {
  const value = Math.floor(Number(formData.get(key) || fallback));
  return Number.isFinite(value) ? value : fallback;
}

function timestampValue(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;

  const date = parseAdminDate(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function parseAdminDate(value: string) {
  const trimmed = value.trim();
  const directDate = new Date(trimmed);
  if (!Number.isNaN(directDate.getTime())) return directDate;

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return new Date(Number.NaN);

  const [, month, day, year, rawHour, rawMinute = "0", meridiem] = match;
  let hour = Number(rawHour);

  if (meridiem?.toLowerCase() === "pm" && hour < 12) hour += 12;
  if (meridiem?.toLowerCase() === "am" && hour === 12) hour = 0;

  return new Date(Number(year), Number(month) - 1, Number(day), hour, Number(rawMinute));
}

async function uploadImage(file: FormDataEntryValue | null, slug: string) {
  if (!(file instanceof File) || file.size === 0) return null;
  const supabase = createSupabaseAdminClient();
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${slug}/${Date.now()}.${extension}`;

  await supabase.storage.createBucket(bucket, { public: true }).catch(() => {});
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/png",
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function rafflePayload(formData: FormData, imageUrl: string | null) {
  const title = text(formData, "title");
  if (!title) throw new Error("Title is required.");

  const slug = raffleSlug(text(formData, "slug") || title);
  if (!slug) throw new Error("Slug is required.");

  const maxEntriesRaw = text(formData, "max_entries");
  const maxEntries = maxEntriesRaw ? Math.max(1, intValue(formData, "max_entries", 1)) : null;

  return {
    title,
    slug,
    description: text(formData, "description") || null,
    rules: text(formData, "rules") || null,
    image_url: imageUrl || text(formData, "image_url") || null,
    prize_type: text(formData, "prize_type") || "physical",
    status: text(formData, "status") || "draft",
    entry_cost_isotokens: Math.max(0, intValue(formData, "entry_cost_isotokens", 10)),
    donation_cents_per_entry: Math.max(100, intValue(formData, "donation_cents_per_entry", 100)),
    allow_isotoken_entries: formData.get("allow_isotoken_entries") === "on",
    allow_donation_entries: formData.get("allow_donation_entries") === "on",
    allow_multiple_entries: formData.get("allow_multiple_entries") === "on",
    max_entries: maxEntries,
    starts_at: timestampValue(formData, "starts_at"),
    ends_at: timestampValue(formData, "ends_at"),
    results_url: text(formData, "results_url") || null,
    result_notes: text(formData, "result_notes") || null,
    updated_at: new Date().toISOString(),
  };
}

export async function saveRaffleAction(formData: FormData) {
  await requireAdmin();

  try {
    const id = text(formData, "raffle_id");
    const previewSlug = raffleSlug(text(formData, "slug") || text(formData, "title") || "raffle");
    const imageUrl = await uploadImage(formData.get("image_file"), previewSlug);
    const payload = rafflePayload(formData, imageUrl);
    const supabase = createSupabaseAdminClient();
    const query = id
      ? supabase.from("isopedia_raffles").update(payload).eq("id", id)
      : supabase.from("isopedia_raffles").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);
  } catch (error) {
    redirect(`/admin/isopedia/raffles?error=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
  }

  revalidatePath("/admin/isopedia/raffles");
  revalidatePath("/raffles");
  redirect("/admin/isopedia/raffles?saved=true");
}

export async function duplicateRaffleAction(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "raffle_id");
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("isopedia_raffles").select("*").eq("id", id).maybeSingle();

  if (error || !data) redirect("/admin/isopedia/raffles?error=template-not-found");

  const slug = `${raffleSlug(data.slug || data.title)}-${Date.now()}`;
  const { error: insertError } = await supabase.from("isopedia_raffles").insert({
    ...data,
    id: undefined,
    slug,
    status: "draft",
    winner_profile_id: null,
    winner_entry_id: null,
    results_url: null,
    result_notes: null,
    starts_at: null,
    ends_at: null,
    created_at: undefined,
    updated_at: new Date().toISOString(),
  });

  if (insertError) redirect(`/admin/isopedia/raffles?error=${encodeURIComponent(insertError.message)}`);
  revalidatePath("/admin/isopedia/raffles");
  redirect("/admin/isopedia/raffles?saved=true");
}
