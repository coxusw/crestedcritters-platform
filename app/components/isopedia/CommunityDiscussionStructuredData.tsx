import { absoluteIsopediaUrl } from "@/lib/isopedia-site";

type Profile = {
  username: string | null;
  display_name: string | null;
  business_name: string | null;
};

type Reply = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author: Profile | null;
};

type Props = {
  title: string;
  body: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  categoryName: string | null;
  categorySlug: string | null;
  author: Profile | null;
  replies: Reply[];
};

function profileName(profile: Profile | null) {
  return (
    profile?.display_name ||
    profile?.business_name ||
    profile?.username ||
    "Isopedia member"
  );
}

export default function CommunityDiscussionStructuredData({
  title,
  body,
  slug,
  createdAt,
  updatedAt,
  categoryName,
  categorySlug,
  author,
  replies,
}: Props) {
  const pageUrl = absoluteIsopediaUrl(`/community/discussion/${slug}`);
  const categoryUrl = categorySlug
    ? absoluteIsopediaUrl(`/community/category/${categorySlug}`)
    : absoluteIsopediaUrl("/community");
  const activeReplies = replies.slice(0, 25);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DiscussionForumPosting",
        "@id": `${pageUrl}#discussion`,
        headline: title,
        text: body,
        url: pageUrl,
        datePublished: createdAt,
        dateModified: updatedAt,
        author: {
          "@type": "Person",
          name: profileName(author),
        },
        discussionUrl: pageUrl,
        articleSection: categoryName || "Isopedia Community",
        about: categoryName
          ? {
              "@type": "Thing",
              name: categoryName,
              url: categoryUrl,
            }
          : undefined,
        commentCount: replies.length,
        comment: activeReplies.map((reply) => ({
          "@type": "Comment",
          "@id": `${pageUrl}#reply-${reply.id}`,
          text: reply.body,
          dateCreated: reply.created_at,
          dateModified: reply.updated_at,
          author: {
            "@type": "Person",
            name: profileName(reply.author),
          },
        })),
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": pageUrl,
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Community",
            item: absoluteIsopediaUrl("/community"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: categoryName || "Discussion",
            item: categoryUrl,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: title,
            item: pageUrl,
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
