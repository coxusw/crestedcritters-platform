import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { absoluteIsopediaUrl } from "@/lib/isopedia-site";
import { publicSpeciesSlug, storedSpeciesSlug } from "@/lib/isopedia-slugs";
import CollectionButtons from "@/app/components/isopedia/CollectionButtons";
import DiscussionStructuredData from "@/app/components/isopedia/DiscussionStructuredData";
import DiscussionSection from "@/app/components/isopedia/DiscussionSection";
import SpeciesQrButton from "@/app/components/isopedia/SpeciesQrButton";
import SpeciesStructuredData from "@/app/components/isopedia/SpeciesStructuredData";
import SpeciesImageCarousel, {
  type SpeciesCarouselImage,
} from "@/app/components/isopedia/SpeciesImageCarousel";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

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
  origin: string | null;
  temperature: string | null;
  humidity: string | null;
  diet: string | null;
  substrate: string | null;
  notes: string | null;
  image_url: string | null;
  updated_at: string | null;
};

type CollectionItem = {
  status: string;
};

type GalleryImage = {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string | null;
  profiles: {
    username: string | null;
    display_name: string | null;
    business_name: string | null;
  } | null;
};

type RelatedSpecies = {
  id: number;
  common_name: string;
  scientific_name: string | null;
  slug: string;
  image_url: string | null;
  genus: string | null;
  species: string | null;
  morph: string | null;
  difficulty: string | null;
};

type DiscussionComment = {
  id: string;
  parent_id: string | null;
  user_id: string;
  body: string;
  status: "active" | "hidden" | "deleted";
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  profiles: {
    username: string | null;
    display_name: string | null;
    business_name: string | null;
  } | null;
};

function cleanRichText(html: string | null) {
  if (!html) return "";

  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "h1",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "hr",
      "span",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      span: ["style"],
      p: ["style"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    },
  });
}

