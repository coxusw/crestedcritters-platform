import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import {
  generateWeeklyPrompt,
  moderateCommunityDiscussion,
  resolveCommunityReport,
  saveCommunityCategory,
} from "@/app/admin/isopedia/community/actions";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  display_order: number;
  is_active: boolean;
  requires_approval: boolean;
  marketplace_rules: boolean;
  species_tagging_enabled: boolean;
  images_enabled: boolean;
  staff_only_posting: boolean;
  posting_guidelines: string | null;
  minimum_account_age_days: number;
};

type Discussion = {
  id: string;
  title: string;
  slug: string;
  status: string;
  content_type: string;
  pinned: boolean;
  featured: boolean;
  locked: boolean;
  report_count: number;
  created_at: string;
};

type Report = {
  id: string;
  reason: string;
  details: string | null;
  created_at: string;
  discussion: { title: string | null; slug: string | null } | null;
};

type Prompt = {
  id: string;
  title: string;
  description: string | null;
  weekday: number;
  enabled: boolean;
};

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ data: profile }, { data: adminProfile }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: string | null }>(),
    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
  ]);

  if (!adminProfile && profile?.role !== "admin" && profile?.role !== "moderator") {
    redirect("/admin/login");
  }
}

export default async function AdminCommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = createSupabaseAdminClient();

  const [categories, discussions, reports, prompts] = await Promise.all([
    supabase
      .from("community_categories")
      .select("*")
      .order("display_order", { ascending: true })
      .returns<Category[]>(),
    supabase
      .from("community_discussions")
      .select("id, title, slug, status, content_type, pinned, featured, locked, report_count, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<Discussion[]>(),
    supabase
      .from("community_reports")
      .select("id, reason, details, created_at, discussion:discussion_id(title, slug)")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<Report[]>(),
    supabase
      .from("community_recurring_prompts")
      .select("id, title, description, weekday, enabled")
      .order("weekday", { ascending: true })
      .returns<Prompt[]>(),
  ]);

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/admin/isopedia" className="text-emerald-300 underline">
            Back to Isopedia Admin
          </Link>
          <Link href="/community" className="text-emerald-300 underline">
            View Community
          </Link>
        </div>

        <header className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
            Community Admin
          </p>
          <h1 className="mt-2 text-3xl font-black">Community Controls</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Manage categories, moderation, reports, and weekly recurring prompts.
          </p>
        </header>

        {params.saved && (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-100">
            Saved: {params.saved}
          </div>
        )}
        {params.error && (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-red-100">
            {decodeURIComponent(params.error)}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
            <h2 className="text-xl font-black">Categories</h2>
            <div className="mt-5 grid gap-4">
              {(categories.data || []).map((category) => (
                <CategoryForm key={category.id} category={category} />
              ))}
              <CategoryForm category={null} />
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
              <h2 className="text-xl font-black">Open Reports</h2>
              <div className="mt-4 grid gap-3">
                {(reports.data || []).length ? (
                  (reports.data || []).map((report) => (
                    <form key={report.id} action={resolveCommunityReport} className="rounded-lg border border-white/10 bg-black/20 p-4">
                      <input type="hidden" name="report_id" value={report.id} />
                      <div className="text-xs font-black uppercase tracking-wide text-red-200">{report.reason}</div>
                      <p className="mt-2 text-sm text-slate-300">{report.details || "No details provided."}</p>
                      {report.discussion?.slug && (
                        <Link className="mt-2 inline-block text-sm text-emerald-300 underline" href={`/community/discussion/${report.discussion.slug}`}>
                          {report.discussion.title}
                        </Link>
                      )}
                      <textarea name="moderator_notes" rows={2} className="mt-3 w-full rounded-md border border-white/10 bg-[#07130c] p-2 text-sm text-white" placeholder="Moderator notes" />
                      <div className="mt-3 flex gap-2">
                        <button name="status" value="resolved" className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-black text-slate-950">Resolve</button>
                        <button name="status" value="ignored" className="rounded-md border border-white/10 px-3 py-2 text-sm font-black text-white">Ignore</button>
                      </div>
                    </form>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No open reports.</p>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
              <h2 className="text-xl font-black">Weekly Prompts</h2>
              <div className="mt-4 grid gap-3">
                {(prompts.data || []).map((prompt) => (
                  <form key={prompt.id} action={generateWeeklyPrompt} className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <input type="hidden" name="prompt_id" value={prompt.id} />
                    <div className="font-black text-white">{prompt.title}</div>
                    <p className="mt-1 text-sm text-slate-400">{prompt.description}</p>
                    <p className="mt-1 text-xs text-emerald-300">Weekday: {weekday(prompt.weekday)}</p>
                    <button className="mt-3 rounded-md bg-emerald-400 px-3 py-2 text-sm font-black text-slate-950">
                      Generate This Week
                    </button>
                  </form>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <h2 className="text-xl font-black">Recent Discussions</h2>
          <div className="mt-4 grid gap-3">
            {(discussions.data || []).map((discussion) => (
              <div key={discussion.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link href={`/community/discussion/${discussion.slug}`} className="font-black text-white hover:text-emerald-200">
                      {discussion.title}
                    </Link>
                    <p className="mt-1 text-xs text-slate-400">
                      {discussion.content_type} / {discussion.status}
                      {discussion.locked ? " / locked" : ""}
                      {discussion.pinned ? " / pinned" : ""}
                      {discussion.featured ? " / featured" : ""}
                    </p>
                  </div>
                  <form action={moderateCommunityDiscussion} className="flex flex-wrap gap-2">
                    <input type="hidden" name="discussion_id" value={discussion.id} />
                    <ModButton action={discussion.locked ? "unlock" : "lock"} label={discussion.locked ? "Unlock" : "Lock"} />
                    <ModButton action={discussion.pinned ? "unpin" : "pin"} label={discussion.pinned ? "Unpin" : "Pin"} />
                    <ModButton action={discussion.featured ? "unfeature" : "feature"} label={discussion.featured ? "Unfeature" : "Feature"} />
                    <ModButton action={discussion.status === "hidden" ? "restore" : "hide"} label={discussion.status === "hidden" ? "Restore" : "Hide"} />
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function CategoryForm({ category }: { category: Category | null }) {
  return (
    <form action={saveCommunityCategory} className="rounded-lg border border-white/10 bg-black/20 p-4">
      {category && <input type="hidden" name="category_id" value={category.id} />}
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="name" label="Name" defaultValue={category?.name || ""} />
        <Field name="slug" label="Slug" defaultValue={category?.slug || ""} />
        <Field name="icon" label="Icon" defaultValue={category?.icon || ""} />
        <Field name="color" label="Color" defaultValue={category?.color || ""} />
        <Field name="display_order" label="Order" defaultValue={String(category?.display_order ?? 100)} />
        <Field name="minimum_account_age_days" label="Min Account Age Days" defaultValue={String(category?.minimum_account_age_days ?? 0)} />
      </div>
      <label className="mt-3 grid gap-1">
        <span className="text-xs font-bold text-slate-300">Description</span>
        <textarea name="description" defaultValue={category?.description || ""} rows={2} className="rounded-md border border-white/10 bg-[#07130c] p-2 text-sm text-white" />
      </label>
      <label className="mt-3 grid gap-1">
        <span className="text-xs font-bold text-slate-300">Guidelines</span>
        <textarea name="posting_guidelines" defaultValue={category?.posting_guidelines || ""} rows={2} className="rounded-md border border-white/10 bg-[#07130c] p-2 text-sm text-white" />
      </label>
      <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-slate-200">
        <Check name="is_active" label="Active" checked={category?.is_active ?? true} />
        <Check name="requires_approval" label="Requires approval" checked={category?.requires_approval ?? false} />
        <Check name="marketplace_rules" label="Marketplace rules" checked={category?.marketplace_rules ?? false} />
        <Check name="species_tagging_enabled" label="Species tagging" checked={category?.species_tagging_enabled ?? true} />
        <Check name="images_enabled" label="Images enabled" checked={category?.images_enabled ?? true} />
        <Check name="staff_only_posting" label="Staff only" checked={category?.staff_only_posting ?? false} />
      </div>
      <button className="mt-4 rounded-md bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950">
        {category ? "Save Category" : "Create Category"}
      </button>
    </form>
  );
}

function Field({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-bold text-slate-300">{label}</span>
      <input name={name} defaultValue={defaultValue} className="rounded-md border border-white/10 bg-[#07130c] p-2 text-sm text-white" />
    </label>
  );
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" name={name} defaultChecked={checked} />
      {label}
    </label>
  );
}

function ModButton({ action, label }: { action: string; label: string }) {
  return (
    <button name="action" value={action} className="rounded-md border border-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/10">
      {label}
    </button>
  );
}

function weekday(value: number) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][value] || "Unknown";
}
