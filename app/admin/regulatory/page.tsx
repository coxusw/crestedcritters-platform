import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { getCartCompliance } from "@/lib/shop-compliance";
import { US_STATES } from "@/lib/shop-shipping";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  createProductTaxonMappingAction,
  createRegulatoryApplicationAction,
  createRegulatoryDecisionAction,
  createRegulatoryDestinationAction,
  uploadRegulatoryDocumentAction,
} from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = {
  notice?: string;
  error?: string;
  check_state?: string;
  check_product_id?: string;
};

type Application = {
  id: string;
  application_number: string;
  application_type: string;
  overall_status: string;
  issuing_authority: string | null;
  permit_number: string | null;
  issued_at: string | null;
  expires_at: string | null;
  unresolved_conflict: boolean | null;
};

type Destination = {
  id: string;
  application_id: string;
  state_code: string;
  state_name: string;
  included: boolean | null;
  destination_status: string | null;
  regulatory_applications?: { application_number: string | null } | null;
};

type Taxon = {
  id: string;
  canonical_scientific_name: string;
  taxonomic_status: string;
};

type Product = {
  id: number | string;
  slug: string;
  name: string;
  category: string;
  is_live: boolean | null;
  taxon_mapping_status: string | null;
};

type Mapping = {
  id: string;
  product_id: number;
  mapping_status: string;
  morph_or_trade_name: string | null;
  customer_display_name: string;
  regulated_taxa?: { canonical_scientific_name: string | null } | null;
  shop_products?: { name: string | null; slug: string | null } | null;
};

type DocumentRow = {
  id: string;
  title: string;
  document_type: string;
  original_filename: string | null;
  uploaded_at: string;
  regulatory_applications?: { application_number: string | null } | null;
};

type Decision = {
  id: string;
  decision: string;
  manually_verified: boolean | null;
  condition_satisfied: boolean | null;
  expires_at: string | null;
  regulatory_destinations?: { state_code: string | null } | null;
  regulated_taxa?: { canonical_scientific_name: string | null } | null;
  regulatory_applications?: { application_number: string | null; permit_number: string | null } | null;
};

type Stat = {
  label: string;
  value: number | string;
  alert?: boolean;
};

type SelectOption = readonly [string, string];

const APPLICATION_TYPES = [
  ["multi_state", "Multi-state"],
  ["single_state", "Single state"],
  ["federal", "Federal"],
  ["state", "State"],
  ["other", "Other"],
] satisfies SelectOption[];

const APPLICATION_STATUSES = [
  ["needs_review", "Needs review"],
  ["pending", "Pending"],
  ["partial_approval", "Partial approval"],
  ["approved", "Approved"],
  ["denied", "Denied"],
  ["expired", "Expired"],
  ["revoked", "Revoked"],
  ["superseded", "Superseded"],
] satisfies SelectOption[];

const DESTINATION_STATUSES = [
  ["needs_review", "Needs review"],
  ["included", "Included"],
  ["not_requested", "Not requested"],
  ["denied", "Denied"],
  ["conditional", "Conditional"],
  ["expired", "Expired"],
] satisfies SelectOption[];

const DOCUMENT_TYPES = [
  ["permit", "Permit"],
  ["denial", "Denial"],
  ["amendment", "Amendment"],
  ["state_comment", "State comment"],
  ["correspondence", "Correspondence"],
  ["environmental_awareness_letter", "Environmental Awareness Letter"],
  ["identification_report", "Identification report"],
  ["other", "Other"],
] satisfies SelectOption[];

const MAPPING_STATUSES = [
  ["unmapped", "Unmapped"],
  ["provisional", "Provisional"],
  ["verified", "Verified"],
  ["disputed", "Disputed"],
] satisfies SelectOption[];

const DECISIONS = [
  ["pending", "Pending"],
  ["authorized", "Authorized"],
  ["denied", "Denied"],
  ["conditional", "Conditional"],
  ["pending_clarification", "Pending clarification"],
  ["not_requested", "Not requested"],
  ["not_listed", "Not listed"],
  ["expired", "Expired"],
  ["revoked", "Revoked"],
] satisfies SelectOption[];

