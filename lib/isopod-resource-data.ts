import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCommunityDiscussions } from "@/lib/community";

export type ResourceSpecies = {
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

const popularNames = [
  "Panda King",
  "Dairy Cow",
  "Orange Cream",
  "Rubber Ducky",
  "Powder Orange",
  "Powder blue",
  "Red Panda",
  "Cherry Blossom",
];

function isIsopod(entry: ResourceSpecies) {
  return String(entry.organism_type || "").toLowerCase().includes("isopod");
}

function preferredOrder(left: ResourceSpecies, right: ResourceSpecies) {
  const leftIndex = popularNames.findIndex(
    (name) => name.toLowerCase() === left.common_name.toLowerCase()
  );
  const rightIndex = popularNames.findIndex(
    (name) => name.toLowerCase() === right.common_name.toLowerCase()
  );
  const leftRank = leftIndex === -1 ? 999 : leftIndex;
  const rightRank = rightIndex === -1 ? 999 : rightIndex;

  return leftRank - rightRank || left.common_name.localeCompare(right.common_name);
}

export async function getIsopodResourceData() {
  const supabase = await createSupabaseServerClient();

  const [speciesResult, galleryCoverResult, generalDiscussions, careDiscussions] =
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
        .returns<ResourceSpecies[]>(),

      supabase
        .from("isopedia_species_images")
        .select("species_id, image_url")
        .eq("status", "verified")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false })
        .returns<GalleryCoverImage[]>(),

      getCommunityDiscussions(supabase, {
        search: "isopod",
        limit: 3,
      }),

      getCommunityDiscussions(supabase, {
        categorySlug: "guides",
        limit: 3,
      }),
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

  const isopods = (speciesResult.data || [])
    .filter(isIsopod)
    .map((entry) => ({
      ...entry,
      image_url: entry.image_url || galleryCoverBySpeciesId.get(entry.id) || null,
    }));

  const popularSpecies = [...isopods].sort(preferredOrder).slice(0, 6);
  const beginnerSpecies = isopods
    .filter((entry) => String(entry.difficulty || "").toLowerCase().includes("beginner"))
    .slice(0, 6);
  const heroSpecies =
    popularSpecies.find((entry) => entry.image_url) ||
    isopods.find((entry) => entry.image_url) ||
    null;

  return {
    isopods,
    popularSpecies,
    beginnerSpecies,
    heroSpecies,
    generalDiscussions,
    careDiscussions,
  };
}
