import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import IsopediaBrowser from "@/app/components/isopedia/IsopediaBrowser";

type Species = {
  id: number;
  organism_type: string | null;
  genus: string | null;
  species: string | null;
  morph: string | null;
  trade_names: string | null;
  common_name: string;
  scientific_name: string | null;
  slug: string;
  difficulty: string | null;
  temperature: string | null;
  humidity: string | null;
  image_url: string | null;
};

type Profile = {
  id: string;
  username: string | null;
  role: string | null;
};

export default async function IsopediaPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  let isAdmin = false;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, role")
      .eq("id", user.id)
      .maybeSingle<Profile>();

    profile = data;

    const { data: adminProfile } = await supabase
      .from("admin_profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    isAdmin = profile?.role === "admin" || Boolean(adminProfile);
  }

  const [speciesResult, submissionsResult, editsResult, imagesResult] =
    await Promise.all([
      supabase
        .from("isopedia_species")
        .select(
          `
          id,
          organism_type,
          genus,
          species,
          morph,
          trade_names,
          common_name,
          scientific_name,
          slug,
          difficulty,
          temperature,
          humidity,
          image_url
        `
        )
        .order("common_name", { ascending: true })
        .returns<Species[]>(),

      supabase
        .from("isopedia_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "unverified"),

      supabase
        .from("isopedia_suggested_edits")
        .select("id", { count: "exact", head: true })
        .eq("status", "unverified"),

      supabase
        .from("isopedia_species_images")
        .select("id", { count: "exact", head: true })
        .eq("status", "unverified"),
    ]);

  if (speciesResult.error) {
    throw new Error(speciesResult.error.message);
  }

  const entries = speciesResult.data || [];
  const totalSpecies = entries.length;

  const pendingReviews =
    (submissionsResult.count || 0) +
    (editsResult.count || 0) +
    (imagesResult.count || 0);

  const username = profile?.username;

  return (
    <main className="min-h-screen bg-[#0c1710] text-white">
      <header className="border-b border-emerald-900/40 bg-[#0b140d]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/crest-logo.png"
              alt="Crested Critters logo"
              className="h-16 w-16 rounded-full object-contain"
            />

            <div>
              <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
                Crested Critters
              </p>

              <p className="text-xs font-semibold text-emerald-50/60">
                Powered by Crested Critters
              </p>
            </div>
          </Link>

          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Link
                href="/admin/isopedia"
                className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-3 text-sm font-black text-amber-200 transition hover:bg-amber-400/20"
              >
                Admin Panel
              </Link>
            )}

            <Link
              href="/isopedia/submit"
              className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-300"
            >
              Submit Species
            </Link>

            <Link
              href="/isopedia/review"
              className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
            >
              Review Queue
            </Link>

            {username ? (
              <>
                <Link
                  href={`/profile/${username}`}
                  className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
                >
                  My Profile
                </Link>

                <Link
                  href={`/isopedia/collection/${username}`}
                  className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
                >
                  My Collection
                </Link>

                <Link
                  href="/logout"
                  className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-200 transition hover:bg-red-500/20"
                >
                  Logout
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login?next=/isopedia"
                  className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
                >
                  Login
                </Link>

                <Link
                  href="/account"
                  className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/20"
                >
                  Create Profile
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="border-b border-emerald-900/40 bg-gradient-to-br from-[#183521] via-[#102117] to-[#0c1710]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
                Community Care Database
              </p>

              <h1 className="mt-4 text-5xl font-black tracking-tight text-white sm:text-6xl">
                Isopedia
              </h1>

              <p className="mt-5 max-w-3xl text-lg leading-8 text-emerald-50/85">
                A community-verified care guide database for isopods,
                springtails, millipedes, beetles, and other bioactive cleanup
                crew species.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SmallStatCard
                label="Verified Entries"
                value={totalSpecies}
                href="/isopedia"
              />

              <SmallStatCard
                label="Pending Reviews"
                value={pendingReviews}
                href="/isopedia/review"
              />
            </div>
          </div>
        </div>
      </section>

      <IsopediaBrowser species={entries} />
    </main>
  );
}

function SmallStatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl border border-white/10 bg-black/20 p-5 shadow-xl shadow-black/20 transition hover:border-emerald-400/40 hover:bg-black/30"
    >
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-100/50">
        {label}
      </p>

      <p className="mt-3 text-4xl font-black text-white">{value}</p>
    </Link>
  );
}