export default async function RegulatoryDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const data = await getRegulatoryData();
  const stats = buildStats(data);
  const check = await getComplianceCheck(params, data.products);

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <TopNav />

        <header className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-5">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
            Private regulatory compliance
          </p>
          <h1 className="mt-2 text-3xl font-black">Regulatory Data Entry</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-emerald-50/80">
            Work from top to bottom: create the application, add covered states,
            upload documents, map products to exact taxa, then create manually
            verified decisions. The shop stays fail-closed until the decision is
            verified here.
          </p>
        </header>

        {(params.notice || params.error) && (
          <div
            className={`rounded-lg border p-4 text-sm font-bold ${
              params.error
                ? "border-red-300/30 bg-red-500/10 text-red-100"
                : "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
            }`}
          >
            {params.error || params.notice}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {stats.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </section>

        <nav className="flex gap-2 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.04] p-2">
          {[
            ["#application", "Application"],
            ["#states", "States"],
            ["#documents", "Documents"],
            ["#products", "Product mappings"],
            ["#decisions", "Decisions"],
            ["#checker", "Checker"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="shrink-0 rounded-md border border-white/10 px-3 py-2 text-sm font-black text-slate-200 hover:bg-white/10"
            >
              {label}
            </a>
          ))}
        </nav>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel id="application" title="1. Add or Update Application">
            <ApplicationForm />
          </Panel>
          <Panel title="Applications">
            <ApplicationsTable applications={data.applications} />
          </Panel>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel id="states" title="2. Add State to Application">
            <DestinationForm applications={data.applications} />
          </Panel>
          <Panel title="States / Destinations">
            <DestinationsTable destinations={data.destinations} />
          </Panel>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel id="documents" title="3. Upload Private Document">
            <DocumentForm applications={data.applications} />
          </Panel>
          <Panel title="Recent Documents">
            <DocumentsTable documents={data.documents} />
          </Panel>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel id="products" title="4. Map Product to Exact Taxon">
            <ProductMappingForm products={data.products} taxa={data.taxa} />
          </Panel>
          <Panel title="Current Product Mappings">
            <MappingsTable mappings={data.mappings} />
          </Panel>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel id="decisions" title="5. Create Destination Decision">
            <DecisionForm
              applications={data.applications}
              destinations={data.destinations}
              taxa={data.taxa}
              documents={data.documents}
            />
          </Panel>
          <Panel title="Recent Decisions">
            <DecisionsTable decisions={data.decisions} />
          </Panel>
        </section>

        <Panel id="checker" title="6. Compliance Checker">
          <ComplianceChecker
            products={data.products}
            params={params}
            result={check}
          />
        </Panel>
      </div>
    </main>
  );
}

function TopNav() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/admin" className="text-sm font-bold text-emerald-300">
        Back to admin
      </Link>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/shop"
          className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
        >
          Shop admin
        </Link>
        <Link
          href="https://shop.crestedcritters.com"
          className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
        >
          Open shop
        </Link>
      </div>
    </div>
  );
}

function ApplicationForm() {
  return (
    <form action={createRegulatoryApplicationAction} className="grid gap-4">
      <TextInput name="application_number" label="Application number" required />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectInput name="application_type" label="Application type" options={APPLICATION_TYPES} />
        <SelectInput name="overall_status" label="Overall status" options={APPLICATION_STATUSES} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput name="issuing_authority" label="Issuing authority" placeholder="USDA APHIS PPQ" />
        <TextInput name="permit_number" label="Permit number" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextInput name="submitted_at" label="Submitted date" type="date" />
        <TextInput name="issued_at" label="Issued date" type="date" />
        <TextInput name="expires_at" label="Expires date" type="date" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput name="applicant_name" label="Applicant name" />
        <TextInput name="organization_name" label="Organization" defaultValue="Crested Critters" />
      </div>
      <SelectInput
        name="origin_state"
        label="Origin state"
        options={US_STATES.map(([code, name]) => [code, `${name} (${code})`])}
        defaultValue="IN"
      />
      <TextArea name="internal_summary" label="Internal summary" />
      <Checkbox name="unresolved_conflict" label="This application has an unresolved conflict" />
      <SubmitButton label="Save Application" />
    </form>
  );
}

function DestinationForm({ applications }: { applications: Application[] }) {
  return (
    <form action={createRegulatoryDestinationAction} className="grid gap-4">
      <SelectInput
        name="application_id"
        label="Application"
        options={applications.map((app) => [app.id, app.application_number])}
        placeholder="Choose application"
        required
      />
      <SelectInput
        name="state_code"
        label="Destination state"
        options={US_STATES.map(([code, name]) => [code, `${name} (${code})`])}
        placeholder="Choose state"
        required
      />
      <TextInput name="state_name" label="State name override" placeholder="Optional" />
      <SelectInput name="destination_status" label="Destination status" options={DESTINATION_STATUSES} />
      <input type="hidden" name="included" value="off" />
      <Checkbox name="included" label="State is included in this application" defaultChecked />
      <TextArea name="notes" label="Destination notes" />
      <SubmitButton label="Save State" />
    </form>
  );
}

