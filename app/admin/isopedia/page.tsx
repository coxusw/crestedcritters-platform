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
    expoCount,
    pendingExpoCount,
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
      .select("id", { count: "exact", head: true })
      .eq("status", "unverified"),
    supabase
      .from("isopedia_suggested_edits")
      .select("id", { count: "exact", head: true }),
    supabase.from("profile_badges").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "moderator"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin"),
    supabase.from("admin_profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("isopedia_discussion_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase.from("isopedia_expos").select("id", { count: "exact", head: true }),
    supabase
      .from("isopedia_expos")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
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
  const totalExpos = expoCount.count || 0;
  const totalPendingExpos = pendingExpoCount.count || 0;

  const totalAdmins = Math.max(
    adminsByRoleCount.count || 0,
    adminProfilesCount.count || 0
  );

  const recentlyAdded = [...species]
    .filter((item) => item.created_at)
    .sort((a, b) => {
      const aTime = itemTime(a.created_at);
      const bTime = itemTime(b.created_at);
      return bTime - aTime;
    })
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
            Isopedia Admin
          </p>
          <h1 className="mt-3 text-3xl font-bold">Admin Dashboard</h1>
          <p className="mt-3 max-w-3xl text-slate-300">
            Manage species, expo systems, community contributions, badges,
            discussions, moderation tools, and public Isopedia infrastructure.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/isopedia"
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
            >
              View Public Site
            </Link>
            <Link
              href="/admin/isopedia/new"
              className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300"
            >
              Add New Species
            </Link>
            <Link
              href="/admin/content-agent"
              className="rounded-2xl bg-sky-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-sky-300"
            >
              Facebook Agent
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <DashboardStat
            label="Verified Species"
            value={totalSpecies}
            description="Published database entries."
          />
          <DashboardStat
            label="Need Verification"
            value={totalSubmissions}
            description="Species submissions with status unverified."
            alert={totalSubmissions > 0}
          />
          <DashboardStat
            label="Suggested Edits"
            value={totalSuggestedEdits}
            description="Community improvements and corrections."
            alert={totalSuggestedEdits > 0}
          />
          <DashboardStat
            label="Contributors"
            value={totalUsers}
            description="Profiles in the community system."
          />
          <DashboardStat
            label="Expos"
            value={totalExpos}
            description={`${totalPendingExpos} pending expo${
              totalPendingExpos === 1 ? "" : "s"
            }.`}
            alert={totalPendingExpos > 0}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Admin Tools</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <AdminActionCard
                href="/admin/isopedia/badges"
                title="Badge Manager"
                description={`${totalBadges} badge assignment${totalBadges === 1 ? "" : "s"} active.`}
                icon="🏅"
              />
              <AdminActionCard
                href="/admin/isopedia/roles"
                title="Role Manager"
                description={`${totalAdmins} admin${totalAdmins === 1 ? "" : "s"} / ${totalModerators} moderator${totalModerators === 1 ? "" : "s"}.`}
                icon="🛡️"
              />
              <AdminActionCard
                href="/admin/isopedia/expos"
                title="Expo Manager"
                description={
                  totalPendingExpos > 0
                    ? `${totalPendingExpos} pending expo${totalPendingExpos === 1 ? "" : "s"} need review.`
                    : "Approve, edit, delete, and manage expo calendar entries."
                }
                icon="📅"
                alert={totalPendingExpos > 0}
              />
              <AdminActionCard
                href="/admin/isopedia/discussions"
                title="Discussion Moderation"
                description={
                  totalDiscussionReports > 0
                    ? `${totalDiscussionReports} open report${totalDiscussionReports === 1 ? "" : "s"} need review.`
                    : "Review reported comments and community discussions."
                }
                icon="⚠️"
                alert={totalDiscussionReports > 0}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">
              Community
            </p>
            <h2 className="mt-2 text-xl font-semibold">Contributor System</h2>
            <div className="mt-5 grid gap-3">
              <MiniStat label="Profiles" value={totalUsers} />
              <MiniStat label="Badge assignments" value={totalBadges} />
              <MiniStat label="Suggested edits" value={totalSuggestedEdits} />
              <MiniStat label="Species needing verification" value={totalSubmissions} />
              <MiniStat label="Open discussion reports" value={totalDiscussionReports} />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">
                Recently Added
              </p>
              <h2 className="mt-2 text-xl font-semibold">Newest Species</h2>
            </div>
            <Link
              href="/admin/isopedia/new"
              className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300"
            >
              Add Species
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {recentlyAdded.length > 0 ? (
              recentlyAdded.map((item) => (
                <Link
                  key={item.id}
                  href={`/isopedia/${item.slug}`}
                  className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 transition hover:-translate-y-0.5 hover:border-emerald-300/50"
                >
                  <h3 className="font-bold text-slate-100">{item.common_name}</h3>
                  <p className="mt-1 text-sm italic text-slate-400">
                    {item.scientific_name || "No scientific name"}
                  </p>
                  <p className="mt-3 text-xs text-emerald-300">View entry →</p>
                </Link>
              ))
            ) : (
              <p className="text-slate-400">No recent species yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">
                Species Manager
              </p>
              <h2 className="mt-2 text-xl font-semibold">Database Entries</h2>
            </div>
            <Link
              href="/admin/isopedia/new"
              className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300"
            >
              Add Species
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {species.length > 0 ? (
              species.map((item) => (
                <article
                  key={item.id}
                  className="rounded-3xl border border-white/10 bg-slate-900/70 p-5"
                >
                  <h3 className="text-lg font-bold">{item.common_name}</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {item.scientific_name || "No scientific name"} · /isopedia/
                    {item.slug}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {item.organism_type && (
                      <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-emerald-200">
                        {item.organism_type}
                      </span>
                    )}
                    {item.difficulty && (
                      <span className="rounded-full bg-sky-400/10 px-3 py-1 text-sky-200">
                        {item.difficulty}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 text-sm">
                    <Link className="text-emerald-300 underline" href={`/isopedia/${item.slug}`}>
                      View
                    </Link>
                    <Link className="text-sky-300 underline" href={`/admin/isopedia/${item.id}/edit`}>
                      Edit
                    </Link>
                    <form action={deleteSpecies}>
                      <input type="hidden" name="id" value={String(item.id)} />
                      <button className="text-red-300 underline" type="submit">
                        Delete
                      </button>
                    </form>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 text-center text-slate-400">
                No species added yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function itemTime(value: string | null) {
  return value ? new Date(value).getTime() : 0;
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
      className={`rounded-3xl border p-5 ${
        alert
          ? "border-amber-400/40 bg-amber-400/10"
          : "border-white/10 bg-white/5"
      }`}
    >
      <div className="text-sm uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-3 text-3xl font-black">{value}</div>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
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
      className={`rounded-3xl border p-5 transition hover:-translate-y-0.5 ${
        alert
          ? "border-amber-400/40 bg-amber-400/10"
          : "border-white/10 bg-slate-900/70 hover:border-emerald-300/50"
      }`}
    >
      <div className="text-2xl">{icon}</div>
      <h3 className="mt-3 font-bold">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </Link>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-900/80 p-4">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
