import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { productionIsopediaUrl } from "@/lib/isopedia-site";
import AdminBadgesAssignmentForm from "@/app/components/isopedia/AdminBadgesAssignmentForm";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  business_name: string | null;
  role: string | null;
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

export default async function AdminBadgesPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    assigned?: string;
    removed?: string;
    updated?: string;
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
    .select("id, username, display_name, business_name, role")
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
    sky: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    violet: "border-violet-400/30 bg-violet-400/10 text-violet-200",
    rose: "border-rose-400/30 bg-rose-400/10 text-rose-200",
    slate: "border-slate-400/30 bg-slate-400/10 text-slate-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-widest ${
        colorClasses[badge.color] || colorClasses.emerald
      }`}
    >
      {badge.icon ? `${badge.icon} ` : ""}
      {badge.label}
    </span>
  );
}
