"use server";

import { createHash, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const REGULATORY_PATH = "/admin/regulatory";
const DOCUMENT_BUCKET = "regulatory-documents";

export async function createRegulatoryApplicationAction(formData: FormData) {
  const userId = await requireAdminUserId();
  const supabase = createSupabaseAdminClient();
  const payload = {
    application_number: clean(formData.get("application_number"), 120),
    application_type: clean(formData.get("application_type"), 40) || "multi_state",
    submitted_at: dateOrNull(formData.get("submitted_at")),
    issued_at: dateOrNull(formData.get("issued_at")),
    expires_at: dateOrNull(formData.get("expires_at")),
    overall_status: clean(formData.get("overall_status"), 40) || "needs_review",
    issuing_authority: clean(formData.get("issuing_authority"), 180) || null,
    permit_number: clean(formData.get("permit_number"), 120) || null,
    applicant_name: clean(formData.get("applicant_name"), 180) || null,
    organization_name: clean(formData.get("organization_name"), 180) || "Crested Critters",
    origin_state: clean(formData.get("origin_state"), 2).toUpperCase() || "IN",
    internal_summary: clean(formData.get("internal_summary"), 4000) || null,
    unresolved_conflict: formData.get("unresolved_conflict") === "on",
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (!payload.application_number) {
    redirectWithError("Application number is required.");
  }

  const { error } = await supabase
    .from("regulatory_applications")
    .upsert(payload, { onConflict: "application_number" });

  if (error) redirectWithError(error.message);
  await audit(userId, "upsert", "regulatory_applications", null, payload);
  revalidateRegulatory();
  redirectWithNotice("Application saved.");
}

export async function createRegulatoryDestinationAction(formData: FormData) {
  const userId = await requireAdminUserId();
  const supabase = createSupabaseAdminClient();
  const applicationId = clean(formData.get("application_id"), 80);
  const stateCode = clean(formData.get("state_code"), 2).toUpperCase();
  const payload = {
    application_id: applicationId,
    state_code: stateCode,
    state_name: clean(formData.get("state_name"), 120) || stateCode,
    included: formData.get("included") !== "off",
    destination_status: clean(formData.get("destination_status"), 80) || "needs_review",
    notes: clean(formData.get("notes"), 3000) || null,
    updated_at: new Date().toISOString(),
  };

  if (!applicationId || !stateCode) {
    redirectWithError("Choose an application and state.");
  }

  const { error } = await supabase
    .from("regulatory_destinations")
    .upsert(payload, { onConflict: "application_id,state_code" });

  if (error) redirectWithError(error.message);
  await audit(userId, "upsert", "regulatory_destinations", null, payload);
  revalidateRegulatory();
  redirectWithNotice("Destination saved.");
}

export async function createProductTaxonMappingAction(formData: FormData) {
  const userId = await requireAdminUserId();
  const supabase = createSupabaseAdminClient();
  const productId = Number(clean(formData.get("product_id"), 40));
  const taxonId = clean(formData.get("regulated_taxon_id"), 80) || null;
  const mappingStatus = clean(formData.get("mapping_status"), 40) || "unmapped";
  const { data: product } = await supabase
    .from("shop_products")
    .select("name")
    .eq("id", productId)
    .maybeSingle<{ name: string }>();
  const payload = {
    product_id: productId,
    regulated_taxon_id: taxonId,
    customer_display_name: clean(formData.get("customer_display_name"), 180) || product?.name || "",
    morph_or_trade_name: clean(formData.get("morph_or_trade_name"), 180) || null,
    mapping_status: mappingStatus,
    verification_source: clean(formData.get("verification_source"), 300) || null,
    verified_by: mappingStatus === "verified" ? userId : null,
    verified_at: mappingStatus === "verified" ? new Date().toISOString() : null,
    notes: clean(formData.get("notes"), 3000) || null,
    active: true,
    updated_at: new Date().toISOString(),
  };

  if (!productId || !payload.customer_display_name) {
    redirectWithError("Choose a product.");
  }

  await supabase
    .from("product_taxon_mappings")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("product_id", productId)
    .eq("active", true);

  const { error } = await supabase.from("product_taxon_mappings").insert(payload);
  if (error) redirectWithError(error.message);

  const { error: productError } = await supabase
    .from("shop_products")
    .update({
      regulated_taxon_id: taxonId,
      taxon_mapping_status: mappingStatus,
      is_live: true,
      requires_live_shipping_method: true,
      compliance_exempt: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);

  if (productError) redirectWithError(productError.message);
  await audit(userId, "create", "product_taxon_mappings", null, payload);
  revalidateRegulatory();
  revalidatePath("/shop");
  redirectWithNotice("Product mapping saved.");
}

export async function createRegulatoryDecisionAction(formData: FormData) {
  const userId = await requireAdminUserId();
  const supabase = createSupabaseAdminClient();
  const payload = {
    application_id: clean(formData.get("application_id"), 80),
    destination_id: clean(formData.get("destination_id"), 80),
    regulated_taxon_id: clean(formData.get("regulated_taxon_id"), 80),
    decision: clean(formData.get("decision"), 80) || "pending",
    controlling_document_id: clean(formData.get("controlling_document_id"), 80) || null,
    effective_at: dateOrNull(formData.get("effective_at")),
    expires_at: dateOrNull(formData.get("expires_at")),
    summarized_reason: clean(formData.get("summarized_reason"), 2000) || null,
    condition_text: clean(formData.get("condition_text"), 3000) || null,
    condition_satisfied: formData.get("condition_satisfied") === "on",
    condition_satisfied_at: formData.get("condition_satisfied") === "on" ? new Date().toISOString() : null,
    manually_verified: formData.get("manually_verified") === "on",
    verified_by: formData.get("manually_verified") === "on" ? userId : null,
    verified_at: formData.get("manually_verified") === "on" ? new Date().toISOString() : null,
    notes: clean(formData.get("notes"), 3000) || null,
    updated_at: new Date().toISOString(),
  };

  if (!payload.application_id || !payload.destination_id || !payload.regulated_taxon_id) {
    redirectWithError("Choose an application, destination, and taxon.");
  }

  const { error } = await supabase
    .from("regulatory_decisions")
    .upsert(payload, { onConflict: "application_id,destination_id,regulated_taxon_id" });

  if (error) redirectWithError(error.message);
  await audit(userId, "upsert", "regulatory_decisions", null, payload);
  revalidateRegulatory();
  revalidatePath("/shop");
  redirectWithNotice("Decision saved.");
}

export async function uploadRegulatoryDocumentAction(formData: FormData) {
  const userId = await requireAdminUserId();
  const supabase = createSupabaseAdminClient();
  const file = formData.get("document_file");

  if (!(file instanceof File) || file.size === 0) {
    redirectWithError("Choose a document file.");
  }

  const applicationId = clean(formData.get("application_id"), 80) || null;
  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "pdf";
  const storagePath = `${applicationId || "unassigned"}/${Date.now()}-${randomUUID()}.${extension}`;

  const { data: duplicate } = await supabase
    .from("regulatory_documents")
    .select("id, original_filename, title")
    .eq("checksum", checksum)
    .maybeSingle<{ id: string; original_filename: string | null; title: string | null }>();

  if (duplicate) {
    redirectWithError(`Duplicate document detected: ${duplicate.original_filename || duplicate.title || duplicate.id}`);
  }

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) redirectWithError(uploadError.message);

  const payload = {
    application_id: applicationId,
    document_type: clean(formData.get("document_type"), 80) || "other",
    title: clean(formData.get("title"), 180) || file.name,
    storage_path: storagePath,
    original_filename: file.name,
    mime_type: file.type || null,
    issued_at: dateOrNull(formData.get("issued_at")),
    effective_at: dateOrNull(formData.get("effective_at")),
    expires_at: dateOrNull(formData.get("expires_at")),
    checksum,
    uploaded_by: userId,
    private: true,
    notes: clean(formData.get("notes"), 3000) || null,
  };

  const { error } = await supabase.from("regulatory_documents").insert(payload);
  if (error) redirectWithError(error.message);
  await audit(userId, "upload", "regulatory_documents", null, { ...payload, checksum: "sha256" });
  revalidateRegulatory();
  redirectWithNotice("Private document uploaded.");
}

async function requireAdminUserId() {
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
  return user.id;
}

async function audit(
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  afterData: unknown
) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("regulatory_audit_log").insert({
    actor_user_id: actorUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    after_data: afterData,
  });
}

function clean(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function dateOrNull(value: FormDataEntryValue | null) {
  const text = clean(value, 20);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function revalidateRegulatory() {
  revalidatePath(REGULATORY_PATH);
}

function redirectWithNotice(message: string): never {
  redirect(`${REGULATORY_PATH}?notice=${encodeURIComponent(message)}`);
}

function redirectWithError(message: string): never {
  redirect(`${REGULATORY_PATH}?error=${encodeURIComponent(message)}`);
}
