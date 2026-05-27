import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import IsopediaBrowser from "@/app/components/isopedia/IsopediaBrowser";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
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

export async function IsopediaLandingPage() {
  const supabase = await createSupabaseServerClient();

  const [
    speciesResult,
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

  const entries = speciesResult.data || [];
  const totalSpecies = entries.length;

  const pendingReviews =
    (submissionsResult.count || 0) +
    (editsResult.count || 0) +
    (imagesResult.count || 0);

  const approvedExpos = exposResult.count || 0;

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <IsopediaNav active="database" />

        <section className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#102016] shadow-2xl shadow-black/30">
          <div className="bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_36%),linear-gradient(135deg,rgba(6,78,59,0.48),rgba(7,19,12,0.95))] px-4 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-300 sm:text-xs sm:tracking-[0.35em]">
                Community Care Database
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Isopedia
              </h1>

              <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-emerald-50/80 sm:text-base lg:text-lg">
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
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center shadow-xl shadow-black/20 sm:rounded-3xl sm:p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300/80 sm:text-xs sm:tracking-[0.25em]">
        {label}
      </p>

      <p className="mt-2 text-4xl font-black text-white sm:mt-3 sm:text-5xl">
        {value}
      </p>
    </div>
  );
}
