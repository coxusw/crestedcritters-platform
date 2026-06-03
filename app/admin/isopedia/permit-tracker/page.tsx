import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { STATE_NAME_BY_CODE, US_STATES, normalizeStateCode } from "@/lib/permit-tracker";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { addPermittedSpeciesAction, removePermittedSpeciesAction } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = {
  state?: string;
  q?: string;
  notice?: string;
  error?: string;
};

type PermitRecordRow = {
  id: string;
  state_code: string;
  notes: string | null;
  permit_issued_at: string | null;
  created_at: string;
  permit_species: {
    id: string;
    common_name: string;
    scientific_name: string | null;
    category: string | null;
    morph_name: string | null;
  } | null;
};

type StateGroup = {
  code: string;
  name: string;
  records: PermitRecordRow[];
};

export default async function AdminIsopediaPermitTrackerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const selectedState = normalizeSelectedState(params.state);
  const searchTerm = String(params.q || "").trim().toLowerCase();
  const records = await getPermittedRecords();
  const filteredRecords = records.filter((record) => {
    const species = record.permit_species;
    const matchesState = selectedState ? record.state_code === selectedState : true;
    const matchesSearch = searchTerm
      ? [species?.common_name, species?.scientific_name, species?.morph_name, record.notes]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(searchTerm))
      : true;

    return matchesState && matchesSearch;
  });
  const stateGroups = groupByState(filteredRecords);
  const permittedStateCount = new Set(records.map((record) => record.state_code)).size;

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/isopedia" className="text-sm font-bold text-emerald-300">
            Back to Isopedia Tools
          </Link>
          <Link
            href="/admin"
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
          >
            Admin Dashboard
          </Link>
        </div>

        <header className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
            Isopedia Tools
          </p>
          <h1 className="mt-2 text-3xl font-black">Permit Tracker</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Keep a simple list of states where you have received permits and the species covered
            for each state.
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

        <section className="grid gap-3 md:grid-cols-3">
          <Stat label="Permitted Species" value={records.length} />
          <Stat label="States" value={permittedStateCount} />
          <Stat label="Search Results" value={filteredRecords.length} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
            <h2 className="text-xl font-black">Add Permit</h2>
            <form action={addPermittedSpeciesAction} className="mt-5 grid gap-4">
              <Field label="State">
                <select name="state_code" defaultValue={selectedState || ""} className={inputClass} required>
                  <option value="">Choose state</option>
                  {US_STATES.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Species">
                <input
                  name="common_name"
                  placeholder="Dairy Cows"
                  className={inputClass}
                  required
                />
              </Field>

              <Field label="Scientific Name">
                <input
                  name="scientific_name"
                  placeholder="Porcellio laevis"
                  className={inputClass}
                />
              </Field>

              <Field label="Notes">
                <textarea
                  name="notes"
                  rows={4}
                  placeholder="Permit number, limits, expiration notes, or anything useful."
                  className={inputClass}
                />
              </Field>

              <button className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-emerald-300">
                Save Permit
              </button>
            </form>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
            <h2 className="text-xl font-black">Find Permits</h2>
            <form className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]" method="get">
              <select name="state" defaultValue={selectedState || ""} className={inputClass}>
                <option value="">All states</option>
                {US_STATES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
              <input
                name="q"
                defaultValue={params.q || ""}
                placeholder="Search species or notes"
                className={inputClass}
              />
              <button className="rounded-md bg-sky-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-sky-300">
                Search
              </button>
            </form>

            <div className="mt-5 space-y-4">
              {stateGroups.length > 0 ? (
                stateGroups.map((group) => (
                  <section key={group.code} className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-lg font-black">
                        {group.name} <span className="text-sm text-slate-400">({group.code})</span>
                      </h3>
                      <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs font-black text-emerald-100">
                        {group.records.length} permitted
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {group.records.map((record) => (
                        <article key={record.id} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="font-bold text-slate-100">
                                {record.permit_species?.common_name || "Unknown species"}
                              </h4>
                              {record.permit_species?.scientific_name && (
                                <p className="mt-1 text-sm italic text-slate-400">
                                  {record.permit_species.scientific_name}
                                </p>
                              )}
                              {record.notes && (
                                <p className="mt-2 text-sm leading-6 text-slate-300">{record.notes}</p>
                              )}
                            </div>
                            <form action={removePermittedSpeciesAction}>
                              <input type="hidden" name="record_id" value={record.id} />
                              <input type="hidden" name="state_code" value={record.state_code} />
                              <button className="rounded-md border border-red-300/20 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-500/10">
                                Remove
                              </button>
                            </form>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="rounded-lg border border-white/10 bg-black/20 p-8 text-center text-slate-400">
                  No permitted species found.
                </div>
              )}
            </div>
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

async function getPermittedRecords() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("permit_state_records")
    .select(
      `
      id,
      state_code,
      notes,
      permit_issued_at,
      created_at,
      permit_species (
        id,
        common_name,
        scientific_name,
        category,
        morph_name
      )
    `
    )
    .eq("status", "issued")
    .order("state_code", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as unknown as PermitRecordRow[];
}

function groupByState(records: PermitRecordRow[]) {
  const groups = new Map<string, StateGroup>();

  for (const record of records) {
    const code = record.state_code;
    const group = groups.get(code) || {
      code,
      name: STATE_NAME_BY_CODE.get(code) || code,
      records: [],
    };

    group.records.push(record);
    groups.set(code, group);
  }

  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeSelectedState(value: string | undefined) {
  const stateCode = normalizeStateCode(value || "");
  return STATE_NAME_BY_CODE.has(stateCode) ? stateCode : "";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-200">
      {label}
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
      <div className="text-sm uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-3 text-2xl font-black">{value}</div>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-300";
