import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabase-server";
import { deleteSpecies } from "./actions";

type SpeciesRow = {
  id: number;
  common_name: string;
  scientific_name: string | null;
  slug: string;
  organism_type: string | null;
  genus: string | null;
  species: string | null;
  morph: string | null;
  difficulty: string | null;
  image_url: string | null;
  created_at: string | null;
};

export default async function AdminIsopediaPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const [{ data: adminProfile }, { data: roleProfile }] = await Promise.all([
    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),

    supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle(),
  ]);

  const isAdminProfile = Boolean(adminProfile);
  const isRoleAdmin = roleProfile?.role === "admin";
  const isModerator = roleProfile?.role === "moderator";

  if (!isAdminProfile && !isRoleAdmin && !isModerator) {
    redirect("/admin/login");
  }

  const [
    speciesResult,
    submissionsCount,
    suggestedEditsCount,
    badgesCount,
    usersCount,
    moderatorsCount,
    adminsByRoleCount,
    adminProfilesCount,
    discussionReportsCount,
  ] = await Promise.all([
    supabase
      .from("isopedia_species")
      .select(
        `
        id,
        common_name,
        scientific_name,
        slug,
        organism_type,
        genus,
        species,
        morph,
        difficulty,
        image_url,
        created_at
      `
      )
      .order("common_name", { ascending: true })
      .returns<SpeciesRow[]>(),

    supabase
      .from("isopedia_submissions")
      .select("id", { count: "exact", head: true }),

    supabase
      .from("isopedia_suggested_edits")
      .select("id", { count: "exact", head: true }),

    supabase
      .from("profile_badges")
      .select("id", { count: "exact", head: true }),

    supabase.from("profiles").select("id", { count: "exact", head: true }),

    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "moderator"),

    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin"),

    supabase
      .from("admin_profiles")
      .select("id", { count: "exact", head: true }),

    supabase
      .from("isopedia_discussion_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
  ]);

  if (speciesResult.error) {
    throw new Error(speciesResult.error.message);
  }

  const species = speciesResult.data || [];

  const totalSpecies = species.length;
  const totalSubmissions = submissionsCount.count || 0;
  const totalSuggestedEdits = suggestedEditsCount.count || 0;
  const totalBadges = badgesCount.count || 0;
  const totalUsers = usersCount.count || 0;
  const totalModerators = moderatorsCount.count || 0;
  const totalDiscussionReports = discussionReportsCount.count || 0;

  const totalAdmins = Math.max(
    adminsByRoleCount.count || 0,
    adminProfilesCount.count || 0
  );

  const recentlyAdded = [...species]
    .filter((item) => item.created_at)
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-[#0c1710] px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-2xl shadow-black/30 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
              Isopedia Admin
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
              Admin Dashboard
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/65">
              Manage species, review community contributions, assign badges,
              moderate discussions, and prepare Isopedia for a polished public
              launch.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/isopedia"
              className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-3 text-sm font-bold text-emerald-200 transition hover:bg-[#18291d]"
            >
              View Public Site
            </Link>

            <Link
              href="/admin/isopedia/new"
              className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Add New Species
            </Link>
          </div>
        </div>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardStat
            label="Species"
            value={totalSpecies}
            description="Live database entries"
          />

          <DashboardStat
            label="Submissions"
            value={totalSubmissions}
            description="Community species submissions"
          />

          <DashboardStat
            label="Suggested Edits"
            value={totalSuggestedEdits}
            description="Corrections and improvements"
          />

          <DashboardStat
            label="Discussion Reports"
            value={totalDiscussionReports}
            description="Open community reports"
            alert={totalDiscussionReports > 0}
          />
        </section>

        <section className="mb-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-xl shadow-black/20">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
                  Quick Actions
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  Admin Tools
                </h2>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <AdminActionCard
                href="/admin/isopedia/new"
                title="Add Species"
                description="Create a new Isopedia species entry."
                icon="＋"
              />

              <AdminActionCard
                href="/admin/isopedia/discussions"
                title="Discussion Moderation"
                description={
                  totalDiscussionReports > 0
                    ? `${totalDiscussionReports} open report${
                        totalDiscussionReports === 1 ? "" : "s"
                      } need review.`
                    : "Review reported comments and community discussions."
                }
                icon="⚠️"
                alert={totalDiscussionReports > 0}
              />

              <AdminActionCard
                href="/admin/isopedia/badges"
                title="Manage Badges"
                description="Create badges and assign them to contributors."
                icon="🏅"
              />

              <AdminActionCard
                href="/admin/isopedia/roles"
                title="Role Management"
                description="Manage moderators and admins."
                icon="🛡️"
              />

              <AdminActionCard
                href="/isopedia/verify"
                title="Submission Queue"
                description="Review submitted species entries."
                icon="✓"
              />

              <AdminActionCard
                href="/isopedia/verify-edits"
                title="Suggested Edits"
                description="Review community edit suggestions."
                icon="✎"
              />

              <AdminActionCard
                href="/isopedia/verify-images"
                title="Image Queue"
                description="Review submitted gallery images."
                icon="🖼️"
              />

              <AdminActionCard
                href="/isopedia/review"
                title="Public Review Feed"
                description="Open the public-facing review area."
                icon="👁️"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-xl shadow-black/20">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
              Community
            </p>

            <h2 className="mt-2 text-2xl font-black text-white">
              Contributor System
            </h2>

            <div className="mt-5 grid gap-3">
              <MiniStat label="Registered Profiles" value={totalUsers} />
              <MiniStat label="Moderators" value={totalModerators} />
              <MiniStat label="Admins" value={totalAdmins} />
              <MiniStat label="Profile Badges" value={totalBadges} />
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-xl shadow-black/20">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
              Recently Added
            </p>

            <h2 className="mt-2 text-2xl font-black text-white">
              Newest Species
            </h2>

            <div className="mt-5 grid gap-3">
              {recentlyAdded.length > 0 ? (
                recentlyAdded.map((item) => (
                  <Link
                    key={item.id}
                    href={`/admin/isopedia/${item.id}/edit`}
                    className="rounded-2xl border border-white/10 bg-[#0b140d] p-4 transition hover:border-emerald-400/40 hover:bg-[#102016]"
                  >
                    <p className="font-black text-white">{item.common_name}</p>

                    <p className="mt-1 text-sm text-emerald-50/55">
                      {item.scientific_name || "No scientific name"}
                    </p>

                    <p className="mt-2 text-xs font-bold text-emerald-300">
                      Edit entry →
                    </p>
                  </Link>
                ))
              ) : (
                <p className="rounded-2xl border border-white/10 bg-[#0b140d] p-4 text-sm text-emerald-50/55">
                  No recent species yet.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-xl shadow-black/20">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
                  Species Manager
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  Database Entries
                </h2>
              </div>

              <Link
                href="/admin/isopedia/new"
                className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Add Species
              </Link>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10">
              {species.length > 0 ? (
                <div className="divide-y divide-white/10">
                  {species.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-4 bg-[#0b140d] p-4 md:grid-cols-[1fr_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-white">
                            {item.common_name}
                          </h3>

                          {item.organism_type && (
                            <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
                              {item.organism_type}
                            </span>
                          )}

                          {item.difficulty && (
                            <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200">
                              {item.difficulty}
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-sm text-emerald-50/55">
                          {item.scientific_name || "No scientific name"} ·
                          /isopedia/{item.slug}
                        </p>

                        {(item.genus || item.species || item.morph) && (
                          <p className="mt-2 text-xs font-semibold text-emerald-100/40">
                            {[item.genus, item.species, item.morph]
                              .filter(Boolean)
                              .join(" ")}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/isopedia/${item.slug}`}
                          className="rounded-lg border border-white/10 px-4 py-2 text-sm font-bold text-emerald-200 transition hover:bg-white/5"
                        >
                          View
                        </Link>

                        <Link
                          href={`/admin/isopedia/${item.id}/edit`}
                          className="rounded-lg border border-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/5"
                        >
                          Edit
                        </Link>

                        <form
                          action={deleteSpecies.bind(null, item.id, item.slug)}
                        >
                          <button
                            type="submit"
                            className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-bold text-red-200 transition hover:bg-red-400/20"
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#0b140d] p-8 text-center">
                  <p className="text-emerald-50/60">No species added yet.</p>

                  <Link
                    href="/admin/isopedia/new"
                    className="mt-4 inline-block rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950 transition hover:bg-emerald-300"
                  >
                    Add First Species
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function DashboardStat({
  label,
  value,
  description,
  alert = false,
}: {
  label: string;
  value: number;
  description: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-5 shadow-xl shadow-black/20 ${
        alert
          ? "border-red-400/30 bg-red-400/10"
          : "border-white/10 bg-[#142318]"
      }`}
    >
      <p
        className={`text-xs font-black uppercase tracking-[0.25em] ${
          alert ? "text-red-200" : "text-emerald-100/40"
        }`}
      >
        {label}
      </p>

      <p className="mt-3 text-4xl font-black text-white">{value}</p>

      <p
        className={`mt-2 text-sm leading-5 ${
          alert ? "text-red-100/70" : "text-emerald-50/55"
        }`}
      >
        {description}
      </p>
    </div>
  );
}

function AdminActionCard({
  href,
  title,
  description,
  icon,
  alert = false,
}: {
  href: string;
  title: string;
  description: string;
  icon: string;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-3xl border p-5 transition ${
        alert
          ? "border-red-400/30 bg-red-400/10 hover:bg-red-400/20"
          : "border-white/10 bg-[#0b140d] hover:border-emerald-400/40 hover:bg-[#102016]"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-xl ${
            alert
              ? "border-red-400/30 bg-red-400/10"
              : "border-emerald-400/20 bg-emerald-400/10"
          }`}
        >
          {icon}
        </div>

        <div>
          <h3
            className={`font-black ${
              alert ? "text-red-100" : "text-white group-hover:text-emerald-200"
            }`}
          >
            {title}
          </h3>

          <p
            className={`mt-2 text-sm leading-6 ${
              alert ? "text-red-100/70" : "text-emerald-50/55"
            }`}
          >
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3">
      <span className="text-sm font-bold text-emerald-50/65">{label}</span>
      <span className="text-xl font-black text-white">{value}</span>
    </div>
  );
}