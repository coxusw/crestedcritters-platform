const cleanSpeciesSlugByStoredSlug: Record<string, string> = {
  "porcellio-laevis-dairy-cow-dairy-cow": "dairy-cow-isopod",
  "cubaris-sp-red-panda-red-panda": "red-panda-isopod",
  "armadillidium-gestroi-gold-spot-gestroi-gold-spot": "gestroi-gold-spot-isopod",
};

const storedSpeciesSlugByCleanSlug = Object.fromEntries(
  Object.entries(cleanSpeciesSlugByStoredSlug).map(([stored, clean]) => [
    clean,
    stored,
  ])
);

export function publicSpeciesSlug(storedSlug: string) {
  return cleanSpeciesSlugByStoredSlug[storedSlug] || storedSlug;
}

export function storedSpeciesSlug(publicSlug: string) {
  return storedSpeciesSlugByCleanSlug[publicSlug] || publicSlug;
}

export function isLegacySpeciesSlug(slug: string) {
  return publicSpeciesSlug(slug) !== slug;
}
