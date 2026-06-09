export const ISOPEDIA_LEGAL_VERSION = "2026-06-08-content-license-v2";

export const ISOPEDIA_CONTENT_LICENSE_ACKNOWLEDGMENT =
  "I understand that content I submit to Isopedia, including guides, information, images, discussions, comments, and other submitted materials, may be displayed, archived, featured, and used by Isopedia and Crested Critters LLC to operate, advertise, promote, and grow Isopedia.";

const contentLicenseText = [
  "Any user-submitted content, including but not limited to guides, articles, species information, suggested edits, discussions, comments, collection data, expo submissions, profile content, usernames, display names, images, photographs, and uploaded media, may be used by Isopedia and Crested Critters LLC to operate, maintain, improve, advertise, promote, document, and grow Isopedia.",
  "Users retain ownership of submitted content. By submitting content, users grant Crested Critters LLC and Isopedia a perpetual, worldwide, non-exclusive, transferable, sublicensable, royalty-free license to use, host, store, reproduce, modify, adapt, publish, translate, distribute, publicly display, publicly perform, archive, create excerpts, create thumbnails, create screenshots, create promotional graphics, and create derivative works from that content.",
  "This license allows Isopedia and Crested Critters LLC to display submitted content on Isopedia; feature submitted content on homepages, landing pages, profiles, guides, species pages, collection pages, newsletters, emails, and promotional materials; share submitted content on social media; use submitted content in ads and marketing campaigns; use screenshots, previews, excerpts, thumbnails, and images for promotion; resize, crop, compress, reformat, or otherwise modify content for technical, display, moderation, or promotional purposes; preserve content in backups, archives, search results, historical records, and community resources; and continue displaying or using submitted content after account deactivation, account deletion, username changes, transfer of ownership, merger, acquisition, or sale of Isopedia-related assets.",
];

export type LegalDocumentKey =
  | "terms"
  | "privacy"
  | "community-guidelines"
  | "user-generated-content";

export type LegalDocument = {
  key: LegalDocumentKey;
  title: string;
  version: string;
  updatedLabel: string;
  sections: Array<{
    title: string;
    body: string[];
  }>;
};

export const isopediaLegalDocuments: LegalDocument[] = [
  {
    key: "terms",
    title: "Terms of Service",
    version: ISOPEDIA_LEGAL_VERSION,
    updatedLabel: "June 8, 2026",
    sections: [
      {
        title: "Using Isopedia",
        body: [
          "Isopedia is operated by Crested Critters LLC as a community bioactive database. By creating an account, browsing, submitting content, or participating in Isopedia features, you agree to use the site lawfully and respectfully.",
          "You are responsible for the content you submit and for keeping your account information accurate enough for Isopedia to contact you about account, moderation, prize, or safety matters.",
          "This version includes a small re-acceptance prompt update for testing the legal acceptance workflow.",
        ],
      },
      {
        title: "User-submitted content license",
        body: contentLicenseText,
      },
      {
        title: "Moderation and site operation",
        body: [
          "Isopedia may review, reject, edit, remove, limit, preserve, or restore submitted content when needed for accuracy, moderation, safety, technical maintenance, legal compliance, or community usefulness.",
          "IsoTokens, badges, raffles, contribution features, and other community systems may be changed, paused, corrected, or removed if needed to protect the site or prevent abuse.",
        ],
      },
    ],
  },
  {
    key: "privacy",
    title: "Privacy Policy",
    version: ISOPEDIA_LEGAL_VERSION,
    updatedLabel: "June 8, 2026",
    sections: [
      {
        title: "Information Isopedia uses",
        body: [
          "Isopedia uses account information, profile information, submitted content, site activity, email addresses, and technical information to operate accounts, profiles, submissions, notifications, moderation, analytics, and community features.",
          "Public profile details and submitted public content may be visible to visitors, indexed by search engines, shared in promotional materials, or preserved as part of community records as described in the User Generated Content Policy.",
        ],
      },
      {
        title: "Service providers",
        body: [
          "Isopedia may use service providers such as Supabase, Vercel, email providers, payment providers, analytics tools, and storage providers to run the site.",
          "Information may be processed by those providers only as needed to operate, maintain, secure, improve, and support Isopedia.",
        ],
      },
    ],
  },
  {
    key: "community-guidelines",
    title: "Community Guidelines",
    version: ISOPEDIA_LEGAL_VERSION,
    updatedLabel: "June 8, 2026",
    sections: [
      {
        title: "Contribute in good faith",
        body: [
          "Submit information, images, edits, discussions, and reviews with the normal intent of helping the Isopedia community.",
          "Do not spam, harass, impersonate others, manipulate IsoTokens, submit knowingly false information, upload content you do not have permission to use, or use the site in a way that harms other users or the project.",
        ],
      },
      {
        title: "Review and verification",
        body: [
          "Verification features are meant to improve accuracy. Reviewers should verify only content they can reasonably evaluate and should avoid verifying their own submissions unless an admin workflow specifically allows it.",
          "Abuse of contribution rewards, verification systems, raffles, or account features may result in removal of IsoTokens, removal of content, loss of access, or an account ban.",
        ],
      },
    ],
  },
  {
    key: "user-generated-content",
    title: "User Generated Content Policy",
    version: ISOPEDIA_LEGAL_VERSION,
    updatedLabel: "June 8, 2026",
    sections: [
      {
        title: "What counts as user-submitted content",
        body: [
          "User-submitted content includes guides, articles, species information, suggested edits, discussions, comments, collection data, expo submissions, profile content, usernames, display names, images, photographs, uploaded media, and any other material submitted to Isopedia.",
        ],
      },
      {
        title: "Ownership and license",
        body: contentLicenseText,
      },
      {
        title: "Continued use and preservation",
        body: [
          "Submitted content may remain visible, archived, searchable, credited, excerpted, or used for Isopedia operations and promotion even if an account is deactivated or deleted, a username changes, or Isopedia-related ownership or assets are transferred, merged, acquired, or sold.",
          "Isopedia may remove or limit content when appropriate, but account deletion or profile changes do not automatically require removal from backups, archives, historical records, search results, community resources, promotional materials, or pages where the content remains useful to the project.",
        ],
      },
    ],
  },
];

export function getLegalDocument(key: string | null | undefined) {
  return (
    isopediaLegalDocuments.find((document) => document.key === key) ||
    isopediaLegalDocuments[0]
  );
}
