"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import {
  INITIAL_PERMIT_SUPPORT_DOC,
  PERMIT_FILE_BUCKET,
  type PermitStatus,
  normalizeStateCode,
} from "@/lib/permit-tracker";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { slugifyProductName } from "@/lib/shop";

const PERMIT_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const PERMIT_FILE_MAX_BYTES = 20 * 1024 * 1024;

export async function createPermitSpeciesAction(formData: FormData) {
  await requireAdmin();

  try {
    const payload = speciesPayload(formData);
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("permit_species").insert(payload);
    if (error) throw new Error(error.message);
  } catch (error) {
    redirectPermitTrackerWithError(error);
  }

  redirectPermitTrackerWithNotice("Species added to permit tracker.");
}

export async function updatePermitSpeciesAction(formData: FormData) {
  await requireAdmin();

  try {
    const id = String(formData.get("species_id") || "");
    if (!id) throw new Error("Missing species id.");

    const payload = speciesPayload(formData);
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("permit_species")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw new Error(error.message);
  } catch (error) {
    redirectPermitTrackerWithError(error);
  }

  redirectPermitTrackerWithNotice("Species details saved.");
}

export async function upsertPermitStateRecordAction(formData: FormData) {
  await requireAdmin();

  let speciesId = "";
  let stateCode = "";

  try {
    speciesId = String(formData.get("species_id") || "");
    stateCode = normalizeStateCode(formData.get("state_code"));
    if (!speciesId) throw new Error("Missing species id.");
    if (!stateCode) throw new Error("Choose a state.");

    const status = String(formData.get("status") || "not_submitted") as PermitStatus;
    const supabase = createSupabaseAdminClient();
    const current = await getCurrentStateRecord(supabase, speciesId, stateCode);
    const applicationUpload = await permitFileFromFormData(
      supabase,
      formData.get("application_file"),
      speciesId,
      stateCode,
      "application"
    );
    const permitUpload = await permitFileFromFormData(
      supabase,
      formData.get("permit_file"),
      speciesId,
      stateCode,
      "issued-permit"
    );

    const payload = {
      species_id: speciesId,
      state_code: stateCode,
      status,
      application_submitted_at: cleanDate(formData.get("application_submitted_at")),
      permit_issued_at: cleanDate(formData.get("permit_issued_at")),
      permit_expires_at: cleanDate(formData.get("permit_expires_at")),
      permit_number: cleanText(formData.get("permit_number")),
      notes: cleanText(formData.get("notes")),
      application_storage_path:
        applicationUpload?.storagePath || current?.application_storage_path || null,
      application_file_name:
        applicationUpload?.fileName || current?.application_file_name || null,
      permit_storage_path: permitUpload?.storagePath || current?.permit_storage_path || null,
      permit_file_name: permitUpload?.fileName || current?.permit_file_name || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("permit_state_records")
      .upsert(payload, { onConflict: "species_id,state_code" })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    const logNote = cleanText(formData.get("log_note"));
    const logRows = [];
    if (logNote) {
      logRows.push({
        state_record_id: data.id,
        log_type: String(formData.get("log_type") || "note"),
        note: logNote,
      });
    }
    if (applicationUpload) {
      logRows.push({
        state_record_id: data.id,
        log_type: "file",
        note: `Uploaded submitted application copy: ${applicationUpload.fileName}`,
        file_storage_path: applicationUpload.storagePath,
        file_name: applicationUpload.fileName,
      });
    }
    if (permitUpload) {
      logRows.push({
        state_record_id: data.id,
        log_type: "file",
        note: `Uploaded issued permit copy: ${permitUpload.fileName}`,
        file_storage_path: permitUpload.storagePath,
        file_name: permitUpload.fileName,
      });
    }

    if (logRows.length > 0) {
      const { error: logError } = await supabase.from("permit_state_logs").insert(logRows);
      if (logError) throw new Error(logError.message);
    }
  } catch (error) {
    redirectPermitTrackerWithError(error, speciesId, stateCode);
  }

  redirectPermitTrackerWithNotice("State permit record saved.", speciesId, stateCode);
}

export async function createPermitDraftAction(formData: FormData) {
  await requireAdmin();

  let speciesId = "";
  let stateCode = "";

  try {
    speciesId = String(formData.get("species_id") || "");
    stateCode = normalizeStateCode(formData.get("state_code"));
    if (!speciesId) throw new Error("Missing species id.");
    if (!stateCode) throw new Error("Choose a state.");

    const supabase = createSupabaseAdminClient();
    const { data: species, error: speciesError } = await supabase
      .from("permit_species")
      .select("*")
      .eq("id", speciesId)
      .maybeSingle();

    if (speciesError) throw new Error(speciesError.message);
    if (!species) throw new Error("Species was not found.");

    const draft = buildPermitDraft(species, stateCode);
    const { data: record, error } = await supabase
      .from("permit_state_records")
      .upsert(
        {
          species_id: speciesId,
          state_code: stateCode,
          status: "drafting",
          notes: draft,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "species_id,state_code" }
      )
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    const { error: logError } = await supabase.from("permit_state_logs").insert({
      state_record_id: record.id,
      log_type: "note",
      note: `Draft application package generated.\n\n${draft}`,
    });

    if (logError) throw new Error(logError.message);
  } catch (error) {
    redirectPermitTrackerWithError(error, speciesId, stateCode);
  }

  redirectPermitTrackerWithNotice("Permit draft generated.", speciesId, stateCode);
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

function speciesPayload(formData: FormData) {
  const commonName = cleanText(formData.get("common_name"));
  if (!commonName) throw new Error("Common name is required.");

  const shopSlug = cleanText(formData.get("shop_slug")) || slugifyProductName(commonName);

  return {
    shop_slug: shopSlug,
    common_name: commonName,
    scientific_name: cleanText(formData.get("scientific_name")),
    category: cleanText(formData.get("category")) || "Isopods",
    morph_name: cleanText(formData.get("morph_name")),
    taxonomy_notes: cleanText(formData.get("taxonomy_notes")),
    source_notes: cleanText(formData.get("source_notes")),
    intended_use: cleanText(formData.get("intended_use")) || "Cleanup crew and pets",
    active: formData.get("active") === "on",
    priority: Math.max(0, Math.floor(Number(formData.get("priority") || 100))),
  };
}

async function getCurrentStateRecord(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  speciesId: string,
  stateCode: string
) {
  const { data, error } = await supabase
    .from("permit_state_records")
    .select("application_storage_path,application_file_name,permit_storage_path,permit_file_name")
    .eq("species_id", speciesId)
    .eq("state_code", stateCode)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function permitFileFromFormData(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  entry: FormDataEntryValue | null,
  speciesId: string,
  stateCode: string,
  kind: string
) {
  if (!(entry instanceof File) || entry.size === 0) return null;
  if (!PERMIT_FILE_TYPES.includes(entry.type)) {
    throw new Error("Permit files must be PDF, JPG, PNG, WEBP, DOC, or DOCX.");
  }
  if (entry.size > PERMIT_FILE_MAX_BYTES) {
    throw new Error("Permit files must be smaller than 20MB.");
  }

  await ensurePermitFileBucket(supabase);

  const extension = getFileExtension(entry.name);
  const fileSlug = slugifyProductName(entry.name.replace(/\.[^.]+$/, "")) || kind;
  const storagePath = `${speciesId}/${stateCode}/${Date.now()}-${kind}-${fileSlug}.${extension}`;
  const { error } = await supabase.storage
    .from(PERMIT_FILE_BUCKET)
    .upload(storagePath, entry, {
      cacheControl: "3600",
      upsert: false,
      contentType: entry.type,
    });

  if (error) throw new Error(error.message);
  return { storagePath, fileName: entry.name };
}

async function ensurePermitFileBucket(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await supabase.storage.getBucket(PERMIT_FILE_BUCKET);
  if (data) return;

  const { error } = await supabase.storage.createBucket(PERMIT_FILE_BUCKET, {
    public: false,
    fileSizeLimit: PERMIT_FILE_MAX_BYTES,
    allowedMimeTypes: PERMIT_FILE_TYPES,
  });

  if (error && !error.message.toLowerCase().includes("already exists")) {
    throw new Error(error.message);
  }
}

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim() || null;
}

function cleanDate(value: FormDataEntryValue | null) {
  const clean = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : null;
}

function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() || "pdf";
  return extension.replace(/[^a-z0-9]/g, "") || "pdf";
}

function buildPermitDraft(
  species: {
    common_name?: string | null;
    scientific_name?: string | null;
    category?: string | null;
    morph_name?: string | null;
    source_notes?: string | null;
    intended_use?: string | null;
    taxonomy_notes?: string | null;
  },
  stateCode: string
) {
  const organismName = [
    species.scientific_name || "[scientific name needed]",
    species.morph_name ? `(${species.morph_name})` : "",
    species.common_name ? `- ${species.common_name}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "PPQ 526 draft answer package",
    "",
    `Origin state: ${INITIAL_PERMIT_SUPPORT_DOC.originState}`,
    `Destination state: ${stateCode}`,
    `Organism: ${organismName}`,
    `Organism group: ${species.category || "Isopods/Springtails"}`,
    `Intended use: ${INITIAL_PERMIT_SUPPORT_DOC.intendedUse}`,
    `Maximum quantity per shipment: ${INITIAL_PERMIT_SUPPORT_DOC.maximumQuantityPerShipment}`,
    `Estimated shipment frequency: ${INITIAL_PERMIT_SUPPORT_DOC.estimatedShipmentFrequency}`,
    `Life stage: ${INITIAL_PERMIT_SUPPORT_DOC.lifeStage}`,
    INITIAL_PERMIT_SUPPORT_DOC.domesticMovement,
    "",
    "Purpose of movement:",
    "Interstate shipment of captive-bred/cultured live invertebrates for contained indoor vivarium/terrarium use as detritivore cleanup crew organisms and pets. Organisms are not intended for outdoor release, environmental release, agricultural release, field release, research release, or biological-control release.",
    "",
    "Source of organisms:",
    species.source_notes || INITIAL_PERMIT_SUPPORT_DOC.source,
    "",
    "Shipment contents and packaging:",
    INITIAL_PERMIT_SUPPORT_DOC.shipping,
    "",
    "Containment at origin:",
    INITIAL_PERMIT_SUPPORT_DOC.containment,
    "",
    "Customer instructions, release prevention, and safe keeping:",
    INITIAL_PERMIT_SUPPORT_DOC.releasePrevention,
    "",
    "Disposal / escape response:",
    `${INITIAL_PERMIT_SUPPORT_DOC.disposal} ${INITIAL_PERMIT_SUPPORT_DOC.escapeResponse}`,
    "",
    "Soil / host material statement:",
    "No soil is shipped with live organisms. Shipments contain the organism, sphagnum moss, and carrot slice only.",
    "",
    "Taxonomy notes to resolve before final submission:",
    species.taxonomy_notes || "Confirm the scientific name and any APHIS-preferred naming before submitting.",
  ].join("\n");
}

function redirectPermitTrackerWithNotice(message: string, speciesId?: string, stateCode?: string): never {
  revalidatePath("/admin");
  revalidatePath("/admin/isotracker");
  redirect(`/admin/isotracker?notice=${encodeURIComponent(message)}${selectionQuery(speciesId, stateCode)}`);
}

function redirectPermitTrackerWithError(error: unknown, speciesId?: string, stateCode?: string): never {
  const message = error instanceof Error ? error.message : String(error);
  revalidatePath("/admin/isotracker");
  redirect(`/admin/isotracker?error=${encodeURIComponent(message.slice(0, 1400))}${selectionQuery(speciesId, stateCode)}`);
}

function selectionQuery(speciesId?: string, stateCode?: string) {
  const params = new URLSearchParams();
  if (speciesId) params.set("species", speciesId);
  if (stateCode) params.set("state", stateCode);
  const query = params.toString();
  return query ? `&${query}` : "";
}