function DocumentForm({ applications }: { applications: Application[] }) {
  return (
    <form action={uploadRegulatoryDocumentAction} className="grid gap-4">
      <SelectInput
        name="application_id"
        label="Related application"
        options={applications.map((app) => [app.id, app.application_number])}
        placeholder="Optional"
      />
      <SelectInput name="document_type" label="Document type" options={DOCUMENT_TYPES} />
      <TextInput name="title" label="Document title" placeholder="Florida denial letter, PPQ permit, etc." />
      <label className="grid gap-2 text-sm font-bold text-slate-200">
        Private file
        <input
          name="document_file"
          type="file"
          required
          accept="application/pdf,image/*,.txt,.doc,.docx"
          className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-slate-100 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-300 file:px-3 file:py-2 file:font-black file:text-slate-950"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextInput name="issued_at" label="Issued date" type="date" />
        <TextInput name="effective_at" label="Effective date" type="date" />
        <TextInput name="expires_at" label="Expires date" type="date" />
      </div>
      <TextArea name="notes" label="Document notes" />
      <SubmitButton label="Upload Private Document" />
    </form>
  );
}

function ProductMappingForm({
  products,
  taxa,
}: {
  products: Product[];
  taxa: Taxon[];
}) {
  return (
    <form action={createProductTaxonMappingAction} className="grid gap-4">
      <SelectInput
        name="product_id"
        label="Shop product"
        options={products.map((product) => [
          String(product.id),
          `${product.name} (${product.category})`,
        ])}
        placeholder="Choose product"
        required
      />
      <SelectInput
        name="regulated_taxon_id"
        label="Canonical regulated taxon"
        options={taxa.map((taxon) => [taxon.id, taxon.canonical_scientific_name])}
        placeholder="Choose exact taxon"
      />
      <SelectInput name="mapping_status" label="Mapping status" options={MAPPING_STATUSES} />
      <TextInput name="morph_or_trade_name" label="Morph or trade name" placeholder="Dairy Cow, Powder Orange, etc." />
      <TextInput name="customer_display_name" label="Display name override" placeholder="Optional; product name is used automatically" />
      <TextInput name="verification_source" label="Verification source" placeholder="Permit label, breeder invoice, ID report..." />
      <TextArea name="notes" label="Mapping notes" />
      <SubmitButton label="Save Product Mapping" />
    </form>
  );
}

function DecisionForm({
  applications,
  destinations,
  taxa,
  documents,
}: {
  applications: Application[];
  destinations: Destination[];
  taxa: Taxon[];
  documents: DocumentRow[];
}) {
  return (
    <form action={createRegulatoryDecisionAction} className="grid gap-4">
      <SelectInput
        name="application_id"
        label="Application"
        options={applications.map((app) => [app.id, app.application_number])}
        placeholder="Choose application"
        required
      />
      <SelectInput
        name="destination_id"
        label="Destination state"
        options={destinations.map((destination) => [
          destination.id,
          `${destination.state_name} (${destination.state_code}) - ${destination.regulatory_applications?.application_number || "application"}`,
        ])}
        placeholder="Choose destination"
        required
      />
      <SelectInput
        name="regulated_taxon_id"
        label="Taxon"
        options={taxa.map((taxon) => [taxon.id, taxon.canonical_scientific_name])}
        placeholder="Choose taxon"
        required
      />
      <SelectInput name="decision" label="Decision" options={DECISIONS} />
      <SelectInput
        name="controlling_document_id"
        label="Controlling document"
        options={documents.map((document) => [
          document.id,
          `${document.title} (${document.document_type})`,
        ])}
        placeholder="Optional"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput name="effective_at" label="Effective date" type="date" />
        <TextInput name="expires_at" label="Expires date" type="date" />
      </div>
      <TextArea name="summarized_reason" label="Customer-safe/internal reason summary" />
      <TextArea name="condition_text" label="Condition text" />
      <div className="grid gap-2 rounded-md border border-amber-300/25 bg-amber-300/10 p-3">
        <Checkbox name="condition_satisfied" label="Condition is satisfied" />
        <Checkbox name="manually_verified" label="I manually verified this decision from controlling documentation" />
      </div>
      <TextArea name="notes" label="Internal notes" />
      <p className="rounded-md border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-300">
        Only a manually verified authorized decision, or a manually verified
        conditional decision with the condition satisfied, can make a live
        product shippable.
      </p>
      <SubmitButton label="Save Decision" />
    </form>
  );
}

