"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { STATE_NAME_BY_CODE, US_STATES, normalizeStateCode } from "@/lib/permit-tracker";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const permitTrackerPath = "/admin/isopedia/permit-tracker";

export async function addPermittedSpeciesAction(formData: FormData) {
  await requireAdmin();

  let stateCode = "";

  try {
    stateCode = normalizeStateCode(formData.get("state_code"));
    const commonName = cleanText(formData.get("common_name"));
    const scientificName = cleanText(formData.get("scientific_name"));
    const notes = cleanText(formData.get("notes"));

    if (!STATE_NAME_BY_CODE.has(stateCode)) throw new Error("Choose a valid state.");
    if (!commonName) throw new Error("Species name is required.");

    const supabase = createSupabaseAdminClient();
    const speciesId = await findOrCreatePermitSpecies(supabase, commonName, scientificName);

    const { error } = await supabase.from("permit_state_records").upsert(
      {
        species_id: speciesId,
        state_code: stateCode,
        status: "issued",
        permit_issued_at: new Date().toISOString().slice(0, 10),
        notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "species_id,state_code" }
    );

    if (error) throw new Error(error.message);
  } catch (error) {
    redirectWithMessage("error", error instanceof Error ? error.message : String(error), stateCode);
  }

  redirectWithMessage("notice", "Permitted species saved.", stateCode);
}

export async function removePermittedSpeciesAction(formData: FormData) {
  await requireAdmin();

  const recordId = String(formData.get("record_id") || "");
  const stateCode = normalizeStateCode(formData.get("state_code"));

  try {
    if (!recordId) throw new Error("Missing permit record.");

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("permit_state_records").delete().eq("id", recordId);
    if (error) throw new Error(error.message);
  } catch (error) {
    redirectWithMessage("error", error instanceof Error ? error.message : String(error), stateCode);
  }

  redirectWithMessage("notice", "Permitted species removed.", stateCode);
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: adminProfile } = await supabase
    .from("admin_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminProfile) redirect("/admin/login");
}

async function findOrCreatePermitSpecies(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  commonName: string,
  scientificName: string | null
) {
  const { data: existing, error: existingError } = await supabase
    .from("permit_species")
    .select("id, scientific_name")
    .ilike("common_name", commonName)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  if (existing?.id) {
    if (scientificName && !existing.scientific_name) {
      const { error } = await supabase
        .from("permit_species")
        .update({ scientific_name: scientificName, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    }

    return existing.id as string;
  }

  const { data: created, error } = await supabase
    .from("permit_species")
    .insert({
      common_name: commonName,
      scientific_name: scientificName,
      category: "Isopods",
      intended_use: "Cleanup crew and pets",
      active: true,
      priority: 100,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return created.id as string;
}

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim() || null;
}

function redirectWithMessage(kind: "notice" | "error", message: string, stateCode?: string): never {
  revalidatePath("/admin");
  revalidatePath("/admin/isopedia");
  revalidatePath(permitTrackerPath);

  const params = new URLSearchParams({ [kind]: message.slice(0, 700) });
  if (US_STATES.some(([code]) => code === stateCode)) params.set("state", stateCode || "");

  redirect(`${permitTrackerPath}?${params.toString()}`);
}
