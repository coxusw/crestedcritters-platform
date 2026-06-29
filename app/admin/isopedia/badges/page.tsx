import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { productionIsopediaUrl } from "@/lib/isopedia-site";
import {
  ACCOUNT_AGE_BADGE_MILESTONES,
  syncAccountAgeBadges,
} from "@/lib/isopedia-account-age-badges";
import AdminBadgesAssignmentForm from "@/app/components/isopedia/AdminBadgesAssignmentForm";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  business_name: string | null;
  role: string | null;
  created_at?: string | null;
};

type Badge = {
  id: string;
  label: string;
  description: string | null;
  color: string;
  icon: string | null;
  is_active: boolean;
};

type BadgeAssignment = {
  id: string;
  assigned_at: string | null;
  profiles: Profile | null;
  profile_badges: Badge | null;
};

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/isopedia/badges");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, role")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  const { data: adminProfile } = await supabase
    .from("admin_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin" || Boolean(adminProfile);

  if (!isAdmin) {
    redirect("/isopedia");
  }

  return { supabase, user };
}

async function createBadge(formData: FormData) {
  "use server";

  const { supabase, user } = await requireAdmin();

  const label = cleanText(formData.get("label"));
  const description = cleanText(formData.get("description"));
  const color = cleanText(formData.get("color")) || "emerald";
  const icon = cleanText(formData.get("icon"));

  if (!label) {
    redirect("/admin/isopedia/badges?error=badge-label-required");
  }

  const { error } = await supabase.from("profile_badges").insert({
    label,
    description: description || null,
    color,
    icon: icon || null,
    is_active: true,
    created_by: user.id,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    redirect("/admin/isopedia/badges?error=create-badge-failed");
  }

  revalidatePath("/admin/isopedia/badges");
  redirect("/admin/isopedia/badges?created=true");
}

async function assignBadge(formData: FormData) {
  "use server";

  const { supabase, user } = await requireAdmin();

  const username = cleanText(formData.get("username"));
  const badgeId = cleanText(formData.get("badge_id"));

  if (!username || !badgeId) {
    redirect("/admin/isopedia/badges?error=assignment-missing");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .ilike("username", username)
    .maybeSingle<{ id: string; username: string | null }>();

  if (!profile) {
    redirect("/admin/isopedia/badges?error=user-not-found");
  }

  const { error } = await supabase.from("profile_badge_assignments").upsert({
    profile_id: profile.id,
    badge_id: badgeId,
    assigned_by: user.id,
  });

  if (error) {
    redirect("/admin/isopedia/badges?error=assign-badge-failed");
  }

  const profileUsername = profile.username || username;

  revalidatePath("/admin/isopedia/badges");
  revalidatePath(`/isopedia/profile/${profileUsername}`);
  revalidatePath(`/isopedia/collection/${profileUsername}`);

  redirect("/admin/isopedia/badges?assigned=true");
}

async function assignBadgeToProfiles(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profileIds: string[],
  badgeId: string,
  assignedBy: string
) {
  const uniqueProfileIds = [...new Set(profileIds)].filter(Boolean);
  if (!uniqueProfileIds.length) return 0;

  const { data: existingAssignments, error: existingError } = await supabase
    .from("profile_badge_assignments")
    .select("profile_id")
    .eq("badge_id", badgeId)
    .in("profile_id", uniqueProfileIds)
    .returns<Array<{ profile_id: string }>>();

  if (existingError) throw new Error(existingError.message);

  const alreadyAssigned = new Set(
    (existingAssignments || []).map((assignment) => assignment.profile_id)
  );
  const rows = uniqueProfileIds
    .filter((profileId) => !alreadyAssigned.has(profileId))
    .map((profileId) => ({
      profile_id: profileId,
      badge_id: badgeId,
      assigned_by: assignedBy,
    }));

  if (!rows.length) return 0;

  const { error } = await supabase.from("profile_badge_assignments").insert(rows);
  if (error) throw new Error(error.message);

  return rows.length;
}

async function assignBadgeByCriteria(formData: FormData) {
  "use server";

  const { supabase, user } = await requireAdmin();
  const badgeId = cleanText(formData.get("badge_id"));
  const criteria = cleanText(formData.get("criteria"));
  const limit = Math.max(1, Math.min(5000, Number(formData.get("limit") || 10)));
  const months = Math.max(1, Math.min(240, Number(formData.get("months") || 12)));

  if (!badgeId) {
    redirect("/admin/isopedia/badges?error=missing-badge");
  }

  let profileIds: string[] = [];

  if (criteria === "first_accounts") {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .order("created_at", { ascending: true, nullsFirst: false })
      .limit(limit)
      .returns<Array<{ id: string }>>();

    if (error) throw new Error(error.message);
    profileIds = (data || []).map((profile) => profile.id);
  } else if (criteria === "all_current") {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .range(0, 4999)
      .returns<Array<{ id: string }>>();

    if (error) throw new Error(error.message);
    profileIds = (data || []).map((profile) => profile.id);
  } else if (criteria === "account_age_months") {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .not("created_at", "is", null)
      .lte("created_at", cutoff.toISOString())
      .range(0, 4999)
      .returns<Array<{ id: string }>>();

    if (error) throw new Error(error.message);
    profileIds = (data || []).map((profile) => profile.id);
  } else {
    redirect("/admin/isopedia/badges?error=invalid-criteria");
  }

  try {
    const assignedCount = await assignBadgeToProfiles(
      supabase,
      profileIds,
      badgeId,
      user.id
    );

    revalidatePath("/admin/isopedia/badges");
    redirect(`/admin/isopedia/badges?bulk=${assignedCount.toString()}`);
  } catch (error) {
    redirect(
      `/admin/isopedia/badges?error=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`
    );
  }
}

async function removeAssignment(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const assignmentId = cleanText(formData.get("assignment_id"));

  if (!assignmentId) {
    redirect("/admin/isopedia/badges?error=missing-assignment");
  }

  const { error } = await supabase
    .from("profile_badge_assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) {
    redirect("/admin/isopedia/badges?error=remove-assignment-failed");
  }

  revalidatePath("/admin/isopedia/badges");
  redirect("/admin/isopedia/badges?removed=true");
}

async function toggleBadge(formData: FormData) {
  "use server";

  const { supabase } = await requireAdmin();

  const badgeId = cleanText(formData.get("badge_id"));
  const isActive = cleanText(formData.get("is_active")) === "true";

  if (!badgeId) {
    redirect("/admin/isopedia/badges?error=missing-badge");
  }

  const { error } = await supabase
    .from("profile_badges")
    .update({
      is_active: !isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", badgeId);

  if (error) {
    redirect("/admin/isopedia/badges?error=toggle-badge-failed");
  }

  revalidatePath("/admin/isopedia/badges");
  redirect("/admin/isopedia/badges?updated=true");
}

async function runAccountAgeBadgeSync() {
  "use server";

  await requireAdmin();

  try {
    const result = await syncAccountAgeBadges();
    revalidatePath("/admin/isopedia/badges");
    redirect(
      `/admin/isopedia/badges?ageBadges=${result.assignmentsAdded.toString()}&checked=${result.profilesChecked.toString()}`
    );
  } catch (error) {
    redirect(
      `/admin/isopedia/badges?error=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`
    );
  }
}

export default async function AdminBadgesPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    assigned?: string;
    removed?: string;
    updated?: string;
    bulk?: string;
    ageBadges?: string;
    checked?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();

  const { data: badges } = await supabase
    .from("profile_badges")
    .select("id, label, description, color, icon, is_active")
    .order("created_at", { ascending: false })
    .returns<Badge[]>();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, business_name, role, created_at")
    .not("username", "is", null)
    .order("username", { ascending: true })
    .returns<Profile[]>();

  const { data: assignments } = await supabase
    .from("profile_badge_assignments")
    .select(
      `
      id,
      assigned_at,
      profiles:profile_id (
        id,
        username,
        display_name,
        business_name,
        role
      ),
      profile_badges:badge_id (
        id,
        label,
        description,
        color,
        icon,
        is_active
      )
    `
    )
    .order("assigned_at", { ascending: false })
    .returns<BadgeAssignment[]>();

  const allBadges = badges || [];
  const activeBadges = allBadges.filter((badge) => badge.is_active);
  const searchableProfiles = profiles || [];

  return (
    <main className="min-h-screen bg-[#0c1710] px-4 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/isopedia"
            className="rounded-xl border border-white/10 bg-[#102016] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#18291d]"
          >
            ← Back to Isopedia
          </Link>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/isopedia"
              className="rounded-xl border border-white/10 bg-[#142318] px-4 py-2 text-sm font-semibold text-white hover:bg-[#18291d]"
            >
              Admin Home
            </Link>

            <Link
              href="/isopedia/review"
              className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-300"
            >
              Review Queue
            </Link>
          </div>
        </div>

        <section className="mb-8 rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-xl shadow-black/20 sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
            Admin Panel
          </p>

          <h1 className="mt-3 text-4xl font-black text-white">
            Badge Management
          </h1>

          <p className="mt-3 max-w-3xl text-emerald-50/70">
            Create custom badges and assign them to Isopedia contributors.
          </p>
        </section>

        {params.created === "true" && <Notice text="Badge created." />}
        {params.assigned === "true" && <Notice text="Badge assigned." />}
        {params.removed === "true" && <Notice text="Badge removed from user." />}
        {params.updated === "true" && <Notice text="Badge updated." />}
        {params.bulk && (
          <Notice
            text={`Criteria badge assignment complete. ${Number(params.bulk)} new assignment${Number(params.bulk) === 1 ? "" : "s"} added.`}
          />
        )}
        {params.ageBadges && (
          <Notice
            text={`Account-age badge sync complete. ${Number(params.ageBadges)} new assignment${Number(params.ageBadges) === 1 ? "" : "s"} added across ${Number(params.checked || 0)} checked profile${Number(params.checked || 0) === 1 ? "" : "s"}.`}
          />
        )}

        {params.error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {params.error}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
          <section className="rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-xl shadow-black/20">
            <h2 className="text-2xl font-bold text-white">Create Badge</h2>

            <form action={createBadge} className="mt-6 grid gap-5">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-emerald-50/80">
                  Badge Label *
                </span>

                <input
                  name="label"
                  placeholder="Example: Springtail Specialist"
                  className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                  required
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-emerald-50/80">
                  Description
                </span>

                <textarea
                  name="description"
                  rows={4}
                  placeholder="Short description of what this badge means."
                  className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-emerald-50/80">
                  Color
                </span>

                <select
                  name="color"
                  defaultValue="emerald"
                  className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                >
                  <option value="emerald">Emerald</option>
                  <option value="amber">Amber</option>
                  <option value="sky">Sky</option>
                  <option value="violet">Violet</option>
                  <option value="rose">Rose</option>
                  <option value="slate">Slate</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-emerald-50/80">
                  Icon / Emoji
                </span>

                <input
                  name="icon"
                  placeholder="Example: ⭐"
                  className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                />
              </label>

              <button
                type="submit"
                className="rounded-xl bg-emerald-400 px-6 py-3 font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Create Badge
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-xl shadow-black/20">
            <h2 className="text-2xl font-bold text-white">Assign Badge</h2>

            <form action={assignBadge} className="mt-6">
              <AdminBadgesAssignmentForm
                profiles={searchableProfiles}
                badges={activeBadges}
              />
            </form>

            <div className="mt-8">
              <h3 className="mb-4 text-lg font-bold text-white">
                Existing Badges
              </h3>

              <div className="grid gap-3">
                {allBadges.length > 0 ? (
                  allBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className="rounded-2xl border border-white/10 bg-[#0b140d]/70 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <BadgePill badge={badge} />

                          {badge.description && (
                            <p className="mt-3 text-sm leading-6 text-emerald-50/60">
                              {badge.description}
                            </p>
                          )}

                          {!badge.is_active && (
                            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-red-300">
                              Inactive
                            </p>
                          )}
                        </div>

                        <form action={toggleBadge}>
                          <input
                            type="hidden"
                            name="badge_id"
                            value={badge.id}
                          />

                          <input
                            type="hidden"
                            name="is_active"
                            value={String(badge.is_active)}
                          />

                          <button
                            type="submit"
                            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
                          >
                            {badge.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </form>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-emerald-50/50">No badges created yet.</p>
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Automatic Account-Age Badges
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50/65">
                These badges are issued automatically as profile accounts reach
                each milestone. The daily cron handles ongoing updates, and this
                button can backfill or rerun the sync at any time.
              </p>
            </div>

            <form action={runAccountAgeBadgeSync}>
              <button
                type="submit"
                className="rounded-xl bg-emerald-400 px-6 py-3 font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Sync Now
              </button>
            </form>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {ACCOUNT_AGE_BADGE_MILESTONES.map((milestone) => (
              <div
                key={milestone.key}
                className="rounded-2xl border border-white/10 bg-[#0b140d]/70 p-4"
              >
                <BadgePill
                  badge={{
                    id: milestone.key,
                    label: milestone.label,
                    description: milestone.description,
                    color: milestone.color,
                    icon: milestone.icon,
                    is_active: true,
                  }}
                />
                <p className="mt-3 text-sm leading-6 text-emerald-50/60">
                  {milestone.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-xl shadow-black/20">
          <h2 className="text-2xl font-bold text-white">Assign by Criteria</h2>
          <p className="mt-2 text-sm leading-6 text-emerald-50/65">
            Bulk-issue badges to matching accounts. Existing assignments are
            skipped, so these actions are safe to rerun.
          </p>

          <form action={assignBadgeByCriteria} className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_120px_120px_auto] lg:items-end">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-emerald-50/80">
                Badge
              </span>
              <select
                name="badge_id"
                required
                className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
              >
                <option value="">Choose badge</option>
                {activeBadges.map((badge) => (
                  <option key={badge.id} value={badge.id}>
                    {badge.icon ? `${badge.icon} ` : ""}
                    {badge.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-emerald-50/80">
                Criteria
              </span>
              <select
                name="criteria"
                defaultValue="first_accounts"
                className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
              >
                <option value="first_accounts">First accounts created</option>
                <option value="all_current">All current accounts</option>
                <option value="account_age_months">Accounts at least N months old</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-emerald-50/80">
                First N
              </span>
              <input
                name="limit"
                type="number"
                min="1"
                max="5000"
                defaultValue="10"
                className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-emerald-50/80">
                Months
              </span>
              <input
                name="months"
                type="number"
                min="1"
                max="240"
                defaultValue="12"
                className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
              />
            </label>

            <button
              type="submit"
              className="rounded-xl bg-emerald-400 px-6 py-3 font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Issue Badge
            </button>
          </form>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-xl shadow-black/20">
          <h2 className="text-2xl font-bold text-white">Assigned Badges</h2>

          <div className="mt-6 grid gap-4">
            {assignments && assignments.length > 0 ? (
              assignments.map((assignment) => {
                const badge = assignment.profile_badges;
                const profile = assignment.profiles;

                if (!badge || !profile) return null;

                const publicName =
                  profile.display_name ||
                  profile.business_name ||
                  profile.username ||
                  "Unknown User";

                return (
                  <div
                    key={assignment.id}
                    className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b140d]/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-bold text-white">{publicName}</p>

                      {profile.username && (
                        <Link
                          href={`${productionIsopediaUrl}/profile/${profile.username}`}
                          className="text-sm font-semibold text-emerald-300 hover:text-emerald-200"
                        >
                          @{profile.username}
                        </Link>
                      )}

                      <div className="mt-3">
                        <BadgePill badge={badge} />
                      </div>
                    </div>

                    <form action={removeAssignment}>
                      <input
                        type="hidden"
                        name="assignment_id"
                        value={assignment.id}
                      />

                      <button
                        type="submit"
                        className="rounded-xl bg-red-500/20 px-5 py-3 text-sm font-bold text-red-200 transition hover:bg-red-500/30"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                );
              })
            ) : (
              <p className="text-emerald-50/50">
                No badges have been assigned yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
      {text}
    </div>
  );
}

function BadgePill({ badge }: { badge: Badge }) {
  const colorClasses: Record<string, string> = {
    emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    green: "border-green-400/30 bg-green-400/10 text-green-200",
    cyan: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
    sky: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    violet: "border-violet-400/30 bg-violet-400/10 text-violet-200",
    rose: "border-rose-400/30 bg-rose-400/10 text-rose-200",
    slate: "border-slate-400/30 bg-slate-400/10 text-slate-200",
  };
  const iconClasses: Record<string, string> = {
    emerald: "border-emerald-200/40 bg-emerald-300 text-emerald-950",
    amber: "border-amber-200/40 bg-amber-300 text-amber-950",
    green: "border-green-200/40 bg-green-300 text-green-950",
    cyan: "border-cyan-200/40 bg-cyan-300 text-cyan-950",
    sky: "border-sky-200/40 bg-sky-300 text-sky-950",
    violet: "border-violet-200/40 bg-violet-300 text-violet-950",
    rose: "border-rose-200/40 bg-rose-300 text-rose-950",
    slate: "border-slate-200/40 bg-slate-300 text-slate-950",
  };
  const colorKey = badge.color || "emerald";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 text-xs font-black uppercase tracking-widest ${
        colorClasses[colorKey] || colorClasses.emerald
      }`}
    >
      {badge.icon && (
        <span
          aria-hidden="true"
          className={`grid h-6 min-w-6 place-items-center rounded-full border px-1.5 text-[10px] font-black leading-none tracking-normal shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_8px_rgba(0,0,0,0.22)] ${
            iconClasses[colorKey] || iconClasses.emerald
          }`}
        >
          {badge.icon}
        </span>
      )}
      {badge.label}
    </span>
  );
}