function ComplianceChecker({
  products,
  params,
  result,
}: {
  products: Product[];
  params: SearchParams;
  result: Awaited<ReturnType<typeof getComplianceCheck>>;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
      <form className="grid gap-4" action="/admin/regulatory">
        <SelectInput
          name="check_state"
          label="Destination state"
          options={US_STATES.map(([code, name]) => [code, `${name} (${code})`])}
          defaultValue={params.check_state || ""}
          placeholder="Choose state"
          required
        />
        <SelectInput
          name="check_product_id"
          label="Product"
          options={products.map((product) => [
            String(product.id),
            `${product.name} (${product.category})`,
          ])}
          defaultValue={params.check_product_id || ""}
          placeholder="Choose product"
          required
        />
        <SubmitButton label="Run Check" />
      </form>

      <div className="rounded-md border border-white/10 bg-black/20 p-4">
        {!result ? (
          <p className="text-sm leading-6 text-slate-300">
            Choose a state and product to see the same fail-closed result the
            shop uses.
          </p>
        ) : (
          <div className="space-y-3">
            <div
              className={`rounded-md border p-3 text-sm font-black ${
                result.overall === "cleared"
                  ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                  : "border-amber-300/30 bg-amber-300/10 text-amber-100"
              }`}
            >
              Overall: {result.overall}
            </div>
            {result.items.map((item) => (
              <div key={item.productId} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <p className="font-black text-white">{item.availability}</p>
                <p className="mt-1 text-sm text-slate-300">{item.publicMessage}</p>
                <p className="mt-2 text-xs text-slate-400">
                  Taxon: {item.canonicalScientificName || "Not verified"} | Mapping: {item.taxonMappingStatus}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ApplicationsTable({ applications }: { applications: Application[] }) {
  if (applications.length === 0) return <Empty text="No applications yet." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-400">
          <tr>
            <th className="p-2">Application</th>
            <th className="p-2">Status</th>
            <th className="p-2">Permit</th>
            <th className="p-2">Expires</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => (
            <tr key={app.id} className="border-t border-white/10">
              <td className="p-2 font-bold">{app.application_number}</td>
              <td className="p-2">{app.overall_status}{app.unresolved_conflict ? " / conflict" : ""}</td>
              <td className="p-2">{app.permit_number || "-"}</td>
              <td className="p-2">{app.expires_at || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DestinationsTable({ destinations }: { destinations: Destination[] }) {
  if (destinations.length === 0) return <Empty text="No states added yet." />;
  return <SimpleList rows={destinations.map((item) => `${item.state_name} (${item.state_code}) - ${item.regulatory_applications?.application_number || ""} - ${item.destination_status || "needs_review"}`)} />;
}

function DocumentsTable({ documents }: { documents: DocumentRow[] }) {
  if (documents.length === 0) return <Empty text="No private documents uploaded yet." />;
  return <SimpleList rows={documents.map((doc) => `${doc.title} - ${doc.document_type} - ${doc.regulatory_applications?.application_number || "unassigned"}`)} />;
}

function MappingsTable({ mappings }: { mappings: Mapping[] }) {
  if (mappings.length === 0) return <Empty text="No product mappings yet." />;
  return <SimpleList rows={mappings.map((mapping) => `${mapping.shop_products?.name || mapping.customer_display_name} -> ${mapping.regulated_taxa?.canonical_scientific_name || "no taxon"} (${mapping.mapping_status})`)} />;
}

function DecisionsTable({ decisions }: { decisions: Decision[] }) {
  if (decisions.length === 0) return <Empty text="No decisions yet." />;
  return <SimpleList rows={decisions.map((decision) => `${decision.regulatory_destinations?.state_code || "State"} / ${decision.regulated_taxa?.canonical_scientific_name || "taxon"}: ${decision.decision}${decision.manually_verified ? " verified" : " not verified"}`)} />;
}

function SimpleList({ rows }: { rows: string[] }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row} className="rounded-md border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-300">
          {row}
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-md border border-white/10 bg-black/20 p-4 text-sm text-slate-400">{text}</p>;
}

function Panel({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatCard({ stat }: { stat: Stat }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        stat.alert
          ? "border-amber-300/30 bg-amber-300/10"
          : "border-white/10 bg-white/[0.05]"
      }`}
    >
      <div className="text-2xl font-black">{stat.value}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">
        {stat.label}
      </div>
    </div>
  );
}

function TextInput({
  name,
  label,
  type = "text",
  placeholder,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-200">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white placeholder:text-white/35"
      />
    </label>
  );
}

function TextArea({ name, label }: { name: string; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-200">
      {label}
      <textarea
        name={name}
        rows={4}
        className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white placeholder:text-white/35"
      />
    </label>
  );
}

function SelectInput({
  name,
  label,
  options,
  placeholder,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  options: Array<readonly [string, string]>;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-200">
      {label}
      <select
        name={name}
        required={required}
        defaultValue={defaultValue || ""}
        className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white [color-scheme:dark]"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(([value, labelText]) => (
          <option key={value} value={value} className="bg-[#111827] text-white">
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 text-sm font-bold text-slate-200">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="mt-1" />
      {label}
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
  return (
    <button className="rounded-md bg-emerald-300 px-4 py-3 text-sm font-black text-slate-950 hover:bg-emerald-200">
      {label}
    </button>
  );
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

async function getRegulatoryData() {
  const supabase = createSupabaseAdminClient();
  const [
    applications,
    destinations,
    taxa,
    products,
    mappings,
    documents,
    decisions,
  ] = await Promise.all([
    safeRows<Application>(
      supabase
        .from("regulatory_applications")
        .select("id,application_number,application_type,overall_status,issuing_authority,permit_number,issued_at,expires_at,unresolved_conflict")
        .order("created_at", { ascending: false })
    ),
    safeRows<Destination>(
      supabase
        .from("regulatory_destinations")
        .select("id,application_id,state_code,state_name,included,destination_status,regulatory_applications(application_number)")
        .order("state_code")
    ),
    safeRows<Taxon>(
      supabase
        .from("regulated_taxa")
        .select("id,canonical_scientific_name,taxonomic_status")
        .eq("active", true)
        .order("canonical_scientific_name")
    ),
    safeRows<Product>(
      supabase
        .from("shop_products")
        .select("id,slug,name,category,is_live,taxon_mapping_status")
        .eq("active", true)
        .order("category")
        .order("name")
    ),
    safeRows<Mapping>(
      supabase
        .from("product_taxon_mappings")
        .select("id,product_id,mapping_status,morph_or_trade_name,customer_display_name,regulated_taxa(canonical_scientific_name),shop_products(name,slug)")
        .eq("active", true)
        .order("created_at", { ascending: false })
    ),
    safeRows<DocumentRow>(
      supabase
        .from("regulatory_documents")
        .select("id,title,document_type,original_filename,uploaded_at,regulatory_applications(application_number)")
        .order("uploaded_at", { ascending: false })
        .limit(50)
    ),
    safeRows<Decision>(
      supabase
        .from("regulatory_decisions")
        .select("id,decision,manually_verified,condition_satisfied,expires_at,regulatory_destinations(state_code),regulated_taxa(canonical_scientific_name),regulatory_applications(application_number,permit_number)")
        .order("updated_at", { ascending: false })
        .limit(100)
    ),
  ]);

  return {
    applications,
    destinations,
    taxa,
    products,
    mappings,
    documents,
    decisions,
  };
}

function buildStats(data: Awaited<ReturnType<typeof getRegulatoryData>>) {
  const liveProducts = data.products.filter((product) => product.is_live);
  const unmapped = liveProducts.filter((product) => product.taxon_mapping_status !== "verified");
  const conflicts = data.applications.filter((app) => app.unresolved_conflict);
  const conditional = data.decisions.filter((decision) => decision.decision === "conditional" && !decision.condition_satisfied);
  return [
    { label: "Applications", value: data.applications.length },
    { label: "States", value: data.destinations.length },
    { label: "Taxa", value: data.taxa.length },
    { label: "Unmapped live", value: unmapped.length, alert: unmapped.length > 0 },
    { label: "Decisions", value: data.decisions.length },
    { label: "Conditional", value: conditional.length, alert: conditional.length > 0 },
    { label: "Documents", value: data.documents.length },
    { label: "Conflicts", value: conflicts.length, alert: conflicts.length > 0 },
  ] satisfies Stat[];
}

async function getComplianceCheck(params: SearchParams, products: Product[]) {
  if (!params.check_state || !params.check_product_id) return null;
  const product = products.find((item) => String(item.id) === String(params.check_product_id));
  if (!product) return null;
  return getCartCompliance({
    products: [product as never],
    stateCode: params.check_state,
    includeInternal: true,
  });
}

async function safeRows<T>(query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) {
  try {
    const result = await query;
    if (result.error) return [];
    return (result.data || []) as T[];
  } catch {
    return [];
  }
}
