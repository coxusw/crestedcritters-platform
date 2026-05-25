export type PermitSpecies = {
  id: string;
  shop_product_id: string | null;
  shop_slug: string | null;
  common_name: string;
  scientific_name: string | null;
  category: string;
  morph_name: string | null;
  taxonomy_notes: string | null;
  source_notes: string | null;
  intended_use: string;
  active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
};

export type PermitStatus =
  | "not_submitted"
  | "drafting"
  | "submitted"
  | "issued"
  | "denied"
  | "expired"
  | "not_allowed";

export type PermitStateRecord = {
  id: string;
  species_id: string;
  state_code: string;
  status: PermitStatus;
  application_submitted_at: string | null;
  permit_issued_at: string | null;
  permit_expires_at: string | null;
  permit_number: string | null;
  application_storage_path: string | null;
  application_file_name: string | null;
  permit_storage_path: string | null;
  permit_file_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PermitStateLog = {
  id: string;
  state_record_id: string;
  log_type: "note" | "call" | "email" | "submitted" | "issued" | "denied" | "file";
  note: string;
  file_storage_path: string | null;
  file_name: string | null;
  created_at: string;
};

export type PermitStateRecordWithLogs = PermitStateRecord & {
  logs: PermitStateLog[];
  applicationUrl?: string | null;
  permitUrl?: string | null;
};

export const PERMIT_FILE_BUCKET = "permit-records";

export const PERMIT_STATUSES: Array<{ value: PermitStatus; label: string }> = [
  { value: "not_submitted", label: "Not submitted" },
  { value: "drafting", label: "Drafting" },
  { value: "submitted", label: "Submitted" },
  { value: "issued", label: "Issued" },
  { value: "denied", label: "Denied" },
  { value: "expired", label: "Expired" },
  { value: "not_allowed", label: "Not allowed" },
];

export const US_STATES = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
  ["DC", "District of Columbia"],
] as const;

export const STATE_NAME_BY_CODE = new Map<string, string>(US_STATES.map(([code, name]) => [code, name]));

export const INITIAL_PERMIT_SUPPORT_DOC = {
  originState: "Indiana",
  intendedUse: "Cleanup crew and pets",
  source:
    "Captive-bred/cultured stock purchased from expo vendors. Exact original collection or breeder lineage is not documented.",
  shipping:
    "Animals are shipped in a 7 oz flip cup with sphagnum moss and a slice of carrot as food/moisture support. The cup is packed inside an insulated cardboard box with foam insulation inserts. No soil is included in live shipments.",
  containment:
    "Colonies are maintained in Sterilite bins with gasketed locking lids and stainless steel 200 mesh vents to reduce escape risk.",
  releasePrevention:
    "Customers are instructed not to release organisms outdoors and to keep cultures contained.",
  disposal:
    "Disposal practice is deep freeze at 0 degrees F for 48 hours, followed by high heat in a closed metal container to ensure no viable life remains.",
};

export function permitStatusLabel(status: string) {
  return PERMIT_STATUSES.find((item) => item.value === status)?.label || status;
}

export function normalizeStateCode(value: FormDataEntryValue | string | null) {
  return String(value || "").trim().toUpperCase();
}

export function formatPermitDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
