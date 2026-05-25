import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import {
  INITIAL_PERMIT_SUPPORT_DOC,
  PERMIT_FILE_BUCKET,
  PERMIT_STATUSES,
  STATE_NAME_BY_CODE,
  US_STATES,
  formatPermitDate,
  permitStatusLabel,
  type PermitSpecies,
  type PermitStateLog,
  type PermitStateRecord,
  type PermitStateRecordWithLogs,
} from "@/lib/permit-tracker";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  createPermitDraftAction,
  createPermitSpeciesAction,
  updatePermitSpeciesAction,
  upsertPermitStateRecordAction,
} from "./actions";

export const dynamic = "force-dynamic";

const APHIS_EFILE_URL = "https://efile.aphis.usda.gov/s/";

type SearchParams = {
  species?: string;
  state?: string;
  tab?: string;
  notice?: string;
  error?: string;
};

export default async function AdminIsoTrackerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const { species, records } = await getPermitTrackerData();
  const activeSpeciesId = species.some((item) => item.id === params.species)
    ? params.species || species[0]?.id || ""
    : species[0]?.id || "";
  const activeTab = ["not-submitted", "submitted", "permitted", "all"].includes(params.tab || "")
    ? params.tab || "not-submitted"
    : "not-submitted";

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="text-sm font-bold text-emerald-300">
            Back to admin
          </Link>
          <a
            href={APHIS_EFILE_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
          >
            Open APHIS eFile
          </a>
        </div>

        <header className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
            Indiana origin permit tracker
          </p>
          <h1 className="mt-2 text-3xl font-black">Live Shipping Permit Tracker</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
            Track PPQ 526 drafts, submitted applications, issued permits, state notes, and support
            documentation for each isopod and springtail species in the shop catalog.
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

        <section className="grid gap-3 md:grid-cols-4">
          <Stat label="Species" value={species.length} />
          <Stat label="Submitted" value={records.filter((record) => record.status === "submitted").length} />
          <Stat label="Permitted" value={records.filter((record) => record.status === "issued").length} />
          <Stat
            label="Needs Taxonomy"
            value={species.filter((item) => !item.scientific_name).length}
            alert={species.some((item) => !item.scientific_name)}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <AddSpeciesPanel />
          <SupportDocsPanel />
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Species Permit List</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Open a species, choose a state, then save application status, files, and notes.
              </p>
            </div>
            <span className="rounded-md border border-white/10 px-3 py-2 text-sm font-black text-slate-300">
              Start close: Illinois or Michigan
            </span>
          </div>

          <div className="grid gap-3">
            {species.map((item) => {
              const speciesRecords = records.filter((record) => record.species_id === item.id);
              const selectedState = normalizeSelectedState(params.state, speciesRecords);
              const selectedRecord = speciesRecords.find((record) => record.state_code === selectedState);
              const isOpen = item.id === activeSpeciesId;

              return (
                <details
                  key={item.id}
                  open={isOpen}
                  className="group rounded-lg border border-white/10 bg-white/[0.05]"
                >
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 marker:hidden">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black text-white">{item.common_name}</h3>
                        <span className="rounded-md border border-white/10 px-2 py-1 text-xs font-bold text-slate-300">
                          {item.category}
                        </span>
                        {!item.scientific_name && (
                          <span className="rounded-md border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs font-black text-amber-100">
                            taxonomy needed
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {item.scientific_name || "Scientific name not set"}
                        {item.morph_name ? ` - ${item.morph_name}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <MiniStat label="submitted" value={speciesRecords.filter((record) => record.status === "submitted").length} />
                      <MiniStat label="permitted" value={speciesRecords.filter((record) => record.status === "issued").length} />
                      <span className="rounded-md border border-white/10 px-3 py-2 text-sm font-black text-emerald-200 group-open:hidden">
                        Open
                      </span>
                      <span className="hidden rounded-md border border-white/10 px-3 py-2 text-sm font-black text-slate-300 group-open:inline">
                        Close
                      </span>
                    </div>
                  </summary>

                  <div className="grid gap-4 border-t border-white/10 p-5 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-4">
                      <SpeciesEditor species={item} />
                      <StateTabs speciesId={item.id} activeTab={isOpen ? activeTab : "not-submitted"} />
                      <StateList
                        speciesId={item.id}
                        records={speciesRecords}
                        activeTab={isOpen ? activeTab : "not-submitted"}
                      />
                    </div>

                    <div className="space-y-4">
                      <StateSelector speciesId={item.id} selectedState={isOpen ? selectedState : "IL"} />
                      <StateRecordForm
                        species={item}
                        stateCode={isOpen ? selectedState : "IL"}
                        record={isOpen ? selectedRecord : undefined}
                      />
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      </div>
    </main>
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

async function getPermitTrackerData() {
  const supabase = createSupabaseAdminClient();
  const [speciesResult, recordsResult, logsResult] = await Promise.all([
    supabase
      .from("permit_species")
      .select("*")
      .eq("active", true)
      .order("priority")
      .order("common_name"),
    supabase
      .from("permit_state_records")
      .select("*")
      .order("updated_at", { ascending: false }),
    supabase
      .from("permit_state_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const species = (speciesResult.data || []) as PermitSpecies[];
  const logsByRecord = new Map<string, PermitStateLog[]>();
  for (const log of ((logsResult.data || []) as PermitStateLog[])) {
    const rows = logsByRecord.get(log.state_record_id) || [];
    rows.push(log);
    logsByRecord.set(log.state_record_id, rows);
  }

  const records: PermitStateRecordWithLogs[] = [];
  for (const record of ((recordsResult.data || []) as PermitStateRecord[])) {
    records.push({
      ...record,
      logs: logsByRecord.get(record.id) || [],
      applicationUrl: await signedPermitUrl(supabase, record.application_storage_path),
      permitUrl: await signedPermitUrl(supabase, record.permit_storage_path),
    });
  }

  return { species, records };
}

async function signedPermitUrl(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  storagePath: string | null
) {
  if (!storagePath) return null;
  const { data } = await supabase.storage
    .from(PERMIT_FILE_BUCKET)
    .createSignedUrl(storagePath, 60 * 30);
  return data?.signedUrl || null;
}

function AddSpeciesPanel() {
  return (
    <details className="group rounded-lg border border-emerald-300/20 bg-emerald-300/10">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 marker:hidden">
        <div>
          <h2 className="text-xl font-black text-emerald-50">Add Species</h2>
          <p className="mt-1 text-sm leading-6 text-emerald-100/75">
            Add a new species or culture before it exists in the shop.
          </p>
        </div>
        <span className="rounded-md border border-emerald-100/20 px-3 py-2 text-sm font-black text-emerald-50 group-open:hidden">
          Open
        </span>
        <span className="hidden rounded-md border border-emerald-100/20 px-3 py-2 text-sm font-black text-emerald-50 group-open:inline">
          Close
        </span>
      </summary>
      <div className="border-t border-emerald-100/10 px-5 pb-5">
        <SpeciesForm action={createPermitSpeciesAction} submitLabel="Add Species" />
      </div>
    </details>
  );
}

function SupportDocsPanel() {
  const docs = [
    ["Origin", INITIAL_PERMIT_SUPPORT_DOC.originState],
    ["Use", INITIAL_PERMIT_SUPPORT_DOC.intendedUse],
    ["Source", INITIAL_PERMIT_SUPPORT_DOC.source],
    ["Shipping", INITIAL_PERMIT_SUPPORT_DOC.shipping],
    ["Containment", INITIAL_PERMIT_SUPPORT_DOC.containment],
    ["Release", INITIAL_PERMIT_SUPPORT_DOC.releasePrevention],
    ["Disposal", INITIAL_PERMIT_SUPPORT_DOC.disposal],
  ];

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">SOP / Support Doc Draft</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Reusable language for PPQ 526 drafts. Treat taxonomy as the item to verify before each submission.
          </p>
        </div>
        <span className="rounded-md border border-white/10 px-3 py-2 text-sm font-black text-slate-300">
          No soil
        </span>
      </div>
      <div className="mt-4 grid gap-2">
        {docs.map(([label, value]) => (
          <div key={label} className="rounded-md border border-white/10 bg-black/20 p-3">
            <div className="text-xs font-black uppercase tracking-wide text-emerald-200">{label}</div>
            <p className="mt-1 text-sm leading-6 text-slate-300">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SpeciesEditor({ species }: { species: PermitSpecies }) {
  return (
    <details className="group rounded-lg border border-white/10 bg-black/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden">
        <h4 className="font-black">Species Details</h4>
        <span className="rounded-md border border-white/10 px-2 py-1 text-xs font-black text-slate-300">
          Edit
        </span>
      </summary>
      <div className="border-t border-white/10 px-4 pb-4">
        <SpeciesForm action={updatePermitSpeciesAction} species={species} submitLabel="Save Species" />
      </div>
    </details>
  );
}

function SpeciesForm({
  action,
  species,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  species?: PermitSpecies;
  submitLabel: string;
}) {
  return (
    <form action={action} className="mt-4 grid gap-3">
      {species && <input type="hidden" name="species_id" value={species.id} />}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Common / Shop Name">
          <input name="common_name" required defaultValue={species?.common_name || ""} className={inputClass} />
        </Field>
        <Field label="Scientific Name">
          <input name="scientific_name" defaultValue={species?.scientific_name || ""} placeholder="Confirm before filing" className={inputClass} />
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px]">
        <Field label="Morph / Line">
          <input name="morph_name" defaultValue={species?.morph_name || ""} className={inputClass} />
        </Field>
        <Field label="Category">
          <select name="category" defaultValue={species?.category || "Isopods"} className={inputClass}>
            <option>Isopods</option>
            <option>Springtails</option>
            <option>Other</option>
          </select>
        </Field>
        <Field label="Priority">
          <input name="priority" type="number" defaultValue={species?.priority ?? 100} className={inputClass} />
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Shop Slug">
          <input name="shop_slug" defaultValue={species?.shop_slug || ""} className={inputClass} />
        </Field>
        <Field label="Intended Use">
          <input name="intended_use" defaultValue={species?.intended_use || "Cleanup crew and pets"} className={inputClass} />
        </Field>
      </div>
      <Field label="Source Notes">
        <textarea name="source_notes" rows={3} defaultValue={species?.source_notes || INITIAL_PERMIT_SUPPORT_DOC.source} className={`${inputClass} min-h-24`} />
      </Field>
      <Field label="Taxonomy / Permit Notes">
        <textarea name="taxonomy_notes" rows={3} defaultValue={species?.taxonomy_notes || ""} placeholder="Anything to verify before submitting this species." className={`${inputClass} min-h-24`} />
      </Field>
      <Check name="active" label="Active" defaultChecked={species ? species.active : true} />
      <button className="w-fit rounded-md bg-emerald-300 px-5 py-3 font-black text-slate-950 hover:bg-emerald-200">
        {submitLabel}
      </button>
    </form>
  );
}

function StateTabs({ speciesId, activeTab }: { speciesId: string; activeTab: string }) {
  return (
    <nav className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-2">
      <TrackerTab href={`/admin/isotracker?species=${speciesId}&tab=not-submitted`} active={activeTab === "not-submitted"}>
        Not Submitted
      </TrackerTab>
      <TrackerTab href={`/admin/isotracker?species=${speciesId}&tab=submitted`} active={activeTab === "submitted"}>
        Submitted
      </TrackerTab>
      <TrackerTab href={`/admin/isotracker?species=${speciesId}&tab=permitted`} active={activeTab === "permitted"}>
        Permitted
      </TrackerTab>
      <TrackerTab href={`/admin/isotracker?species=${speciesId}&tab=all`} active={activeTab === "all"}>
        All States
      </TrackerTab>
    </nav>
  );
}

function StateList({
  speciesId,
  records,
  activeTab,
}: {
  speciesId: string;
  records: PermitStateRecordWithLogs[];
  activeTab: string;
}) {
  const recordByState = new Map(records.map((record) => [record.state_code, record]));
  const rows = US_STATES.map(([code, name]) => ({
    code,
    name,
    record: recordByState.get(code),
  })).filter(({ record }) => {
    if (activeTab === "submitted") return record?.status === "submitted";
    if (activeTab === "permitted") return record?.status === "issued";
    if (activeTab === "all") return true;
    return !record || record.status === "not_submitted" || record.status === "drafting";
  });

  return (
    <section className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-black">{tabTitle(activeTab)}</h4>
        <span className="rounded-md border border-white/10 px-2 py-1 text-xs font-black text-slate-300">
          {rows.length} states
        </span>
      </div>
      <div className="mt-3 grid max-h-80 gap-2 overflow-auto pr-1">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">No states in this tab yet.</p>
        ) : (
          rows.map(({ code, name, record }) => (
            <div
              key={code}
              className="rounded-md border border-white/10 bg-[#07100c] p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-black">{name}</span>
                <span className={`rounded-md border px-2 py-1 text-xs font-black ${statusTone(record?.status || "not_submitted")}`}>
                  {permitStatusLabel(record?.status || "not_submitted")}
                </span>
              </div>
              {record?.application_file_name && (
                <p className="mt-1 text-xs text-slate-400">Application: {record.application_file_name}</p>
              )}
              {record?.permit_file_name && (
                <p className="mt-1 text-xs text-emerald-200">Permit: {record.permit_file_name}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/admin/isotracker?species=${speciesId}&state=${code}&tab=${activeTab}`}
                  className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-slate-100 hover:bg-white/10"
                >
                  Open State
                </Link>
                {(!record || record.status === "not_submitted" || record.status === "drafting") && (
                  <form action={createPermitDraftAction}>
                    <input type="hidden" name="species_id" value={speciesId} />
                    <input type="hidden" name="state_code" value={code} />
                    <button className="rounded-md border border-emerald-300/30 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-300/10">
                      Draft Application
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function StateSelector({ speciesId, selectedState }: { speciesId: string; selectedState: string }) {
  return (
    <form action="/admin/isotracker" className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
      <input type="hidden" name="species" value={speciesId} />
      <Field label="Choose State">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <select name="state" defaultValue={selectedState} className={inputClass}>
            {US_STATES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          <button className="rounded-md border border-white/10 px-4 py-2 text-sm font-black text-slate-100 hover:bg-white/10">
            Load State
          </button>
        </div>
      </Field>
    </form>
  );
}

function StateRecordForm({
  species,
  stateCode,
  record,
}: {
  species: PermitSpecies;
  stateCode: string;
  record?: PermitStateRecordWithLogs;
}) {
  const stateName = STATE_NAME_BY_CODE.get(stateCode) || stateCode;

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-xl font-black">
            {stateName} - {species.common_name}
          </h4>
          <p className="mt-1 text-sm text-slate-400">
            {record
              ? "Edit the draft, save your changes, then open APHIS eFile when you are ready to submit."
              : "Generate a draft first, then edit and save it before opening the filing portal."}
          </p>
        </div>
        <span className={`rounded-md border px-3 py-2 text-sm font-black ${statusTone(record?.status || "not_submitted")}`}>
          {permitStatusLabel(record?.status || "not_submitted")}
        </span>
      </div>

      <form action={upsertPermitStateRecordAction} className="mt-5 grid gap-3">
        <input type="hidden" name="species_id" value={species.id} />
        <input type="hidden" name="state_code" value={stateCode} />

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Status">
            <select name="status" defaultValue={record?.status || "not_submitted"} className={inputClass}>
              {PERMIT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Permit Number">
            <input name="permit_number" defaultValue={record?.permit_number || ""} className={inputClass} />
          </Field>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Submitted Date">
            <input name="application_submitted_at" type="date" defaultValue={record?.application_submitted_at || ""} className={inputClass} />
          </Field>
          <Field label="Issued Date">
            <input name="permit_issued_at" type="date" defaultValue={record?.permit_issued_at || ""} className={inputClass} />
          </Field>
          <Field label="Expires Date">
            <input name="permit_expires_at" type="date" defaultValue={record?.permit_expires_at || ""} className={inputClass} />
          </Field>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Submitted Application Copy">
            <input name="application_file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className={fileInputClass} />
            {record?.applicationUrl && (
              <a href={record.applicationUrl} className="mt-2 inline-flex text-sm font-bold text-emerald-300 underline">
                Open {record.application_file_name || "application file"}
              </a>
            )}
          </Field>
          <Field label="Issued Permit Copy">
            <input name="permit_file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className={fileInputClass} />
            {record?.permitUrl && (
              <a href={record.permitUrl} className="mt-2 inline-flex text-sm font-bold text-emerald-300 underline">
                Open {record.permit_file_name || "permit file"}
              </a>
            )}
          </Field>
        </div>

        <Field label="Editable Permit Application Draft">
          <textarea
            name="notes"
            rows={18}
            defaultValue={record?.notes || ""}
            placeholder="Click Draft Application From Saved Info to generate the first draft for this species and state."
            className={`${inputClass} min-h-[28rem] font-mono text-sm leading-6`}
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Edit this text as you refine the application. Saving here keeps the current draft attached to this species and state.
          </p>
        </Field>

        <div className="grid gap-3 md:grid-cols-[180px_1fr]">
          <Field label="Log Type">
            <select name="log_type" defaultValue="note" className={inputClass}>
              <option value="note">Note</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="submitted">Submitted</option>
              <option value="issued">Issued</option>
              <option value="denied">Denied</option>
            </select>
          </Field>
          <Field label="Add Info To State Log">
            <textarea name="log_note" rows={3} placeholder="Example: Called state plant health office; they asked for SOP details." className={`${inputClass} min-h-24`} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="rounded-md bg-emerald-300 px-5 py-3 font-black text-slate-950 hover:bg-emerald-200">
            Save Draft / State Record
          </button>
        </div>
      </form>

      {(!record || record.status === "not_submitted" || record.status === "drafting") && (
        <form action={createPermitDraftAction} className="mt-3">
          <input type="hidden" name="species_id" value={species.id} />
          <input type="hidden" name="state_code" value={stateCode} />
          <button className="rounded-md border border-emerald-300/30 px-5 py-3 text-sm font-black text-emerald-100 hover:bg-emerald-300/10">
            Draft Application From Saved Info
          </button>
        </form>
      )}

      {record ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 p-3">
          <a
            href={APHIS_EFILE_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-emerald-300 px-5 py-3 text-sm font-black text-slate-950 hover:bg-emerald-200"
          >
            Submit In APHIS eFile
          </a>
          <p className="text-sm leading-6 text-emerald-50/80">
            Opens the official filing portal in a new tab. After submitting, return here, set status to Submitted, add the submitted date, and upload the application copy.
          </p>
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-400">
          Generate and save a draft to show the APHIS eFile submission button for this state.
        </div>
      )}

      {record && (
        <div className="mt-5 grid gap-2 rounded-md border border-white/10 bg-black/20 p-3 text-sm md:grid-cols-3">
          <div>
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Submitted</div>
            <div className="mt-1 text-slate-200">{formatPermitDate(record.application_submitted_at)}</div>
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Issued</div>
            <div className="mt-1 text-slate-200">{formatPermitDate(record.permit_issued_at)}</div>
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Expires</div>
            <div className="mt-1 text-slate-200">{formatPermitDate(record.permit_expires_at)}</div>
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-white/10 pt-4">
        <h5 className="font-black">State Log</h5>
        <div className="mt-3 grid gap-2">
          {record?.logs.length ? (
            record.logs.map((log) => (
              <div key={log.id} className="rounded-md border border-white/10 bg-black/20 p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-black capitalize text-slate-100">{log.log_type}</span>
                  <span className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-2 leading-6 text-slate-300">{log.note}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">No notes saved for this state yet.</p>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-md border border-sky-300/20 bg-sky-300/10 p-3 text-sm leading-6 text-sky-50/85">
        Draft direction: for broad rollout, start with nearby contiguous states like Illinois and
        Michigan, then repeat the same species/state package across the remaining states after you
        see how APHIS and state reviewers respond.
      </div>
    </section>
  );
}

function Stat({ label, value, alert = false }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${alert ? "border-amber-300/30 bg-amber-300/10" : "border-white/10 bg-white/[0.05]"}`}>
      <div className="text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs font-black uppercase text-slate-300">
      {value} {label}
    </span>
  );
}

function TrackerTab({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 text-sm font-black ${
        active
          ? "bg-emerald-300 text-slate-950"
          : "border border-white/10 text-slate-200 hover:bg-white/10"
      }`}
    >
      {children}
    </Link>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-bold text-slate-300">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex w-fit items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm font-bold text-slate-200">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

function normalizeSelectedState(state: string | undefined, records: PermitStateRecordWithLogs[]) {
  const clean = String(state || "").toUpperCase();
  if (US_STATES.some(([code]) => code === clean)) return clean;
  const firstActive = records.find((record) => ["submitted", "issued", "drafting"].includes(record.status));
  return firstActive?.state_code || "IL";
}

function tabTitle(activeTab: string) {
  if (activeTab === "submitted") return "Submitted Applications";
  if (activeTab === "permitted") return "Permitted States";
  if (activeTab === "all") return "All States";
  return "Not Submitted";
}

function statusTone(status: string) {
  if (status === "issued") return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  if (status === "submitted") return "border-sky-300/30 bg-sky-300/10 text-sky-100";
  if (status === "denied" || status === "not_allowed") return "border-red-300/30 bg-red-400/10 text-red-100";
  if (status === "expired" || status === "drafting") return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  return "border-white/10 bg-black/20 text-slate-300";
}

const inputClass =
  "w-full rounded-md border border-white/10 bg-[#07100c] px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-300 focus:outline-none";

const fileInputClass =
  `${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-emerald-300 file:px-3 file:py-2 file:text-sm file:font-black file:text-slate-950`;
