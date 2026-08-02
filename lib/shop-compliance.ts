import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import type { ShopProduct } from "@/lib/shop";
import { isLiveProduct as categoryIsLiveProduct, normalizeState } from "@/lib/shop-shipping";

export type ProductAvailabilityStatus =
  | "available"
  | "unavailable"
  | "conditional"
  | "review_required";

export type ProductAvailability = {
  productId: string;
  isLive: boolean;
  taxonMappingStatus: "verified" | "provisional" | "unmapped" | "disputed";
  canonicalScientificName: string | null;
  availability: ProductAvailabilityStatus;
  publicReasonCode: string;
  publicMessage: string;
  internalDecisionId?: string;
  permitNumber?: string | null;
  applicationNumber?: string | null;
  expiresAt?: string | null;
};

export type CartComplianceResult = {
  stateCode: string;
  overall: "cleared" | "blocked" | "manual_review";
  items: ProductAvailability[];
  publicMessage: string;
};

type MappingRow = {
  regulated_taxon_id: string | null;
  mapping_status: ProductAvailability["taxonMappingStatus"];
  regulated_taxa?: {
    canonical_scientific_name: string | null;
  } | null;
};

type DecisionRow = {
  id: string;
  decision: string;
  effective_at: string | null;
  expires_at: string | null;
  summarized_reason: string | null;
  condition_text: string | null;
  condition_satisfied: boolean | null;
  manually_verified: boolean | null;
  regulatory_destinations?: {
    state_code: string | null;
    included: boolean | null;
    destination_status: string | null;
  } | null;
  regulatory_applications?: {
    application_number: string | null;
    permit_number: string | null;
    overall_status: string | null;
    expires_at: string | null;
    unresolved_conflict: boolean | null;
  } | null;
  regulated_taxa?: {
    canonical_scientific_name: string | null;
  } | null;
};

type SimpleAllowedStateRow = {
  state_code: string | null;
  allowed: boolean | null;
};

const NON_SHIPPING_STATES = new Set(["AK", "HI"]);

export function productRequiresCompliance(product: Pick<ShopProduct, "is_live" | "category" | "compliance_exempt">) {
  if (product.compliance_exempt) return false;
  return Boolean(product.is_live) || categoryIsLiveProduct(product);
}

export async function getProductAvailability({
  product,
  stateCode,
  proposedShipDate = new Date(),
  includeInternal = false,
}: {
  product: ShopProduct;
  stateCode: string;
  proposedShipDate?: Date;
  includeInternal?: boolean;
}): Promise<ProductAvailability> {
  const normalizedState = normalizeState(stateCode);
  const isLive = productRequiresCompliance(product);
  const mappingStatus = normalizeMappingStatus(product.taxon_mapping_status);

  if (!isLive) {
    return {
      productId: String(product.id),
      isLive: false,
      taxonMappingStatus: mappingStatus,
      canonicalScientificName: null,
      availability: "available",
      publicReasonCode: "non_live",
      publicMessage: "Non-live products are not affected by live-animal shipping restrictions.",
    };
  }

  if (!normalizedState) {
    return blocked(product, mappingStatus, "state_required", "Select a destination state to check live-shipping eligibility.");
  }

  if (NON_SHIPPING_STATES.has(normalizedState)) {
    return blocked(
      product,
      mappingStatus,
      "live_shipping_not_offered",
      "Live shipping is not currently offered to this destination."
    );
  }

  const supabase = createSupabaseAdminClient();
  const simpleAllowedState = await findSimpleAllowedState(supabase, {
    productId: Number(product.id),
    stateCode: normalizedState,
  });

  if (simpleAllowedState.configured && simpleAllowedState.allowed) {
    return {
      productId: String(product.id),
      isLive: true,
      taxonMappingStatus: mappingStatus,
      canonicalScientificName: null,
      availability: "available",
      publicReasonCode: "simple_state_allowed",
      publicMessage: `Eligible for shipping to ${normalizedState}.`,
    };
  }

  if (simpleAllowedState.configured) {
    return blocked(
      product,
      mappingStatus,
      "simple_state_not_allowed",
      "Contact for possible local pickup."
    );
  }

  const mapping = await findVerifiedMapping(supabase, product);

  if (!mapping?.regulated_taxon_id || mapping.mapping_status !== "verified") {
    return blocked(
      product,
      mapping?.mapping_status || mappingStatus,
      "taxon_mapping_unverified",
      "Contact for possible local pickup."
    );
  }

  const canonicalScientificName =
    mapping.regulated_taxa?.canonical_scientific_name || null;
  const decisions = await findDecisions(supabase, {
    regulatedTaxonId: mapping.regulated_taxon_id,
    stateCode: normalizedState,
  });
  const activeDecision = selectControllingDecision(decisions, proposedShipDate);

  if (!activeDecision) {
    return {
      productId: String(product.id),
      isLive: true,
      taxonMappingStatus: "verified",
      canonicalScientificName,
      availability: "unavailable",
      publicReasonCode: "no_verified_authorization",
      publicMessage: "Contact for possible local pickup.",
    };
  }

  const application = activeDecision.regulatory_applications;
  const base = {
    productId: String(product.id),
    isLive: true,
    taxonMappingStatus: "verified" as const,
    canonicalScientificName,
    permitNumber: application?.permit_number || null,
    applicationNumber: application?.application_number || null,
    expiresAt: activeDecision.expires_at || application?.expires_at || null,
    ...(includeInternal ? { internalDecisionId: activeDecision.id } : {}),
  };

  if (activeDecision.decision === "authorized") {
    return {
      ...base,
      availability: "available",
      publicReasonCode: "authorized",
      publicMessage: `Eligible for shipping to ${normalizedState}.`,
    };
  }

  if (activeDecision.decision === "conditional" && activeDecision.condition_satisfied) {
    return {
      ...base,
      availability: "available",
      publicReasonCode: "condition_satisfied",
      publicMessage: `Eligible for shipping to ${normalizedState}.`,
    };
  }

  if (activeDecision.decision === "conditional") {
    return {
      ...base,
      availability: "conditional",
      publicReasonCode: "condition_unsatisfied",
      publicMessage: "This item requires additional regulatory verification before it can be shipped to your state.",
    };
  }

  return {
    ...base,
    availability: "unavailable",
    publicReasonCode: `decision_${activeDecision.decision}`,
    publicMessage: "Contact for possible local pickup.",
  };
}

