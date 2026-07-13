import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { absoluteIsopediaUrl } from "@/lib/isopedia-site";
import { attachDiscussionLikes } from "@/lib/isopedia-discussion-likes";
import { publicSpeciesSlug, storedSpeciesSlug } from "@/lib/isopedia-slugs";
import { truncateMetaDescription } from "@/lib/seo";
import { isUnderRestrictedAge } from "@/lib/isopedia-age";
import CollectionButtons from "@/app/components/isopedia/CollectionButtons";
import DiscussionStructuredData from "@/app/components/isopedia/DiscussionStructuredData";
import DiscussionSection from "@/app/components/isopedia/DiscussionSection";
import SpeciesQrButton from "@/app/components/isopedia/SpeciesQrButton";
import SpeciesStructuredData from "@/app/components/isopedia/SpeciesStructuredData";
import SpeciesImageCarousel, {
  type SpeciesCarouselImage,
} from "@/app/components/isopedia/SpeciesImageCarousel";
import SpeciesHistoryTabs, {
  type SpeciesChangeHistoryItem,
} from "@/app/components/isopedia/SpeciesHistoryTabs";

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

type SpeciesFollow = {
  species_id: number;
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

type RelatedSpeciesCard = RelatedSpecies & {
  display_image_url: string | null;
};

type ContributorProfile = {
  username: string | null;
  display_name: string | null;
  business_name: string | null;
};

type ContributorCredit = {
  id: string;
  image_url?: string | null;
  common_name?: string | null;
  scientific_name?: string | null;
  genus?: string | null;
  species?: string | null;
  morph?: string | null;
  profiles: ContributorProfile | null;
};

type SuggestedEditHistory = {
  id: string;
  field_name: string;
  current_value: string | null;
  proposed_value: string | null;
  edit_reason: string | null;
  source_info: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  suggested_profile: ContributorProfile | null;
  verified_profile: ContributorProfile | null;
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

type LinkedCommunityDiscussion = {
  discussion: {
    id: string;
    slug: string;
    title: string;
    content_type: string;
    reply_count: number;
    last_activity_at: string;
    category: {
      name: string;
      slug: string;
    } | null;
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

function contributorCreditName(credit: ContributorCredit) {
  return (
    credit.profiles?.display_name ||
    credit.profiles?.business_name ||
    credit.profiles?.username ||
    "Community contributor"
  );
}

function profileCreditUrl(profile: ContributorProfile | null | undefined) {
  return profile?.username ? `/profile/${profile.username}` : null;
}

function canonicalImageUrl(value: string | null) {
  if (!value) return "";

  try {
    const parsed = new URL(value);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return value.split("?")[0].split("#")[0];
  }
}

function normalizeCreditText(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function sameCreditText(
  left: string | null | undefined,
  right: string | null | undefined
) {
  return normalizeCreditText(left) === normalizeCreditText(right);
}

function matchesSpeciesSubmissionCredit(species: Species, credit: ContributorCredit) {
  const speciesImageUrl = canonicalImageUrl(species.image_url);
  const creditImageUrl = canonicalImageUrl(credit.image_url || null);

  if (speciesImageUrl && creditImageUrl && speciesImageUrl === creditImageUrl) {
    return true;
  }

  return (
    sameCreditText(credit.common_name, species.common_name) &&
    sameCreditText(credit.scientific_name, species.scientific_name) &&
    sameCreditText(credit.genus, species.genus) &&
    sameCreditText(credit.species, species.species) &&
    sameCreditText(credit.morph, species.morph)
  );
}

function uniqueContributorCredits(credits: ContributorCredit[]) {
  const seen = new Set<string>();
  return credits.filter((credit) => {
    const key = credit.profiles?.username || credit.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function suggestedCreditsByField(edits: SuggestedEditHistory[]) {
  const grouped: Record<string, ContributorCredit[]> = {};
  const latestFirst = [...edits].sort((left, right) => {
    const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
    const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
    return rightTime - leftTime;
  });

  for (const edit of latestFirst) {
    if (edit.status !== "verified") continue;
    if (!edit.suggested_profile) continue;
    if (grouped[edit.field_name]?.length) continue;

    grouped[edit.field_name] = grouped[edit.field_name] || [];
    grouped[edit.field_name].push({
      id: edit.id,
      profiles: edit.suggested_profile,
    });
  }

  return Object.fromEntries(
    Object.entries(grouped).map(([field, credits]) => [
      field,
      uniqueContributorCredits(credits),
    ])
  ) as Record<string, ContributorCredit[]>;
}

function fieldLabel(fieldName: string) {
  const labels: Record<string, string> = {
    common_name: "Common Name",
    scientific_name: "Scientific Name",
    difficulty: "Difficulty",
    origin: "Origin",
    temperature: "Temperature",
    humidity: "Humidity",
    diet: "Diet",
    substrate: "Substrate",
    notes: "Care Notes",
    image_url: "Image",
    organism_type: "Type",
    genus: "Genus",
    species: "Species",
    morph: "Morph",
    trade_names: "Trade Names",
  };

  return labels[fieldName] || fieldName.replace(/_/g, " ");
}

function historyValue(value: string | null) {
  const cleaned = stripHtml(value);
  return cleaned.length > 500 ? `${cleaned.slice(0, 500).trim()}...` : cleaned;
}

function historyContextValue(value: string | null) {
  const cleaned = stripHtml(value);
  return cleaned ? cleaned.slice(0, 2000) : null;
}

async function toggleSpeciesFollow(formData: FormData) {
  "use server";

  const speciesId = Number(formData.get("species_id"));
  const slug = String(formData.get("slug") || "").trim();

  if (!Number.isFinite(speciesId) || !slug) {
    throw new Error("Unable to update species follow.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/${slug}`);
  }

  const { data: existing } = await supabase
    .from("species_follows")
    .select("species_id")
    .eq("species_id", speciesId)
    .eq("profile_id", user.id)
    .maybeSingle<SpeciesFollow>();

  if (existing) {
    const { error } = await supabase
      .from("species_follows")
      .delete()
      .eq("species_id", speciesId)
      .eq("profile_id", user.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("species_follows").insert({
      species_id: speciesId,
      profile_id: user.id,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/${slug}`);
  revalidatePath(`/isopedia/${slug}`);
  redirect(`/${slug}`);
}

function isSuggestedEditContextSchemaError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const message = `${error.code || ""} ${error.message || ""}`.toLowerCase();
  return (
    message.includes("edit_reason") ||
    message.includes("source_info") ||
    message.includes("schema cache")
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
  const description = truncateMetaDescription(
    stripHtml(species.notes),
    `${species.common_name} care information on Isopedia.`
  );

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
  let canReplaceImages = false;
  let birthDate: string | null = null;
  let ageRestrictionReady = false;
  let isFollowingSpecies = false;

  if (user) {
    const [
      { data },
      { data: profile, error: profileError },
      { data: adminProfile },
      { data: speciesFollow },
    ] =
      await Promise.all([
        supabase
          .from("isopedia_user_species")
          .select("status")
          .eq("user_id", user.id)
          .eq("species_id", species.id)
          .returns<CollectionItem[]>(),
        supabase
          .from("profiles")
          .select("role, birth_date")
          .eq("id", user.id)
          .maybeSingle<{ role: string | null; birth_date: string | null }>(),
        supabase
          .from("admin_profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("species_follows")
          .select("species_id")
          .eq("species_id", species.id)
          .eq("profile_id", user.id)
          .maybeSingle<SpeciesFollow>(),
      ]);

    collectionItems = data || [];
    isFollowingSpecies = Boolean(speciesFollow);
    birthDate = profile?.birth_date || null;
    ageRestrictionReady = !profileError;
    canAccessAdmin =
      Boolean(adminProfile) ||
      profile?.role === "admin" ||
      profile?.role === "moderator";
    canReplaceImages = Boolean(adminProfile) || profile?.role === "admin";
  }

  const initialOwned = collectionItems.some((item) => item.status === "owned");
  const initialWishlist = collectionItems.some(
    (item) => item.status === "wishlist"
  );
  const canPostDiscussion = Boolean(
    user &&
      (!ageRestrictionReady ||
        (birthDate && !isUnderRestrictedAge(birthDate)))
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

  const { data: submissionCredits } = await supabase
    .from("isopedia_submissions")
    .select(
      `
      id,
      image_url,
      common_name,
      scientific_name,
      genus,
      species,
      morph,
      profiles:submitted_by (
        username,
        display_name,
        business_name
      )
    `
    )
    .eq("status", "verified")
    .eq("common_name", species.common_name)
    .limit(20)
    .returns<ContributorCredit[]>();

  const matchingSubmissionCredits = (submissionCredits || []).filter((credit) =>
    matchesSpeciesSubmissionCredit(species, credit)
  );
  const speciesSubmitterCredits = uniqueContributorCredits(matchingSubmissionCredits);

  let changeHistoryResult = await supabase
    .from("isopedia_suggested_edits")
    .select(
      `
      id,
      field_name,
      current_value,
      proposed_value,
      edit_reason,
      source_info,
      status,
      created_at,
      updated_at,
      suggested_profile:suggested_by (
        username,
        display_name,
        business_name
      ),
      verified_profile:verified_by (
        username,
        display_name,
        business_name
      )
    `
    )
    .eq("species_id", species.id)
    .order("created_at", { ascending: false })
    .returns<SuggestedEditHistory[]>();

  if (changeHistoryResult.error && isSuggestedEditContextSchemaError(changeHistoryResult.error)) {
    changeHistoryResult = await supabase
      .from("isopedia_suggested_edits")
      .select(
        `
        id,
        field_name,
        current_value,
        proposed_value,
        status,
        created_at,
        updated_at,
        suggested_profile:suggested_by (
          username,
          display_name,
          business_name
        ),
        verified_profile:verified_by (
          username,
          display_name,
          business_name
        )
      `
      )
      .eq("species_id", species.id)
      .order("created_at", { ascending: false })
      .returns<SuggestedEditHistory[]>();
  }

  const rawChangeHistory = changeHistoryResult.data?.map((change) => ({
    ...change,
    edit_reason: change.edit_reason || null,
    source_info: change.source_info || null,
  }));

  const fieldSuggestedCredits = suggestedCreditsByField(rawChangeHistory || []);

  const changeHistory: SpeciesChangeHistoryItem[] = (rawChangeHistory || []).map((change) => ({
    id: change.id,
    fieldLabel: fieldLabel(change.field_name),
    currentValue: historyValue(change.current_value),
    proposedValue: historyValue(change.proposed_value),
    editReason: historyContextValue(change.edit_reason),
    sourceInfo: historyContextValue(change.source_info),
    status: change.status,
    createdAt: change.created_at,
    updatedAt: change.updated_at,
    suggestedProfile: change.suggested_profile,
    verifiedProfile: change.verified_profile,
  }));

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

  const discussionCommentsWithLikes = await attachDiscussionLikes(
    supabase,
    discussionComments,
    user?.id || null
  );

  const { data: linkedCommunityDiscussions } = await supabase
    .from("community_discussion_species")
    .select(
      `
      discussion:discussion_id (
        id,
        slug,
        title,
        content_type,
        reply_count,
        last_activity_at,
        category:category_id (
          name,
          slug
        )
      )
    `
    )
    .eq("species_id", species.id)
    .order("created_at", { ascending: false })
    .limit(6)
    .returns<LinkedCommunityDiscussion[]>();

  const communityDiscussions = (linkedCommunityDiscussions || [])
    .map((row) => row.discussion)
    .filter((discussion): discussion is NonNullable<LinkedCommunityDiscussion["discussion"]> =>
      Boolean(discussion)
    );

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

  const { data: relatedSpeciesResult } =
    await relatedQuery.returns<RelatedSpecies[]>();

  let relatedSpecies: RelatedSpeciesCard[] = (relatedSpeciesResult || []).map(
    (related) => ({
      ...related,
      display_image_url: related.image_url,
    })
  );

  const relatedSpeciesMissingImages = relatedSpecies.filter(
    (related) => !related.display_image_url
  );

  if (relatedSpeciesMissingImages.length > 0) {
    const { data: relatedGalleryImages } = await supabase
      .from("isopedia_species_images")
      .select("species_id, image_url")
      .in(
        "species_id",
        relatedSpeciesMissingImages.map((related) => related.id)
      )
      .eq("status", "verified")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<Array<{ species_id: number; image_url: string }>>();

    const relatedImageBySpeciesId = new Map<number, string>();

    for (const image of relatedGalleryImages || []) {
      if (!relatedImageBySpeciesId.has(image.species_id)) {
        relatedImageBySpeciesId.set(image.species_id, image.image_url);
      }
    }

    relatedSpecies = relatedSpecies.map((related) => ({
      ...related,
      display_image_url:
        related.display_image_url ||
        relatedImageBySpeciesId.get(related.id) ||
        null,
    }));
  }

  const primaryGalleryImage = (galleryImages || []).find(
    (image) => canonicalImageUrl(image.image_url) === canonicalImageUrl(species.image_url)
  );
  const primarySubmissionCredit = matchingSubmissionCredits.find(
    (credit) => canonicalImageUrl(credit.image_url || null) === canonicalImageUrl(species.image_url)
  );
  const primaryFallbackCredit = primarySubmissionCredit || speciesSubmitterCredits[0] || null;

  const carouselImages: SpeciesCarouselImage[] = [
    ...(species.image_url
      ? [
          {
            id: "primary",
            imageUrl: species.image_url,
            alt: species.common_name,
            caption: primaryGalleryImage?.caption || null,
            creditName: primaryGalleryImage
              ? galleryCreditName(primaryGalleryImage)
              : primaryFallbackCredit
                ? contributorCreditName(primaryFallbackCredit)
              : "Isopedia",
            creditProfileUrl: primaryGalleryImage
              ? profileCreditUrl(primaryGalleryImage.profiles)
              : profileCreditUrl(primaryFallbackCredit?.profiles),
            isPrimary: true,
          },
        ]
      : []),
    ...((galleryImages || [])
      .filter((image) => canonicalImageUrl(image.image_url) !== canonicalImageUrl(species.image_url))
      .map((image) => ({
      id: image.id,
      imageUrl: image.image_url,
      alt: image.caption || species.common_name,
      caption: image.caption,
      creditName: galleryCreditName(image),
      creditProfileUrl: profileCreditUrl(image.profiles),
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
        comments={discussionCommentsWithLikes}
      />

      <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
        <section className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/"
              className="rounded-xl border border-white/10 bg-[#102016] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#18291d]"
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
                  canReplaceImages={canReplaceImages}
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

              <SpeciesHistoryTabs
                species={species}
                speciesSubmitterCredits={speciesSubmitterCredits}
                fieldSuggestedCredits={fieldSuggestedCredits}
                changes={changeHistory}
              />
            </div>
          </div>

          <section className="mt-8 rounded-3xl border border-white/10 bg-[#102016] p-5 shadow-xl shadow-black/20 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-white">Care Notes</h2>

              <Link
                href={`/${canonicalSlug}/suggest-edit`}
                className="text-sm font-bold text-emerald-300 hover:text-emerald-200"
              >
                Suggest an improvement
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

          <section className="mt-8 rounded-3xl border border-white/10 bg-[#102016] p-5 shadow-xl shadow-black/20 sm:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
                  Community
                </p>
                <h2 className="mt-2 text-3xl font-black text-white">
                  Discussions About {species.common_name}
                </h2>
              </div>
              <Link
                href={`/community/new?species=${species.id}`}
                className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Start Discussion
              </Link>
              {user ? (
                <form action={toggleSpeciesFollow}>
                  <input type="hidden" name="species_id" value={species.id} />
                  <input type="hidden" name="slug" value={canonicalSlug} />
                  <button className="rounded-xl border border-emerald-400/30 px-4 py-2 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/10">
                    {isFollowingSpecies ? "Following" : "Follow Species"}
                  </button>
                </form>
              ) : (
                <Link
                  href={`/login?next=/${canonicalSlug}`}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
                >
                  Sign In to Follow
                </Link>
              )}
            </div>

            {communityDiscussions.length ? (
              <div className="grid gap-3">
                {communityDiscussions.map((discussion) => (
                  <Link
                    key={discussion.id}
                    href={`/community/discussion/${discussion.slug}`}
                    className="rounded-2xl border border-white/10 bg-[#07130c]/70 p-4 transition hover:border-emerald-300/40"
                  >
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-100">
                        {discussion.content_type}
                      </span>
                      {discussion.category && (
                        <span className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-50/60">
                          {discussion.category.name}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 font-black text-white">{discussion.title}</h3>
                    <p className="mt-1 text-xs text-emerald-50/45">
                      {discussion.reply_count} replies / Active{" "}
                      {new Date(discussion.last_activity_at).toLocaleDateString()}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-6 text-center">
                <p className="text-emerald-50/60">
                  No community posts have been linked to this species yet.
                </p>
                <Link
                  href={`/community/new?species=${species.id}`}
                  className="mt-4 inline-flex rounded-xl border border-emerald-400/30 px-4 py-2 text-sm font-black text-emerald-100 hover:bg-emerald-400/10"
                >
                  Start the first one
                </Link>
              </div>
            )}
          </section>

          <DiscussionSection
            entityType="species"
            entityId={String(species.id)}
            entityPath={`/${canonicalSlug}`}
            comments={discussionCommentsWithLikes}
            isLoggedIn={Boolean(user)}
            currentUserId={user?.id || null}
            canModerate={false}
            activeDiscussionBan={null}
            canPostDiscussion={canPostDiscussion}
            discussionRestrictionMessage="Discussion posting is disabled for users under the age of 13."
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
                    <div className="relative flex h-48 items-center justify-center bg-[#07130c]/70 p-3">
                      {related.display_image_url ? (
                        <>
                          <Image
                            src={related.display_image_url}
                            alt={related.common_name}
                            width={360}
                            height={240}
                            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                            className="h-full w-full object-contain transition group-hover:scale-[1.03]"
                          />
                        </>
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

