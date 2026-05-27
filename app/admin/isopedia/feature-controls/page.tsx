import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type FeatureFlag = {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  availability_mode: "disabled" | "enabled_all" | "isotoken_shop" | null;
};

const rolloutModes = [
  {
    value: "disabled",
    label: "Disabled",
    description: "No users can access this feature.",
  },
  {
    value: "enabled_all",
    label: "Enabled for everyone",
    description: "Every eligible user can use this feature.",
  },
  {
    value: "isotoken_shop",
    label: "IsoToken Shop purchase",
    description:
      "Only users with a completed purchase for a matching shop item key can use it.",
  },
];

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
    keys.map((key) => {
      const mode = String(formData.get(`availability_mode:${key}`) || "disabled");

      return supabase
        .from("isopedia_feature_flags")
        .update({
          availability_mode: rolloutModes.some((item) => item.value === mode)
            ? mode
            : "disabled",
          enabled: mode !== "disabled",
          updated_at: new Date().toISOString(),
        })
        .eq("key", key);
    })
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
    .select("key, label, description, enabled, availability_mode")
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
              Choose whether features are disabled, available to everyone, or
              unlocked only after a user purchases the matching IsoToken Shop
              item.
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
              {(flags || []).map((flag) => {
                const currentMode =
                  flag.availability_mode || (flag.enabled ? "enabled_all" : "disabled");

                return (
                  <label
                    key={flag.key}
                    className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-4 lg:grid-cols-[1fr_280px] lg:items-center"
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
                      <span className="mt-2 block text-xs font-bold text-emerald-300/70">
                        Shop item key for purchase mode: {flag.key}
                      </span>
                    </span>

                    <span className="grid gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Rollout
                      </span>
                      <select
                        name={`availability_mode:${flag.key}`}
                        defaultValue={currentMode}
                        className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none focus:border-emerald-300"
                      >
                        {rolloutModes.map((mode) => (
                          <option key={mode.value} value={mode.value}>
                            {mode.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs leading-5 text-slate-500">
                        {
                          rolloutModes.find((mode) => mode.value === currentMode)
                            ?.description
                        }
                      </span>
                    </span>
                  </label>
                );
              })}
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
