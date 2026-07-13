import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";

type BadgeAssignment = {
  badge_id: string;
  assigned_at: string | null;
  profile_badges: {
    id: string;
    label: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    is_active: boolean;
    allow_inline_display: boolean;
    profile_only: boolean;
    visible_by_default: boolean;
    default_priority: number;
    user_can_hide: boolean;
    earned_date_public_default: boolean;
  } | null;
};

type BadgeSetting = {
  badge_id: string;
  is_visible: boolean;
  show_inline: boolean;
  show_on_profile: boolean;
  display_order: number;
  show_earned_date: boolean;
};

async function saveBadgeDisplaySettings(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/account/badges");

  const badgeIds = formData.getAll("badge_id").map((value) => String(value));
  const { data: assignments } = await supabase
    .from("profile_badge_assignments")
    .select("badge_id")
    .eq("profile_id", user.id)
    .in("badge_id", badgeIds)
    .returns<Array<{ badge_id: string }>>();

  const ownedBadgeIds = new Set((assignments || []).map((row) => row.badge_id));
  const rows = badgeIds
    .filter((badgeId) => ownedBadgeIds.has(badgeId))
    .map((badgeId) => ({
      profile_id: user.id,
      badge_id: badgeId,
      is_visible: formData.get(`visible_${badgeId}`) === "on",
      show_inline: formData.get(`inline_${badgeId}`) === "on",
      show_on_profile: formData.get(`profile_${badgeId}`) === "on",
      display_order: Number(formData.get(`order_${badgeId}`) || 100),
      show_earned_date: formData.get(`date_${badgeId}`) === "on",
      updated_at: new Date().toISOString(),
    }));

  if (rows.length) {
    const { error } = await supabase
      .from("user_badge_display_settings")
      .upsert(rows, { onConflict: "profile_id,badge_id" });
    if (error) redirect("/account/badges?error=save-failed");
  }

  revalidatePath("/account/badges");
  revalidatePath("/community");
  redirect("/account/badges?saved=true");
}

export default async function AccountBadgeDisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/badges");

  const [assignmentsResult, settingsResult] = await Promise.all([
    supabase
      .from("profile_badge_assignments")
      .select(
        `
        badge_id,
        assigned_at,
        profile_badges:badge_id (
          id,
          label,
          description,
          icon,
          color,
          is_active,
          allow_inline_display,
          profile_only,
          visible_by_default,
          default_priority,
          user_can_hide,
          earned_date_public_default
        )
      `
      )
      .eq("profile_id", user.id)
      .returns<BadgeAssignment[]>(),
    supabase
      .from("user_badge_display_settings")
      .select("badge_id, is_visible, show_inline, show_on_profile, display_order, show_earned_date")
      .eq("profile_id", user.id)
      .returns<BadgeSetting[]>(),
  ]);

  const settingsByBadgeId = new Map(
    (settingsResult.data || []).map((setting) => [setting.badge_id, setting])
  );

  const assignments = (assignmentsResult.data || []).filter(
    (assignment) => assignment.profile_badges?.is_active
  );

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <IsopediaNav active="settings" />
        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          <Link href="/account?tab=settings" className="text-emerald-300 underline">
            Back to Settings
          </Link>
          <Link href="/community" className="text-emerald-300 underline">
            Community
          </Link>
        </div>

        <section className="rounded-lg border border-white/10 bg-[#102016] p-5 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
            Profile Settings
          </p>
          <h1 className="mt-3 text-3xl font-black text-white">Badge Display</h1>
          <p className="mt-3 text-sm leading-6 text-emerald-50/65">
            Choose which earned badges appear beside your username in Community.
            Inline display is limited to the highest ordered visible badges.
          </p>
          {params.saved === "true" && (
            <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-100">
              Badge display settings saved.
            </div>
          )}
          {params.error && (
            <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-red-100">
              Badge display settings could not be saved.
            </div>
          )}

          <form action={saveBadgeDisplaySettings} className="mt-6 grid gap-4">
            {assignments.length ? (
              assignments.map((assignment) => {
                const badge = assignment.profile_badges;
                if (!badge) return null;
                const setting = settingsByBadgeId.get(badge.id);
                const visible = setting?.is_visible ?? badge.visible_by_default;
                const inline =
                  setting?.show_inline ??
                  (badge.allow_inline_display && !badge.profile_only);
                const profile = setting?.show_on_profile ?? true;
                const order = setting?.display_order ?? badge.default_priority ?? 100;
                const showDate =
                  setting?.show_earned_date ?? badge.earned_date_public_default;

                return (
                  <div key={badge.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <input type="hidden" name="badge_id" value={badge.id} />
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-sm font-black text-emerald-100">
                            {badge.icon ? `${badge.icon} ` : ""}
                            {badge.label}
                          </span>
                          {badge.profile_only && (
                            <span className="text-xs text-amber-200">Profile only</span>
                          )}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-emerald-50/60">
                          {badge.description || "No description."}
                        </p>
                        <p className="mt-1 text-xs text-emerald-50/40">
                          Earned {assignment.assigned_at ? new Date(assignment.assigned_at).toLocaleDateString() : "date not recorded"}
                        </p>
                      </div>
                      <label className="grid gap-1 text-sm">
                        <span className="text-emerald-50/60">Order</span>
                        <input
                          name={`order_${badge.id}`}
                          type="number"
                          defaultValue={order}
                          className="w-24 rounded-md border border-white/10 bg-[#07130c] px-2 py-1 text-white"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-emerald-50/75">
                      <Check name={`visible_${badge.id}`} label="Visible" checked={visible} disabled={!badge.user_can_hide} />
                      <Check name={`inline_${badge.id}`} label="Show beside posts" checked={inline} disabled={!badge.allow_inline_display || badge.profile_only} />
                      <Check name={`profile_${badge.id}`} label="Show on profile" checked={profile} disabled={false} />
                      <Check name={`date_${badge.id}`} label="Show earned date" checked={showDate} disabled={false} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-emerald-50/60">
                You have not earned any badges yet.
              </div>
            )}

            {assignments.length > 0 && (
              <button className="w-fit rounded-lg bg-emerald-400 px-5 py-3 font-black text-slate-950 hover:bg-emerald-300">
                Save Badge Display
              </button>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}

function Check({
  name,
  label,
  checked,
  disabled,
}: {
  name: string;
  label: string;
  checked: boolean;
  disabled: boolean;
}) {
  return (
    <label className={disabled ? "flex items-center gap-2 opacity-45" : "flex items-center gap-2"}>
      <input type="checkbox" name={name} defaultChecked={checked} disabled={disabled} />
      {label}
    </label>
  );
}
