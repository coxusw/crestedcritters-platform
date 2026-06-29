import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { absoluteIsopediaUrl } from "@/lib/isopedia-site";
import { attachDiscussionLikes } from "@/lib/isopedia-discussion-likes";
import { truncateMetaDescription } from "@/lib/seo";
import { isUnderRestrictedAge } from "@/lib/isopedia-age";
import DiscussionSection from "@/app/components/isopedia/DiscussionSection";
import DiscussionStructuredData from "@/app/components/isopedia/DiscussionStructuredData";
import { toggleGuideLike } from "@/app/isopedia/guides/actions";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type Guide = {
  id: string;
  slug: string;
  title: string;
  body: string;
  author_user_id: string;
  created_at: string;
  updated_at: string | null;
  profiles: {
    username: string | null;
    display_name: string | null;
    business_name: string | null;
  } | null;
};

type GuideImage = {
  id: string;
  position: number;
  image_url: string;
  caption: string | null;
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

function authorName(guide: Guide) {
  return (
    guide.profiles?.display_name ||
    guide.profiles?.business_name ||
    guide.profiles?.username ||
    "Isopedia member"
  );
}

function authorHref(guide: Guide) {
  return guide.profiles?.username ? `/profile/${guide.profiles.username}` : null;
}

function summaryFromBody(body: string) {
  return body
    .replace(/\[\[image:\d+\]\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

async function getGuide(slug: string) {
  const supabase = await createSupabaseServerClient();

  const { data: guide } = await supabase
    .from("isopedia_guides")
    .select(
      `
      id,
      slug,
      title,
      body,
      author_user_id,
      created_at,
      updated_at,
      profiles:author_user_id (
        username,
        display_name,
        business_name
      )
    `
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle<Guide>();

  return guide;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuide(slug);

  if (!guide) {
    return {
      title: "Guide Not Found | Isopedia",
    };
  }

  const title = `${guide.title} | Isopedia Guide`;
  const description = truncateMetaDescription(
    summaryFromBody(guide.body),
    "Community-submitted Isopedia guide."
  );
  const canonical = absoluteIsopediaUrl(`/guides/${guide.slug}`);

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
      publishedTime: guide.created_at,
      modifiedTime: guide.updated_at || guide.created_at,
      authors: [authorName(guide)],
      images: [
        {
          url: absoluteIsopediaUrl("/isopedia-social-preview.jpg"),
          width: 1200,
          height: 630,
          alt: guide.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteIsopediaUrl("/isopedia-social-preview.jpg")],
    },
  };
}

function renderGuideBody(
  body: string,
  images: GuideImage[],
  canReplaceImages: boolean
) {
  const imageByPosition = new Map(
    images.map((image) => [Number(image.position), image])
  );
  const usedPositions = new Set<number>();

  const rendered = body
    .split(/(\[\[image:\d+\]\])/gi)
    .flatMap((part, partIndex) => {
      const match = part.match(/\[\[image:(\d+)\]\]/i);

      if (match) {
        const position = Number(match[1]);
        const image = imageByPosition.get(position);
        usedPositions.add(position);

        if (!image) return [];

        return [
          <GuideFigure
            key={`image-${position}-${partIndex}`}
            image={image}
            canReplaceImages={canReplaceImages}
          />,
        ];
      }

      return part
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph, paragraphIndex) => (
          <p
            key={`paragraph-${partIndex}-${paragraphIndex}`}
            className="whitespace-pre-wrap text-base leading-8 text-emerald-50/78 sm:text-lg"
          >
            {paragraph}
          </p>
        ));
    });

  const unplacedImages = images
    .filter((image) => !usedPositions.has(Number(image.position)))
    .map((image) => (
      <GuideFigure
        key={`unplaced-${image.id}`}
        image={image}
        canReplaceImages={canReplaceImages}
      />
    ));

  return [...rendered, ...unplacedImages];
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: guide, error } = await supabase
    .from("isopedia_guides")
    .select(
      `
      id,
      slug,
      title,
      body,
      author_user_id,
      created_at,
      updated_at,
      profiles:author_user_id (
        username,
        display_name,
        business_name
      )
    `
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle<Guide>();

  if (error || !guide) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile, error: profileError }, { data: adminProfile }] = user
    ? await Promise.all([
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
      ])
    : [{ data: null, error: null }, { data: null }];
  const canPostDiscussion = Boolean(
    user &&
      (profileError ||
        (profile?.birth_date && !isUnderRestrictedAge(profile.birth_date)))
  );
  const canReplaceImages = Boolean(adminProfile) || profile?.role === "admin";

  const [
    { data: images },
    { data: likes },
    { data: currentUserLike },
    { data: discussionComments },
  ] = await Promise.all([
    supabase
      .from("isopedia_guide_images")
      .select("id, position, image_url, caption")
      .eq("guide_id", guide.id)
      .order("position", { ascending: true })
      .returns<GuideImage[]>(),

    supabase
      .from("isopedia_guide_likes")
      .select("id")
      .eq("guide_id", guide.id)
      .returns<Array<{ id: string }>>(),

    user
      ? supabase
          .from("isopedia_guide_likes")
          .select("id")
          .eq("guide_id", guide.id)
          .eq("user_id", user.id)
          .maybeSingle<{ id: string }>()
      : Promise.resolve({ data: null }),

    supabase
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
      .eq("entity_type", "guide")
      .eq("entity_id", guide.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .returns<DiscussionComment[]>(),
  ]);

  const discussionCommentsWithLikes = await attachDiscussionLikes(
    supabase,
    discussionComments,
    user?.id || null
  );

  const guideImages = images || [];
  const likeCount = likes?.length || 0;
  const userLiked = Boolean(currentUserLike);
  const writerHref = authorHref(guide);
  const isAuthor = user?.id === guide.author_user_id;
  const canonicalPath = `/guides/${guide.slug}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: guide.title,
            description: summaryFromBody(guide.body),
            author: {
              "@type": "Person",
              name: authorName(guide),
            },
            datePublished: guide.created_at,
            dateModified: guide.updated_at || guide.created_at,
            url: absoluteIsopediaUrl(canonicalPath),
          }),
        }}
      />

      <DiscussionStructuredData
        pagePath={canonicalPath}
        pageTitle={guide.title}
        comments={discussionCommentsWithLikes}
      />

      <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
        <section className="mx-auto max-w-4xl">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/guides"
              className="text-sm font-bold text-emerald-300 hover:text-emerald-200"
            >
              Back to Guides
            </Link>

            <Link
              href="/guides/submit"
              className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Add Guide
            </Link>
          </div>

          <article className="overflow-hidden rounded-3xl border border-white/10 bg-[#102016] shadow-2xl shadow-black/30">
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_36%),linear-gradient(135deg,rgba(6,78,59,0.44),rgba(7,19,12,0.96))] p-5 sm:p-8">
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">
                  {likeCount} like{likeCount === 1 ? "" : "s"}
                </span>

                <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-black text-emerald-50/70">
                  {discussionCommentsWithLikes.length} comment
                  {discussionCommentsWithLikes.length === 1 ? "" : "s"}
                </span>
              </div>

              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                {guide.title}
              </h1>

              <p className="mt-4 text-sm leading-6 text-emerald-50/65">
                By{" "}
                {writerHref ? (
                  <Link
                    href={writerHref}
                    className="font-bold text-emerald-300 hover:text-emerald-200"
                  >
                    {authorName(guide)}
                  </Link>
                ) : (
                  <span className="font-bold text-white">{authorName(guide)}</span>
                )}
                {" "}on {new Date(guide.created_at).toLocaleDateString()}
              </p>

              <div className="mt-6">
                {user && !isAuthor ? (
                  <form action={toggleGuideLike}>
                    <input type="hidden" name="guide_id" value={guide.id} />
                    <input
                      type="hidden"
                      name="return_path"
                      value={canonicalPath}
                    />

                    <button
                      type="submit"
                      className={`rounded-xl px-5 py-3 text-sm font-black transition ${
                        userLiked
                          ? "border border-emerald-400/40 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/20"
                          : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                      }`}
                    >
                      {userLiked ? "Liked" : "Like Guide"}
                    </button>
                  </form>
                ) : user ? (
                  <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-emerald-50/70">
                    Your guide
                  </span>
                ) : (
                  <Link
                    href={`/login?next=${encodeURIComponent(canonicalPath)}`}
                    className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
                  >
                    Log In to Like
                  </Link>
                )}
              </div>
            </div>

            <div className="grid gap-5 p-5 sm:p-8">
              {renderGuideBody(guide.body, guideImages, canReplaceImages)}
            </div>
          </article>

          <DiscussionSection
            entityType="guide"
            entityId={guide.id}
            entityPath={canonicalPath}
            comments={discussionCommentsWithLikes}
            isLoggedIn={Boolean(user)}
            currentUserId={user?.id || null}
            canModerate={false}
            activeDiscussionBan={null}
            canPostDiscussion={canPostDiscussion}
            discussionRestrictionMessage="Discussion posting is disabled for users under the age of 13."
          />
        </section>
      </main>
    </>
  );
}

function GuideFigure({
  image,
  canReplaceImages,
}: {
  image: GuideImage;
  canReplaceImages: boolean;
}) {
  return (
    <figure className="overflow-hidden rounded-3xl border border-white/10 bg-[#07130c]/80 shadow-xl shadow-black/20">
      <div className="relative min-h-[240px] bg-[#07130c] sm:min-h-[420px]">
        <Image
          src={image.image_url}
          alt={image.caption || "Guide image"}
          fill
          sizes="(min-width: 1024px) 900px, 100vw"
          className="object-contain"
        />
        {canReplaceImages && (
          <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-2">
            <Link
              href={`/admin/isopedia/repair-image?image_url=${encodeURIComponent(image.image_url)}`}
              className="rounded-full border border-emerald-300/30 bg-black/65 px-3 py-1.5 text-xs font-black text-emerald-100 shadow-lg transition hover:bg-emerald-400 hover:text-slate-950"
            >
              Replace image
            </Link>
            <Link
              href={`/admin/isopedia/delete-image?image_url=${encodeURIComponent(image.image_url)}`}
              className="rounded-full border border-red-300/30 bg-black/65 px-3 py-1.5 text-xs font-black text-red-100 shadow-lg transition hover:bg-red-500 hover:text-white"
            >
              Delete image
            </Link>
          </div>
        )}
      </div>

      {image.caption && (
        <figcaption className="border-t border-white/10 px-4 py-3 text-sm text-emerald-50/60">
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
}
