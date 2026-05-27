import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type FeatureFlag = {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
};

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const [{ data: adminProfile }, { data: roleProfile }] = await Promise.all([
    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle(),
  ]);

  if (
    !adminProfile &&
    roleProfile?.role !== "admin" &&
    roleProfile?.role !== "moderator"
  ) {
    redirect("/admin/login");
  }

  return supabase;
}

async function updateFeatureFlags(formData: FormData) {
  "use server";

  const supabase = await requireAdmin();
  const keys = formData.getAll("feature_key").map(String);

  await Promise.all(
    keys.map((key) =>
      supabase
        .from("isopedia_feature_flags")
        .update({
          enabled: formData.get(`enabled:${key}`) === "on",
          updated_at: new Date().toISOString(),
        })
        .eq("key", key)
    )
  );

  revalidatePath("/admin/isopedia/feature-controls");
  redirect("/admin/isopedia/feature-controls?saved=true");
}

export default async function IsopediaFeatureControlsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const supabase = await requireAdmin();

  const { data: flags, error } = await supabase
    .from("isopedia_feature_flags")
    .select("key, label, description, enabled")
    .order("label", { ascending: true })
    .returns<FeatureFlag[]>();

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
              Isopedia Tools
            </p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">
              Feature Controls
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Keep future profile features disabled until they are reviewed and ready.
            </p>
          </div>

          <Link
            href="/admin/isopedia"
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
          >
            Back to Isopedia
          </Link>
        </header>

        {params.saved === "true" && (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">
            Feature controls saved.
          </div>
        )}

        {error ? (
          <section className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
            Feature flag tables are not available yet. Run the new Supabase
            migration, then refresh this page.
          </section>
        ) : (
          <form
            action={updateFeatureFlags}
            className="rounded-lg border border-white/10 bg-white/[0.05] p-5"
          >
            <div className="grid gap-3">
              {(flags || []).map((flag) => (
              <label
                key={flag.key}
                className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <input type="hidden" name="feature_key" value={flag.key} />
                <span>
                  <span className="block text-base font-black text-white">
                    {flag.label}
                  </span>
                  {flag.description && (
                    <span className="mt-1 block text-sm leading-6 text-slate-400">
                      {flag.description}
                    </span>
                  )}
                </span>
                <span className="inline-flex items-center gap-3 text-sm font-bold text-slate-200">
                  <span>{flag.enabled ? "Enabled" : "Disabled"}</span>
                  <input
                    type="checkbox"
                    name={`enabled:${flag.key}`}
                    defaultChecked={flag.enabled}
                    className="h-5 w-5 accent-emerald-400"
                  />
                </span>
              </label>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button className="rounded-md bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-emerald-300">
                Save Feature Controls
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
