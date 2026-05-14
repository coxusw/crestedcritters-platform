type Props = {
  speciesName: string;
  scientificName: string | null;
  slug: string;
  description: string;
  imageUrl: string | null;
  organismType: string | null;
  genus: string | null;
  species: string | null;
  morph: string | null;
  difficulty: string | null;
  origin: string | null;
  temperature: string | null;
  humidity: string | null;
};

export default function SpeciesStructuredData({
  speciesName,
  scientificName,
  slug,
  description,
  imageUrl,
  organismType,
  genus,
  species,
  morph,
  difficulty,
  origin,
  temperature,
  humidity,
}: Props) {
  const path = `/isopedia/${slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${path}#article`,
        headline: `${speciesName} Care Guide`,
        description,
        image: imageUrl ? [imageUrl] : undefined,
        author: {
          "@type": "Organization",
          name: "Isopedia",
        },
        publisher: {
          "@type": "Organization",
          name: "Isopedia",
          logo: {
            "@type": "ImageObject",
            url: "/crest-logo.png",
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": path,
        },
        about: {
          "@type": "Thing",
          name: speciesName,
          alternateName: scientificName || undefined,
          additionalProperty: [
            organismType
              ? {
                  "@type": "PropertyValue",
                  name: "Organism Type",
                  value: organismType,
                }
              : null,
            genus
              ? {
                  "@type": "PropertyValue",
                  name: "Genus",
                  value: genus,
                }
              : null,
            species
              ? {
                  "@type": "PropertyValue",
                  name: "Species",
                  value: species,
                }
              : null,
            morph
              ? {
                  "@type": "PropertyValue",
                  name: "Morph",
                  value: morph,
                }
              : null,
            difficulty
              ? {
                  "@type": "PropertyValue",
                  name: "Care Difficulty",
                  value: difficulty,
                }
              : null,
            origin
              ? {
                  "@type": "PropertyValue",
                  name: "Origin",
                  value: origin,
                }
              : null,
            temperature
              ? {
                  "@type": "PropertyValue",
                  name: "Temperature",
                  value: temperature,
                }
              : null,
            humidity
              ? {
                  "@type": "PropertyValue",
                  name: "Humidity",
                  value: humidity,
                }
              : null,
          ].filter(Boolean),
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${path}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Isopedia",
            item: "/isopedia",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: speciesName,
            item: path,
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