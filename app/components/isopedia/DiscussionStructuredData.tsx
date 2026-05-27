import { absoluteIsopediaUrl } from "@/lib/isopedia-site";

type DiscussionComment = {
  id: string;
  body: string;
  created_at: string;
  profiles: {
    username: string | null;
    display_name: string | null;
    business_name: string | null;
  } | null;
};

type Props = {
  pagePath: string;
  pageTitle: string;
  comments: DiscussionComment[];
};

function authorName(comment: DiscussionComment) {
  return (
    comment.profiles?.display_name ||
    comment.profiles?.business_name ||
    comment.profiles?.username ||
    "Isopedia member"
  );
}

export default function DiscussionStructuredData({
  pagePath,
  pageTitle,
  comments,
}: Props) {
  const activeComments = comments.slice(0, 25);

  if (activeComments.length === 0) return null;

  const pageUrl = absoluteIsopediaUrl(pagePath);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    "@id": `${pageUrl}#discussion`,
    headline: `${pageTitle} Discussion`,
    url: pageUrl,
    commentCount: activeComments.length,
    comment: activeComments.map((comment) => ({
      "@type": "Comment",
      "@id": `${pageUrl}#comment-${comment.id}`,
      text: comment.body,
      dateCreated: comment.created_at,
      author: {
        "@type": "Person",
        name: authorName(comment),
      },
    })),
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
