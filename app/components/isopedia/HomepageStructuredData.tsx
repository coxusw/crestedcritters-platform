import { absoluteIsopediaUrl } from "@/lib/isopedia-site";

type SpeciesListItem = {
  common_name: string;
  scientific_name: string | null;
  slug: string;
  image_url: string | null;
};

type Props = {
  species: SpeciesListItem[];
};

export default function HomepageStructuredData({ species }: Props) {
  const siteUrl = absoluteIsopediaUrl("/");
  const searchUrl = `${siteUrl}?q={search_term_string}`;
  const itemList = species.slice(0, 100).map((entry, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: absoluteIsopediaUrl(`/${entry.slug}`),
    name: entry.common_name,
    item: {
      "@type": "Article",
      "@id": absoluteIsopediaUrl(`/${entry.slug}#article`),
      headline: `${entry.common_name} Care Guide`,
      name: entry.common_name,
      alternateName: entry.scientific_name || undefined,
      image: entry.image_url || undefined,
    },
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}#website`,
        name: "Isopedia",
        url: siteUrl,
        description:
          "Community-verified care guides, profiles, discussions, collections, and expo information for isopods, springtails, millipedes, beetles, and bioactive cleanup crew species.",
        publisher: {
          "@id": `${siteUrl}#organization`,
        },
        potentialAction: {
          "@type": "SearchAction",
          target: searchUrl,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${siteUrl}#organization`,
        name: "Isopedia",
        url: siteUrl,
        logo: {
          "@type": "ImageObject",
          url: absoluteIsopediaUrl("/crest-logo.png"),
        },
      },
      {
        "@type": "CollectionPage",
        "@id": `${siteUrl}#species-database`,
        name: "Isopedia Community Bioactive Database",
        url: siteUrl,
        isPartOf: {
          "@id": `${siteUrl}#website`,
        },
        mainEntity: {
          "@type": "ItemList",
          name: "Verified Isopedia species entries",
          numberOfItems: species.length,
          itemListElement: itemList,
        },
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
