import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { publicSpeciesSlug } from "@/lib/isopedia-slugs";
import HomepageStructuredData from "@/app/components/isopedia/HomepageStructuredData";
import IsopediaBrowser from "@/app/components/isopedia/IsopediaBrowser";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import { IsopediaInstallCard } from "@/app/components/isopedia/IsopediaAppSettings";
import { isopediaMetadata } from "@/app/isopedia/metadata";

export const metadata = isopediaMetadata;

export default async function IsopediaPage() {
  redirect("/");
}

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

type GalleryCoverImage = {
  species_id: number;
  image_url: string | null;
};

export async function IsopediaLandingPage() {
  const supabase = await createSupabaseServerClient();

  const [
    speciesResult,
    galleryCoverResult,
    submissionsResult,
    editsResult,
    imagesResult,
    exposResult,
  ] = await Promise.all([
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
      .from("isopedia_species_images")
      .select("species_id, image_url")
      .eq("status", "verified")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<GalleryCoverImage[]>(),

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

    supabase
      .from("isopedia_expos")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),
  ]);

  if (speciesResult.error) {
    throw new Error(speciesResult.error.message);
  }

  if (galleryCoverResult.error) {
    throw new Error(galleryCoverResult.error.message);
  }

  const galleryCoverBySpeciesId = new Map<number, string>();

  for (const image of galleryCoverResult.data || []) {
    if (!image.image_url || galleryCoverBySpeciesId.has(image.species_id)) {
      continue;
    }

    galleryCoverBySpeciesId.set(image.species_id, image.image_url);
  }

  const entries = (speciesResult.data || []).map((entry) => ({
    ...entry,
    image_url: entry.image_url || galleryCoverBySpeciesId.get(entry.id) || null,
  }));
  const totalSpecies = entries.length;

  const pendingReviews =
    (submissionsResult.count || 0) +
    (editsResult.count || 0) +
    (imagesResult.count || 0);

  const approvedExpos = exposResult.count || 0;

  return (
    <main className="isopedia-theme-root min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <HomepageStructuredData
        species={entries.map((entry) => ({
          common_name: entry.common_name,
          scientific_name: entry.scientific_name,
          slug: publicSpeciesSlug(entry.slug),
          image_url: entry.image_url,
        }))}
      />

      <div className="mx-auto max-w-7xl">
        <IsopediaNav active="database" />

        <section className="isopedia-hero-shell mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#102016] shadow-2xl shadow-black/30">
          <div className="isopedia-hero-panel bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_36%),linear-gradient(135deg,rgba(6,78,59,0.48),rgba(7,19,12,0.95))] px-4 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
            <div className="mx-auto max-w-4xl text-center">
              <p className="isopedia-theme-kicker text-[10px] font-black uppercase tracking-[0.28em] text-emerald-300 sm:text-xs sm:tracking-[0.35em]">
                Community Care Database
              </p>

              <h1 className="isopedia-theme-heading mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Isopedia
              </h1>

              <p className="isopedia-theme-muted mx-auto mt-4 max-w-3xl text-sm leading-7 text-emerald-50/80 sm:text-base lg:text-lg">
                A community-verified care guide database for isopods,
                springtails, millipedes, beetles, and other bioactive cleanup
                crew species.
              </p>

              <div className="mx-auto mt-7 grid max-w-4xl gap-3 sm:grid-cols-3 sm:gap-4">
                <SmallStatCard label="Verified Entries" value={totalSpecies} />

                <SmallStatCard label="Approved Expos" value={approvedExpos} />

                <SmallStatCard label="Pending Reviews" value={pendingReviews} />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-5 grid max-w-5xl gap-4 rounded-2xl border border-emerald-400/25 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(7,19,12,0.72))] p-5 shadow-xl shadow-black/20 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">
              New To Isopods?
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/72">
              Learn the basics, then jump into verified species profiles,
              member guides, and community discussions.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 sm:justify-end">
            <Link
              href="/isopods"
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
            >
              What Are Isopods?
            </Link>
            <Link
              href="/isopod-care"
              className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Isopod Care Guide
            </Link>
          </div>
        </section>

        <IsopediaInstallCard />

        <div className="mx-auto max-w-5xl">
          <IsopediaBrowser species={entries} />
        </div>
      </div>
    </main>
  );
}

function SmallStatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="isopedia-stat-card rounded-2xl border border-white/10 bg-black/20 p-4 text-center shadow-xl shadow-black/20 sm:rounded-3xl sm:p-5">
      <p className="isopedia-theme-kicker text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300/80 sm:text-xs sm:tracking-[0.25em]">
        {label}
      </p>

      <p className="isopedia-theme-heading mt-2 text-4xl font-black text-white sm:mt-3 sm:text-5xl">
        {value}
      </p>
    </div>
  );
}
