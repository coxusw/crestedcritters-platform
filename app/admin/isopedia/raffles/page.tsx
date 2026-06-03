import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { duplicateRaffleAction, saveRaffleAction } from "./actions";
import type { Raffle } from "@/lib/isopedia-raffles";

type SearchParams = { saved?: string; error?: string; winner?: string };

export default async function AdminRafflesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const params = await searchParams;
  const raffles = await getRaffles();

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/isopedia" className="text-sm font-bold text-emerald-300">Back to Isopedia Tools</Link>
          <Link href="/raffles" className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold">Public Raffles</Link>
        </div>

        <header className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">Isopedia Tools</p>
          <h1 className="mt-2 text-3xl font-black">Raffle Manager</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Create active raffles, save reusable templates, set entry rules, then record the Randomizer Wheel results.
          </p>
        </header>

        {(params.saved || params.error || params.winner) && (
          <div className={`rounded-lg border p-4 text-sm font-bold ${params.error ? "border-red-300/30 bg-red-500/10 text-red-100" : "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"}`}>
            {params.error ? decodeURIComponent(params.error) : params.winner ? "Winner drawn and raffle completed." : "Raffle saved."}
          </div>
        )}

        <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <h2 className="text-xl font-black">Create Raffle or Template</h2>
          <RaffleForm />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {raffles.map((raffle) => <RaffleCard key={raffle.id} raffle={raffle} />)}
        </section>
      </div>
    </main>
  );
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const [{ data: adminProfile }, { data: profile }] = await Promise.all([
    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: string | null }>(),
  ]);
  if (!adminProfile && profile?.role !== "admin" && profile?.role !== "moderator") redirect("/admin/login");
}

async function getRaffles() {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("isopedia_raffles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<Raffle[]>();
  return data || [];
}

function RaffleForm({ raffle }: { raffle?: Raffle }) {
  return (
    <form action={saveRaffleAction} className="mt-4 grid gap-3">
      {raffle && <input type="hidden" name="raffle_id" value={raffle.id} />}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Title"><input name="title" defaultValue={raffle?.title || ""} className={inputClass} required /></Field>
        <Field label="Slug"><input name="slug" defaultValue={raffle?.slug || ""} className={inputClass} /></Field>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Status">
          <select name="status" defaultValue={raffle?.status || "draft"} className={inputClass}>
            <option value="template">Template</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="completed">Completed</option>
          </select>
        </Field>
        <Field label="Prize Type">
          <select name="prize_type" defaultValue={raffle?.prize_type || "physical"} className={inputClass}>
            <option value="physical">Physical</option>
            <option value="digital">Digital</option>
          </select>
        </Field>
      </div>
      <Field label="Description"><textarea name="description" rows={3} defaultValue={raffle?.description || ""} className={inputClass} /></Field>
      <Field label="Specific Rules"><textarea name="rules" rows={4} defaultValue={raffle?.rules || ""} className={inputClass} /></Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Image Upload"><input name="image_file" type="file" accept="image/*" className={inputClass} /></Field>
        <Field label="Image URL"><input name="image_url" defaultValue={raffle?.image_url || ""} className={inputClass} /></Field>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="IsoTokens Per Entry"><input name="entry_cost_isotokens" type="number" defaultValue={raffle?.entry_cost_isotokens ?? 10} className={inputClass} /></Field>
        <Field label="Donation Cents Per Entry"><input name="donation_cents_per_entry" type="number" defaultValue={raffle?.donation_cents_per_entry ?? 100} className={inputClass} /></Field>
        <Field label="Maximum Entries"><input name="max_entries" type="number" defaultValue={raffle?.max_entries || ""} className={inputClass} /></Field>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Raffle Opens">
          <input name="starts_at" type="text" defaultValue={dateInputValue(raffle?.starts_at)} placeholder="06/03/2026 9:00 AM" className={inputClass} />
        </Field>
        <Field label="Raffle Closes / Winner Decided">
          <input name="ends_at" type="text" defaultValue={dateInputValue(raffle?.ends_at)} placeholder="06/10/2026 9:00 PM" className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-3 text-sm font-bold">
        <Check name="allow_isotoken_entries" label="Allow IsoToken entries" checked={raffle?.allow_isotoken_entries ?? true} />
        <Check name="allow_donation_entries" label="Allow donation entries" checked={raffle?.allow_donation_entries ?? true} />
        <Check name="allow_multiple_entries" label="Allow multiple entries per user" checked={raffle?.allow_multiple_entries ?? true} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Result URL"><input name="results_url" defaultValue={raffle?.results_url || ""} className={inputClass} /></Field>
        <Field label="Result Notes"><textarea name="result_notes" rows={2} defaultValue={raffle?.result_notes || ""} className={inputClass} /></Field>
      </div>
      <button className="w-fit rounded-md bg-emerald-400 px-5 py-3 font-black text-slate-950">Save Raffle</button>
    </form>
  );
}

function RaffleCard({ raffle }: { raffle: Raffle }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black">{raffle.title}</h3>
          <p className="mt-1 text-sm text-slate-400">{raffle.status} / {raffle.prize_type}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">
            Opens: {displayDate(raffle.starts_at)} / Closes: {displayDate(raffle.ends_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <form action={duplicateRaffleAction}><input type="hidden" name="raffle_id" value={raffle.id} /><button className="rounded-md border border-white/10 px-3 py-2 text-xs font-black">Duplicate</button></form>
        </div>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-black text-emerald-300">Edit</summary>
        <RaffleForm raffle={raffle} />
      </details>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-bold text-slate-200">{label}{children}</label>;
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2"><input name={name} type="checkbox" defaultChecked={checked} />{label}</label>;
}

function dateInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function displayDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const inputClass = "w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-300";
