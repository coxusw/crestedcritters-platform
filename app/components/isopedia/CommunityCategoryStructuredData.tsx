import { absoluteIsopediaUrl } from "@/lib/isopedia-site";

type DiscussionListItem = {
  title: string;
  slug: string;
  excerpt: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  categoryName: string;
  categorySlug: string;
  description: string | null;
  discussions: DiscussionListItem[];
};

export default function CommunityCategoryStructuredData({
  categoryName,
  categorySlug,
  description,
  discussions,
}: Props) {
  const pageUrl = absoluteIsopediaUrl(`/community/category/${categorySlug}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#collection`,
        name: categoryName,
        description: description || "Isopedia community category.",
        url: pageUrl,
        isPartOf: {
          "@id": `${absoluteIsopediaUrl("/")}#website`,
        },
        mainEntity: {
          "@type": "ItemList",
          name: `${categoryName} discussions`,
          numberOfItems: discussions.length,
          itemListElement: discussions.slice(0, 40).map((discussion, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: absoluteIsopediaUrl(`/community/discussion/${discussion.slug}`),
            name: discussion.title,
            item: {
              "@type": "DiscussionForumPosting",
              headline: discussion.title,
              url: absoluteIsopediaUrl(`/community/discussion/${discussion.slug}`),
              description: discussion.excerpt || undefined,
              datePublished: discussion.created_at,
              dateModified: discussion.updated_at,
            },
          })),
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
            name: categoryName,
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