function stripHtml(value: string | null) {
  if (!value) return "";

  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function galleryCreditName(image: GalleryImage) {
  return (
    image.profiles?.display_name ||
    image.profiles?.business_name ||
    image.profiles?.username ||
    "Community contributor"
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const lookupSlug = storedSpeciesSlug(slug);

  const { data: species } = await supabase
    .from("isopedia_species")
    .select(
      `
      common_name,
      scientific_name,
      slug,
      organism_type,
      difficulty,
      notes,
      image_url
    `
    )
    .eq("slug", lookupSlug)
    .maybeSingle<{
      common_name: string;
      scientific_name: string | null;
      slug: string;
      organism_type: string | null;
      difficulty: string | null;
      notes: string | null;
      image_url: string | null;
    }>();

  if (!species) {
    return {
      title: "Species Not Found | Isopedia",
    };
  }

  const title = `${species.common_name} Care Guide`;
  const description =
    stripHtml(species.notes) ||
    `${species.common_name} care information on Isopedia.`;

  const image =
    species.image_url ||
    absoluteIsopediaUrl("/isopedia-social-preview.jpg");
  const canonicalSlug = publicSpeciesSlug(species.slug);
  const canonical = absoluteIsopediaUrl(`/${canonicalSlug}`);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article",
      images: [
        {
          url: image,
          alt: species.common_name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function SpeciesPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const lookupSlug = storedSpeciesSlug(slug);

  const { data: species, error } = await supabase
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
      origin,
      temperature,
      humidity,
      diet,
      substrate,
      notes,
      image_url,
      updated_at
    `
    )
    .eq("slug", lookupSlug)
    .maybeSingle<Species>();

  if (error || !species) {
    notFound();
  }

  const canonicalSlug = publicSpeciesSlug(species.slug);

  if (slug !== canonicalSlug) {
    permanentRedirect(`/${canonicalSlug}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let collectionItems: CollectionItem[] = [];
  let canAccessAdmin = false;

  if (user) {
    const [{ data }, { data: profile }, { data: adminProfile }] =
      await Promise.all([
        supabase
          .from("isopedia_user_species")
          .select("status")
          .eq("user_id", user.id)
          .eq("species_id", species.id)
          .returns<CollectionItem[]>(),
        supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle<{ role: string | null }>(),
        supabase
          .from("admin_profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

    collectionItems = data || [];
    canAccessAdmin =
      Boolean(adminProfile) ||
      profile?.role === "admin" ||
      profile?.role === "moderator";
  }

  const initialOwned = collectionItems.some((item) => item.status === "owned");
  const initialWishlist = collectionItems.some(
    (item) => item.status === "wishlist"
  );

  const safeNotesHtml = cleanRichText(species.notes);

  const seoDescription =
    stripHtml(species.notes) ||
    `${species.common_name} care guide and species information on Isopedia.`;

  const { data: galleryImages } = await supabase
    .from("isopedia_species_images")
    .select(
      `
      id,
      image_url,
      caption,
      created_at,
      profiles:credit_user_id (
        username,
        display_name,
        business_name
      )
    `
    )
    .eq("species_id", species.id)
    .eq("status", "verified")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<GalleryImage[]>();

  const { data: discussionComments } = await supabase
    .from("isopedia_discussions")
    .select(
      `
      id,
      parent_id,
      user_id,
      body,
      status,
      created_at,
      edited_at,
      deleted_at,
      profiles:user_id (
        username,
        display_name,
        business_name
      )
    `
    )
    .eq("entity_type", "species")
    .eq("entity_id", String(species.id))
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .returns<DiscussionComment[]>();

  let relatedQuery = supabase
    .from("isopedia_species")
    .select(
      `
      id,
      common_name,
      scientific_name,
      slug,
      image_url,
      genus,
      species,
      morph,
      difficulty
    `
    )
    .neq("id", species.id)
    .limit(6);

  if (species.genus) {
    relatedQuery = relatedQuery.eq("genus", species.genus);
  }

  const { data: relatedSpecies } =
    await relatedQuery.returns<RelatedSpecies[]>();

  const carouselImages: SpeciesCarouselImage[] = [
    ...(species.image_url
      ? [
          {
            id: "primary",
            imageUrl: species.image_url,
            alt: species.common_name,
            caption: "Primary species image.",
            creditName: "Isopedia",
            isPrimary: true,
          },
        ]
      : []),
    ...((galleryImages || []).map((image) => ({
      id: image.id,
      imageUrl: image.image_url,
      alt: image.caption || species.common_name,
      caption: image.caption,
      creditName: galleryCreditName(image),
      isPrimary: false,
    })) satisfies SpeciesCarouselImage[]),
  ];

  return (
    <>
      <SpeciesStructuredData
        speciesName={species.common_name}
        scientificName={species.scientific_name}
        slug={canonicalSlug}
        description={seoDescription}
        imageUrl={species.image_url}
        organismType={species.organism_type}
        genus={species.genus}
        species={species.species}
        morph={species.morph}
        difficulty={species.difficulty}
        origin={species.origin}
        temperature={species.temperature}
        humidity={species.humidity}
      />

      <DiscussionStructuredData
        pagePath={`/${canonicalSlug}`}
        pageTitle={species.common_name}
        comments={discussionComments || []}
      />

      <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
        <section className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/"
              className="text-sm font-bold text-emerald-300 hover:text-emerald-200"
            >
              ← Back to Isopedia
            </Link>

            <div className="flex flex-wrap gap-2">
              <SpeciesQrButton
                speciesName={species.common_name}
                speciesSlug={canonicalSlug}
              />

              <Link
                href={`/${canonicalSlug}/suggest-edit`}
                className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Suggest Edit
              </Link>

              <Link
                href={`/${canonicalSlug}/submit-image`}
                className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-200"
              >
                Add Image
              </Link>

              {!canAccessAdmin && (
                <Link
                  href="/review"
                  className="rounded-xl border border-white/10 bg-[#102016] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#14311f]"
                >
                  Review Queue
                </Link>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#102016] shadow-2xl shadow-black/30">
            <div className="grid gap-0 lg:grid-cols-[420px_1fr]">
              <div className="border-b border-white/10 bg-[#07130c]/70 p-4 lg:border-b-0 lg:border-r">
                <SpeciesImageCarousel
                  images={carouselImages}
                  speciesName={species.common_name}
                />

                <div className="mt-4">
                  <CollectionButtons
                    speciesId={species.id}
                    isLoggedIn={Boolean(user)}
                    initialOwned={initialOwned}
                    initialWishlist={initialWishlist}
                  />
                </div>
              </div>

              <div className="p-5 sm:p-8">
                <div className="mb-6">
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.3em] text-emerald-300 sm:text-sm">
                    {species.organism_type || "Isopedia Species Profile"}
                  </p>

                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                    {species.common_name}
                  </h1>

                  {species.scientific_name && (
                    <p className="mt-3 text-lg italic text-emerald-50/70">
                      {species.scientific_name}
                    </p>
                  )}
                </div>

                <div className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                  <h2 className="mb-3 text-lg font-black text-white">
                    Taxonomy / ID
                  </h2>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoCard label="Type" value={species.organism_type} />
                    <InfoCard label="Genus" value={species.genus} />
                    <InfoCard label="Species" value={species.species} />
                    <InfoCard label="Morph" value={species.morph} />
                    <InfoCard label="Trade Names" value={species.trade_names} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoCard label="Difficulty" value={species.difficulty} />
                  <InfoCard label="Origin" value={species.origin} />
                  <InfoCard label="Temperature" value={species.temperature} />
                  <InfoCard label="Humidity" value={species.humidity} />
                  <InfoCard label="Diet" value={species.diet} />
                  <InfoCard label="Substrate" value={species.substrate} />
                </div>
              </div>
            </div>
          </div>

          <section className="mt-8 rounded-3xl border border-white/10 bg-[#102016] p-5 shadow-xl shadow-black/20 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-white">Care Notes</h2>

              <Link
                href={`/${canonicalSlug}/suggest-edit`}
                className="text-sm font-bold text-emerald-300 hover:text-emerald-200"
              >
                Suggest an improvement →
              </Link>
            </div>

            {safeNotesHtml ? (
              <div
                className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-emerald-50/75 prose-a:text-emerald-300 prose-strong:text-white prose-li:text-emerald-50/75"
                dangerouslySetInnerHTML={{ __html: safeNotesHtml }}
              />
            ) : (
              <p className="text-emerald-50/55">
                No care notes have been added yet.
              </p>
            )}
          </section>

          <DiscussionSection
            entityType="species"
            entityId={String(species.id)}
            entityPath={`/${canonicalSlug}`}
            comments={discussionComments || []}
            isLoggedIn={Boolean(user)}
            currentUserId={user?.id || null}
            canModerate={false}
            activeDiscussionBan={null}
          />

          {relatedSpecies && relatedSpecies.length > 0 && (
            <section className="mt-8">
              <div className="mb-5">
                <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
                  Explore More
                </p>

                <h2 className="mt-2 text-3xl font-black text-white">
                  Related Species
                </h2>

                <p className="mt-2 text-emerald-50/60">
                  Similar species from the same genus or related morph groups.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {relatedSpecies.map((related) => (
                  <Link
                    key={related.id}
                    href={`/${publicSpeciesSlug(related.slug)}`}
                    className="group overflow-hidden rounded-3xl border border-white/10 bg-[#102016] shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-emerald-400/50"
                  >
                    <div className="flex h-48 items-center justify-center bg-[#07130c]/70 p-3">
                      {related.image_url ? (
                        <Image
                          src={related.image_url}
                          alt={related.common_name}
                          width={360}
                          height={240}
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="h-full w-full object-contain transition group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="text-sm text-emerald-50/40">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <div className="mb-3 flex flex-wrap gap-2">
                        {related.difficulty && (
                          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">
                            {related.difficulty}
                          </span>
                        )}
                      </div>

                      <h3 className="text-2xl font-black text-white transition group-hover:text-emerald-300">
                        {related.common_name}
                      </h3>

                      {related.scientific_name && (
                        <p className="mt-2 italic text-emerald-50/55">
                          {related.scientific_name}
                        </p>
                      )}

                      {(related.genus || related.species || related.morph) && (
                        <p className="mt-3 text-sm text-emerald-50/55">
                          {[related.genus, related.species, related.morph]
                            .filter(Boolean)
                            .join(" ")}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </section>
      </main>
    </>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#07130c]/70 p-4">
      <p className="text-xs font-black uppercase tracking-widest text-emerald-100/40">
        {label}
      </p>

      <p className="mt-2 whitespace-pre-wrap text-base text-emerald-50/85">
        {value || "Not listed"}
      </p>
    </div>
  );
}
