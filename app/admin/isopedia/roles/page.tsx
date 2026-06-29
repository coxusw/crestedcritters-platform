import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { productionIsopediaUrl } from "@/lib/isopedia-site";

export const dynamic = "force-dynamic";

type Role = "user" | "moderator" | "admin";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  business_name: string | null;
  role: Role | null;
  created_at: string | null;
};

async function updateRole(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const [{ data: actingProfile }, { data: adminProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle(),

    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
  ]);

  const isAdmin = actingProfile?.role === "admin" || Boolean(adminProfile);

  if (!isAdmin) {
    redirect("/admin/isopedia/roles?error=not-authorized");
  }

  const profileId = String(formData.get("profile_id") || "");
  const newRole = String(formData.get("role") || "") as Role;

  if (!profileId) {
    redirect("/admin/isopedia/roles?error=missing-profile");
  }

  if (!["user", "moderator", "admin"].includes(newRole)) {
    redirect("/admin/isopedia/roles?error=invalid-role");
  }

  if (profileId === user.id && newRole !== "admin") {
    redirect("/admin/isopedia/roles?error=self-demotion");
  }

  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update({
      role: newRole,
    })
    .eq("id", profileId)
    .select("id, role")
    .maybeSingle();

  if (error) {
    redirect(`/admin/isopedia/roles?error=${encodeURIComponent(error.message)}`);
  }

  if (!updatedProfile || updatedProfile.role !== newRole) {
    redirect("/admin/isopedia/roles?error=role-not-updated");
  }

  revalidatePath("/admin/isopedia/roles");
  revalidatePath("/admin/isopedia");

  redirect("/admin/isopedia/roles?updated=true");
}

async function deleteProfile(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const [{ data: actingProfile }, { data: adminProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle(),

    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
  ]);

  const isAdmin = actingProfile?.role === "admin" || Boolean(adminProfile);
  if (!isAdmin) {
    redirect("/admin/isopedia/roles?error=not-authorized");
  }

  const profileId = String(formData.get("profile_id") || "");
  if (!profileId) {
    redirect("/admin/isopedia/roles?error=missing-profile");
  }

  if (profileId === user.id) {
    redirect("/admin/isopedia/roles?error=self-delete");
  }

  try {
    const adminSupabase = createSupabaseAdminClient();
    const { error: authError } = await adminSupabase.auth.admin.deleteUser(profileId);
    if (authError) throw authError;

    await adminSupabase.from("profiles").delete().eq("id", profileId);
  } catch (error) {
    redirect(
      `/admin/isopedia/roles?error=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`
    );
  }

  revalidatePath("/admin/isopedia/roles");
  revalidatePath("/admin/isopedia");
  redirect("/admin/isopedia/roles?deleted=true");
}

function getRoleBadge(role: string | null) {
  switch (role) {
    case "admin":
      return {
        label: "Admin",
        className: "border-red-400/30 bg-red-400/10 text-red-200",
      };

    case "moderator":
      return {
        label: "Moderator",
        className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
      };

    default:
      return {
        label: "User",
        className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
      };
  }
}

function formatAdminDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function RoleManagementPage({
  searchParams,
}: {
  searchParams?: Promise<{
    search?: string;
    updated?: string;
    deleted?: string;
    error?: string;
  }>;
}) {
  noStore();

  const params = await searchParams;
  const search = params?.search?.trim() || "";

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const [{ data: currentUserProfile }, { data: adminProfile }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle(),

      supabase
        .from("admin_profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  const isAdmin =
    currentUserProfile?.role === "admin" || Boolean(adminProfile);

  if (!isAdmin) {
    redirect("/admin/isopedia");
  }

  let query = supabase
    .from("profiles")
    .select(
      `
      id,
      username,
      display_name,
      business_name,
      role,
      created_at
    `
    )
    .order("username", { ascending: true, nullsFirst: false });

  if (search) {
    query = query.or(
      `username.ilike.%${search}%,display_name.ilike.%${search}%,business_name.ilike.%${search}%`
    );
  }

  const { data: profiles, error } = await query.returns<Profile[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className="min-h-screen bg-[#0c1710] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
                Isopedia Admin
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
                Role Management
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/65">
                Promote moderators, manage admins, and control platform
                permissions for the Isopedia community team.
              </p>
            </div>

            <a
              href="/admin/isopedia"
              className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-3 text-sm font-bold text-emerald-200 transition hover:bg-[#18291d]"
            >
              ← Admin Dashboard
            </a>
          </div>
        </div>

        {params?.updated === "true" && (
          <Notice type="success" text="Role updated successfully." />
        )}

        {params?.deleted === "true" && (
          <Notice type="success" text="Profile deleted successfully." />
        )}

        {params?.error && (
          <Notice
            type="error"
            text={
              params.error === "self-demotion"
                ? "You cannot remove your own admin role."
                : params.error === "self-delete"
                  ? "You cannot delete your own profile."
                : params.error === "not-authorized"
                  ? "Only admins can manage roles."
                  : params.error === "role-not-updated"
                    ? "The role was not updated. This is usually caused by Supabase RLS blocking the update."
                    : params.error
            }
          />
        )}

        <section className="mb-6 rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-xl shadow-black/20">
          <form className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search username, display name, or business..."
              className="flex-1 rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none transition focus:border-emerald-400/40"
            />

            <button
              type="submit"
              className="rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Search
            </button>
          </form>
        </section>

        <section className="grid gap-4">
          {profiles && profiles.length > 0 ? (
            profiles.map((profile) => {
              const role = profile.role || "user";
              const roleBadge = getRoleBadge(role);

              const displayName =
                profile.business_name ||
                profile.display_name ||
                profile.username ||
                "Unnamed User";

              const isSelf = profile.id === user.id;

              return (
                <div
                  key={profile.id}
                  className="rounded-3xl border border-white/10 bg-[#142318] p-5 shadow-xl shadow-black/20"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-2xl font-black text-white">
                          {displayName}
                        </h2>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${roleBadge.className}`}
                        >
                          {roleBadge.label}
                        </span>

                        {isSelf && (
                          <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-black text-sky-200">
                            You
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-emerald-50/60">
                        {profile.username ? (
                          <>
                            <a
                              href={`${productionIsopediaUrl}/profile/${profile.username}`}
                              className="font-semibold text-emerald-300 hover:text-emerald-200"
                            >
                              Username: {profile.username}
                            </a>
                            <span>Created: {formatAdminDate(profile.created_at)}</span>

                            <a
                              href={`${productionIsopediaUrl}/profile/${profile.username}`}
                              className="font-bold text-emerald-300 hover:text-emerald-200"
                            >
                              View Profile →
                            </a>
                          </>
                        ) : (
                          <>
                            <span>No username set</span>
                            <span>Created: {formatAdminDate(profile.created_at)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <form action={updateRole} className="flex flex-wrap gap-2">
                        <input
                          type="hidden"
                          name="profile_id"
                          value={profile.id}
                        />

                        <button
                          type="submit"
                          name="role"
                          value="user"
                          disabled={role === "user" || isSelf}
                          className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#18291d] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          User
                        </button>

                        <button
                          type="submit"
                          name="role"
                          value="moderator"
                          disabled={role === "moderator" || isSelf}
                          className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Moderator
                        </button>

                        <button
                          type="submit"
                          name="role"
                          value="admin"
                          disabled={role === "admin"}
                          className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-bold text-red-200 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Admin
                        </button>
                      </form>

                      <form action={deleteProfile} className="flex justify-end">
                        <input
                          type="hidden"
                          name="profile_id"
                          value={profile.id}
                        />
                        <button
                          type="submit"
                          disabled={isSelf}
                          className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Delete Profile
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-3xl border border-white/10 bg-[#142318] p-8 text-center shadow-xl shadow-black/20">
              <p className="text-emerald-50/60">No matching profiles found.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Notice({ type, text }: { type: "success" | "error"; text: string }) {
  const classes =
    type === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : "border-red-500/30 bg-red-500/10 text-red-200";

  return <div className={`mb-6 rounded-2xl border p-4 ${classes}`}>{text}</div>;
}
