type GalleryReviewCandidate = {
  id: string;
  species_id: number | null;
  image_url: string | null;
  isopedia_species?:
    | {
        image_url?: string | null;
      }
    | Array<{
        image_url?: string | null;
      }>
    | null;
};

type VerifiedGalleryImage = {
  species_id: number | null;
  image_url: string | null;
};

function galleryKey(speciesId: number | null, imageUrl: string | null) {
  return `${speciesId || "unknown"}:${String(imageUrl || "").trim()}`;
}

export function filterReviewableGalleryImages<T extends GalleryReviewCandidate>(
  images: T[] | null | undefined,
  verifiedImages: VerifiedGalleryImage[] | null | undefined = []
) {
  const verifiedKeys = new Set(
    (verifiedImages || []).map((image) => galleryKey(image.species_id, image.image_url))
  );
  const seenPendingKeys = new Set<string>();

  return (images || []).filter((image) => {
    const key = galleryKey(image.species_id, image.image_url);
    const species = Array.isArray(image.isopedia_species)
      ? image.isopedia_species[0]
      : image.isopedia_species;

    if (!image.image_url) return false;
    if (seenPendingKeys.has(key)) return false;
    if (verifiedKeys.has(key)) return false;
    if (image.image_url === species?.image_url) return false;

    seenPendingKeys.add(key);
    return true;
  });
}