export async function getCartCompliance({
  products,
  stateCode,
  proposedShipDate = new Date(),
  includeInternal = false,
}: {
  products: ShopProduct[];
  stateCode: string;
  proposedShipDate?: Date;
  includeInternal?: boolean;
}): Promise<CartComplianceResult> {
  const normalizedState = normalizeState(stateCode);
  const items = await Promise.all(
    products.map((product) =>
      getProductAvailability({
        product,
        stateCode: normalizedState,
        proposedShipDate,
        includeInternal,
      })
    )
  );
  const liveResults = items.filter((item) => item.isLive);
  const blockedItems = liveResults.filter((item) => item.availability === "unavailable");
  const reviewItems = liveResults.filter((item) => item.availability === "conditional" || item.availability === "review_required");
  const overall =
    blockedItems.length > 0
      ? "blocked"
      : reviewItems.length > 0
        ? "manual_review"
        : "cleared";

  return {
    stateCode: normalizedState,
    overall,
    items,
    publicMessage:
      overall === "cleared"
        ? "All live items currently pass the destination-state shipping check."
        : "One or more live items cannot be shipped to the selected state yet.",
  };
}

function normalizeMappingStatus(value: unknown): ProductAvailability["taxonMappingStatus"] {
  return value === "verified" || value === "provisional" || value === "disputed"
    ? value
    : "unmapped";
}

function blocked(
  product: ShopProduct,
  taxonMappingStatus: ProductAvailability["taxonMappingStatus"],
  publicReasonCode: string,
  publicMessage: string
): ProductAvailability {
  return {
    productId: String(product.id),
    isLive: true,
    taxonMappingStatus,
    canonicalScientificName: null,
    availability: "unavailable",
    publicReasonCode,
    publicMessage,
  };
}

async function findSimpleAllowedState(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: { productId: number; stateCode: string }
) {
  const { data } = await supabase
    .from("live_product_allowed_states")
    .select("state_code,allowed")
    .eq("product_id", input.productId)
    .returns<SimpleAllowedStateRow[]>();

  const rows = data || [];
  return {
    configured: rows.length > 0,
    allowed: rows.some((row) => row.state_code === input.stateCode && row.allowed),
  };
}

async function findVerifiedMapping(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  product: ShopProduct
) {
  const { data } = await supabase
    .from("product_taxon_mappings")
    .select("regulated_taxon_id,mapping_status,regulated_taxa(canonical_scientific_name)")
    .eq("product_id", Number(product.id))
    .eq("active", true)
    .maybeSingle<MappingRow>();

  if (data) return data;

  if (product.regulated_taxon_id && product.taxon_mapping_status === "verified") {
    const { data: taxon } = await supabase
      .from("regulated_taxa")
      .select("canonical_scientific_name")
      .eq("id", product.regulated_taxon_id)
      .maybeSingle<{ canonical_scientific_name: string | null }>();

    return {
      regulated_taxon_id: product.regulated_taxon_id,
      mapping_status: "verified" as const,
      regulated_taxa: taxon || null,
    };
  }

  return null;
}

async function findDecisions(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: { regulatedTaxonId: string; stateCode: string }
) {
  const { data } = await supabase
    .from("regulatory_decisions")
    .select(
      "id,decision,effective_at,expires_at,summarized_reason,condition_text,condition_satisfied,manually_verified,regulatory_destinations!inner(state_code,included,destination_status),regulatory_applications!inner(application_number,permit_number,overall_status,expires_at,unresolved_conflict),regulated_taxa(canonical_scientific_name)"
    )
    .eq("regulated_taxon_id", input.regulatedTaxonId)
    .eq("regulatory_destinations.state_code", input.stateCode)
    .eq("regulatory_destinations.included", true)
    .returns<DecisionRow[]>();

  return data || [];
}

function selectControllingDecision(decisions: DecisionRow[], proposedShipDate: Date) {
  const shipTime = startOfDay(proposedShipDate).getTime();

  const candidates = decisions.filter((decision) => {
    const application = decision.regulatory_applications;
    if (!decision.manually_verified) return false;
    if (application?.unresolved_conflict) return false;
    if (!["approved", "partial_approval"].includes(application?.overall_status || "")) return false;
    if (decision.effective_at && startOfDay(new Date(decision.effective_at)).getTime() > shipTime) return false;
    if (decision.expires_at && startOfDay(new Date(decision.expires_at)).getTime() < shipTime) return false;
    if (application?.expires_at && startOfDay(new Date(application.expires_at)).getTime() < shipTime) return false;
    return true;
  });

  const priority = [
    "revoked",
    "expired",
    "denied",
    "pending_clarification",
    "conditional",
    "authorized",
    "pending",
    "not_listed",
    "not_requested",
  ];

  return candidates.sort((left, right) => {
    const leftPriority = priority.indexOf(left.decision);
    const rightPriority = priority.indexOf(right.decision);
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return String(right.effective_at || "").localeCompare(String(left.effective_at || ""));
  })[0] || null;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
