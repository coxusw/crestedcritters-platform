import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import CollectionButtons from "@/app/components/isopedia/CollectionButtons";
import DiscussionSection from "@/app/components/isopedia/DiscussionSection";
import SpeciesQrButton from "@/app/components/isopedia/SpeciesQrButton";
import SpeciesStructuredData from "@/app/components/isopedia/SpeciesStructuredData";

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
  status: "active" | "deleted" | "hidden";
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

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

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
    .eq("slug", slug)
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

  const title = `${species.common_name} | Isopedia`;
  const description =
    stripHtml(species.notes) ||
    `${species.common_name} care information on Isopedia.`;

  const image = species.image_url || "/crest-logo.png";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
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
    .eq("slug", slug)
    .maybeSingle<Species>();

  if (error || !species) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let canModerate = false;

  if (user) {
    const [{ data: profile }, { data: adminProfile }] = await Promise.all([
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

    canModerate =
      Boolean(adminProfile) ||
      profile?.role === "admin" ||
      profile?.role === "moderator";
  }

  let collectionItems: CollectionItem[] = [];

  if (user) {
    const { data } = await supabase
      .from("isopedia_user_species")
      .select("status")
      .eq("user_id", user.id)
      .eq("species_id", species.id)
      .returns<CollectionItem[]>();

    collectionItems = data || [];
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
    .in("status", ["active", "deleted"])
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

  return (
    <>
      <SpeciesStructuredData
        speciesName={species.common_name}
        scientificName={species.scientific_name}
        slug={species.slug}
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

      <main className="min-h-screen bg-slate-950 text-slate-100">
        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/isopedia"
              className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
            >
              ← Back to Isopedia
            </Link>

            <div className="flex flex-wrap gap-2">
              <SpeciesQrButton
                speciesName={species.common_name}
                speciesSlug={species.slug}
              />

              <a
                href={`/isopedia/${species.slug}/suggest-edit`}
                className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
              >
                Suggest Edit
              </a>

              <a
                href={`/isopedia/${species.slug}/submit-image`}
                className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-200"
              >
                Add Image
              </a>

              <a
                href="/isopedia/review"
                className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
              >
                Review Queue
              </a>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/30">
            <div className="grid gap-0 lg:grid-cols-[420px_1fr]">
              <div className="border-b border-white/10 bg-slate-950/70 p-4 lg:border-b-0 lg:border-r">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-slate-800">
                  {species.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={species.image_url}
                      alt={species.common_name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="px-6 text-center text-sm text-slate-400">
                      No image has been added yet.
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <CollectionButtons
                    speciesId={species.id}
                    isLoggedIn={Boolean(user)}
                    initialOwned={initialOwned}
                    initialWishlist={initialWishlist}
                  />
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <div className="mb-6">
                  <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-300">
                    {species.organism_type || "Isopedia Species Profile"}
                  </p>

                  <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
                    {species.common_name}
                  </h1>

                  {species.scientific_name && (
                    <p className="mt-3 text-lg italic text-slate-300">
                      {species.scientific_name}
                    </p>
                  )}
                </div>

                <div className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                  <h2 className="mb-3 text-lg font-bold text-white">
                    Taxonomy / ID
                  </h2>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoCard label="Type" value={species.organism_type} />
                    <InfoCard label="Genus" value={species.genus} />
                    <InfoCard label="Species" value={species.species} />
                    <InfoCard label="Morph" value={species.morph} />
                    <InfoCard
                      label="Trade Names"
                      value={species.trade_names}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoCard label="Difficulty" value={species.difficulty} />
                  <InfoCard label="Origin" value={species.origin} />
                  <InfoCard
                    label="Temperature"
                    value={species.temperature}
                  />
                  <InfoCard label="Humidity" value={species.humidity} />
                  <InfoCard label="Diet" value={species.diet} />
                  <InfoCard label="Substrate" value={species.substrate} />
                </div>
              </div>
            </div>
          </div>

          <section className="mt-8 rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-xl shadow-black/20 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold text-white">Care Notes</h2>

              <a
                href={`/isopedia/${species.slug}/suggest-edit`}
                className="text-sm font-semibold text-emerald-300 hover:text-emerald-200"
              >
                Suggest an improvement →
              </a>
            </div>

            {safeNotesHtml ? (
              <div
                className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-300 prose-a:text-emerald-300 prose-strong:text-white prose-li:text-slate-300"
                dangerouslySetInnerHTML={{ __html: safeNotesHtml }}
              />
            ) : (
              <p className="text-slate-400">
                No care notes have been added yet.
              </p>
            )}
          </section>

          <DiscussionSection
            entityType="species"
            entityId={String(species.id)}
            entityPath={`/isopedia/${species.slug}`}
            comments={discussionComments || []}
            isLoggedIn={Boolean(user)}
            currentUserId={user?.id || null}
            canModerate={canModerate}
          />

          <section className="mt-8">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
                  Species Gallery
                </p>

                <h2 className="mt-2 text-3xl font-black text-white">
                  Gallery Images
                </h2>

                <p className="mt-2 text-slate-400">
                  Verified community-submitted photos for this species.
                </p>
              </div>

              <a
                href={`/isopedia/${species.slug}/submit-image`}
                className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-200"
              >
                Add Image
              </a>
            </div>

            {galleryImages && galleryImages.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {galleryImages.map((image) => {
                  const creditName =
                    image.profiles?.display_name ||
                    image.profiles?.business_name ||
                    image.profiles?.username ||
                    "Community contributor";

                  return (
                    <a
                      key={image.id}
                      href={image.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-emerald-400/50"
                    >
                      <div className="flex h-64 items-center justify-center bg-slate-950/70 p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.image_url}
                          alt={image.caption || species.common_name}
                          className="h-full w-full object-contain transition group-hover:scale-[1.03]"
                        />
                      </div>

                      <div className="p-5">
                        {image.caption ? (
                          <p className="line-clamp-3 text-sm text-slate-300">
                            {image.caption}
                          </p>
                        ) : (
                          <p className="text-sm text-slate-500">
                            No caption provided.
                          </p>
                        )}

                        <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-emerald-300">
                          Credit: {creditName}
                        </p>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-slate-900 p-8 text-center shadow-xl shadow-black/20">
                <p className="text-slate-400">
                  No verified gallery images have been added yet.
                </p>

                <a
                  href={`/isopedia/${species.slug}/submit-image`}
                  className="mt-5 inline-flex rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-200"
                >
                  Submit the first gallery image
                </a>
              </div>
            )}
          </section>

          {relatedSpecies && relatedSpecies.length > 0 && (
            <section className="mt-8">
              <div className="mb-5">
                <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
                  Explore More
                </p>

                <h2 className="mt-2 text-3xl font-black text-white">
                  Related Species
                </h2>

                <p className="mt-2 text-slate-400">
                  Similar species from the same genus or related morph groups.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {relatedSpecies.map((related) => (
                  <Link
                    key={related.id}
                    href={`/isopedia/${related.slug}`}
                    className="group overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-emerald-400/50"
                  >
                    <div className="flex h-48 items-center justify-center bg-slate-950/70 p-3">
                      {related.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={related.image_url}
                          alt={related.common_name}
                          className="h-full w-full object-contain transition group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="text-sm text-slate-500">No image</div>
                      )}
                    </div>

                    <div className="p-5">
                      <div className="mb-3 flex flex-wrap gap-2">
                        {related.difficulty && (
                          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
                            {related.difficulty}
                          </span>
                        )}
                      </div>

                      <h3 className="text-2xl font-black text-white transition group-hover:text-emerald-300">
                        {related.common_name}
                      </h3>

                      {related.scientific_name && (
                        <p className="mt-2 italic text-slate-400">
                          {related.scientific_name}
                        </p>
                      )}

                      {(related.genus || related.species || related.morph) && (
                        <p className="mt-3 text-sm text-slate-400">
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
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>

      <p className="mt-2 whitespace-pre-wrap text-base text-slate-100">
        {value || "Not listed"}
      </p>
    </div>
  );
}