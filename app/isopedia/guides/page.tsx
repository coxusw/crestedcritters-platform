import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { absoluteIsopediaUrl } from "@/lib/isopedia-site";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

type Guide = {
  id: string;
  slug: string;
  title: string;
  body: string;
  author_user_id: string;
  created_at: string;
  profiles: {
    username: string | null;
    display_name: string | null;
    business_name: string | null;
  } | null;
};

export const metadata: Metadata = {
  title: { absolute: "Community Guides | Isopedia" },
  description:
    "Read community-submitted isopod and bioactive invertebrate guides on Isopedia.",
  alternates: {
    canonical: absoluteIsopediaUrl("/guides"),
  },
  openGraph: {
    title: "Community Guides | Isopedia",
    description:
      "Read community-submitted isopod and bioactive invertebrate guides on Isopedia.",
    url: absoluteIsopediaUrl("/guides"),
    siteName: "Isopedia",
    type: "website",
    images: [
      {
        url: absoluteIsopediaUrl("/isopedia-social-preview.jpg"),
        width: 1200,
        height: 630,
        alt: "Isopedia community guides",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Community Guides | Isopedia",
    description:
      "Read community-submitted isopod and bioactive invertebrate guides on Isopedia.",
    images: [absoluteIsopediaUrl("/isopedia-social-preview.jpg")],
  },
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

function guideSummary(body: string) {
  return body
    .replace(/\[\[image:\d+\]\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

export default async function GuidesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const searchQuery = String(params?.q || "").trim();
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("isopedia_guides")
    .select(
      `
      id,
      slug,
      title,
      body,
      author_user_id,
      created_at,
      profiles:author_user_id (
        username,
        display_name,
        business_name
      )
    `
    )
    .eq("status", "published");

  if (searchQuery) {
    query = query.ilike("title", `%${searchQuery}%`);
  }

  const { data: guides, error } = await query
    .order("created_at", { ascending: false })
    .returns<Guide[]>();

  if (error) {
    throw new Error(error.message);
  }

  const allGuides = guides || [];
  const guideIds = allGuides.map((guide) => guide.id);

  const [{ data: likes }, { data: comments }] =
    guideIds.length > 0
      ? await Promise.all([
          supabase
            .from("isopedia_guide_likes")
            .select("guide_id")
            .in("guide_id", guideIds)
            .returns<Array<{ guide_id: string }>>(),
          supabase
            .from("isopedia_discussions")
            .select("entity_id")
            .eq("entity_type", "guide")
            .eq("status", "active")
            .in("entity_id", guideIds)
            .returns<Array<{ entity_id: string }>>(),
        ])
      : [{ data: [] }, { data: [] }];

  const likeCounts = new Map<string, number>();
  for (const like of likes || []) {
    likeCounts.set(like.guide_id, (likeCounts.get(like.guide_id) || 0) + 1);
  }

  const commentCounts = new Map<string, number>();
  for (const comment of comments || []) {
    commentCounts.set(
      comment.entity_id,
      (commentCounts.get(comment.entity_id) || 0) + 1
    );
  }

  const sortedGuides = allGuides.sort((a, b) => {
    const likeDiff = (likeCounts.get(b.id) || 0) - (likeCounts.get(a.id) || 0);
    if (likeDiff) return likeDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <IsopediaNav active="guides" />

        <section className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#102016] shadow-2xl shadow-black/30">
          <div className="bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_36%),linear-gradient(135deg,rgba(6,78,59,0.48),rgba(7,19,12,0.95))] px-4 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-300 sm:text-xs sm:tracking-[0.35em]">
                Isopedia Community
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Guides
              </h1>

              <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-emerald-50/80 sm:text-base lg:text-lg">
                Community-written keeping, setup, breeding, and troubleshooting
                guides. Guides publish immediately and are sorted by likes.
              </p>

              {user && (
                <div className="mt-6 flex justify-center">
                  <Link
                    href="/guides/submit"
                    className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
                  >
                    Add Guide
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto mt-5 max-w-5xl rounded-3xl border border-white/10 bg-[#102016] p-4 shadow-xl shadow-black/20 sm:mt-6 sm:p-5">
          <form className="grid gap-3 sm:grid-cols-[1fr_auto]" action="/guides">
            <input
              name="q"
              defaultValue={searchQuery}
              placeholder="Search guide titles..."
              className="min-h-12 rounded-2xl border border-white/10 bg-[#07130c] px-4 py-3 text-base text-white outline-none transition placeholder:text-emerald-50/30 focus:border-emerald-400/40"
            />

            <button
              type="submit"
              className="min-h-12 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Search
            </button>
          </form>
        </section>

        <section className="mx-auto mt-6 grid max-w-5xl gap-5 sm:mt-8 sm:grid-cols-2">
          {sortedGuides.length > 0 ? (
            sortedGuides.map((guide) => {
              const authorProfileHref = authorHref(guide);

              return (
                <article
                  key={guide.id}
                  className="rounded-3xl border border-white/10 bg-[#102016] p-5 shadow-xl shadow-black/20 transition hover:border-emerald-400/40 sm:p-6"
                >
                  <div className="mb-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">
                      {likeCounts.get(guide.id) || 0} like
                      {(likeCounts.get(guide.id) || 0) === 1 ? "" : "s"}
                    </span>

                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-black text-emerald-50/70">
                      {commentCounts.get(guide.id) || 0} comment
                      {(commentCounts.get(guide.id) || 0) === 1 ? "" : "s"}
                    </span>
                  </div>

                  <Link href={`/guides/${guide.slug}`}>
                    <h2 className="text-2xl font-black text-white transition hover:text-emerald-300">
                      {guide.title}
                    </h2>
                  </Link>

                  <p className="mt-3 line-clamp-4 text-sm leading-6 text-emerald-50/60">
                    {guideSummary(guide.body) || "Open this guide to read more."}
                  </p>

                  <p className="mt-4 text-sm text-emerald-50/55">
                    By{" "}
                    {authorProfileHref ? (
                      <Link
                        href={authorProfileHref}
                        className="font-bold text-emerald-300 hover:text-emerald-200"
                      >
                        {authorName(guide)}
                      </Link>
                    ) : (
                      <span className="font-bold">{authorName(guide)}</span>
                    )}
                  </p>
                </article>
              );
            })
          ) : (
            <div className="rounded-3xl border border-white/10 bg-[#102016] p-8 text-center shadow-xl shadow-black/20 sm:col-span-2">
              <h2 className="text-2xl font-black text-white">
                No guides found
              </h2>

              <p className="mt-3 text-emerald-50/60">
                Try another title search, or add the first guide.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
