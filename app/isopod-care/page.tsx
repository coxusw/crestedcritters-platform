import type { Metadata } from "next";
import Link from "next/link";
import { absoluteIsopediaUrl } from "@/lib/isopedia-site";
import { getIsopodResourceData } from "@/lib/isopod-resource-data";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import ResourcePageStructuredData from "@/app/components/isopedia/ResourcePageStructuredData";
import {
  DiscussionList,
  FaqGrid,
  ResourceBlock,
  ResourceHero,
  SideCard,
  SnapshotGrid,
  SpeciesResourceGrid,
  type FaqItem,
} from "@/app/components/isopedia/IsopodResourceSections";

const description =
  "A practical isopod care guide covering housing, substrate, humidity, feeding, calcium, ventilation, and species-specific care.";

const faqs: FaqItem[] = [
  {
    question: "How often should I feed isopods?",
    answer:
      "Keep leaf litter available at all times and offer small supplemental foods only as needed. Remove excess food before it molds.",
  },
  {
    question: "Do isopods need calcium?",
    answer:
      "Yes. Calcium supports healthy molts and reproduction. Keepers often use cuttlebone, limestone, eggshell, or other safe calcium sources.",
  },
  {
    question: "Why are my isopods dying?",
    answer:
      "Common causes include cultures drying out, stagnant wet conditions, overheating, poor ventilation, overfeeding, or a mismatch between species and setup.",
  },
  {
    question: "Can isopods drown?",
    answer:
      "Isopods need moisture, but standing water and soaked conditions can be dangerous. Most setups should provide a moist retreat without flooding the culture.",
  },
];

export const metadata: Metadata = {
  title: "Isopod Care Guide",
  description,
  alternates: {
    canonical: absoluteIsopediaUrl("/isopod-care"),
  },
  openGraph: {
    title: "Isopod Care Guide | Isopedia",
    description,
    url: absoluteIsopediaUrl("/isopod-care"),
    siteName: "Isopedia",
    type: "article",
    images: [
      {
        url: absoluteIsopediaUrl("/isopedia-social-preview.jpg"),
        width: 1200,
        height: 630,
        alt: "Isopedia isopod care guide",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Isopod Care Guide | Isopedia",
    description,
    images: [absoluteIsopediaUrl("/isopedia-social-preview.jpg")],
  },
};

export default async function IsopodCarePage() {
  const {
    popularSpecies,
    heroSpecies,
    careDiscussions,
  } = await getIsopodResourceData();

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <ResourcePageStructuredData
        path="/isopod-care"
        title="Isopod Care Guide"
        description={description}
        breadcrumbs={[
          { name: "Isopedia", path: "/" },
          { name: "Isopods", path: "/isopods" },
          { name: "Isopod Care Guide", path: "/isopod-care" },
        ]}
        faqs={faqs}
      />

      <div className="mx-auto max-w-6xl">
        <IsopediaNav active="database" />

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/isopods" className="font-bold text-emerald-300 underline">
            Back to Isopods
          </Link>
          <Link
            href="/community/new?category=guides"
            className="rounded-lg border border-emerald-400/30 px-4 py-2 font-black text-emerald-100 transition hover:bg-emerald-400/10"
          >
            Start A Care Discussion
          </Link>
        </div>

        <ResourceHero
          kicker="Care Resource"
          title="Isopod Care Guide"
          description="A practical care overview for keeping isopods healthy in cultures, terrariums, and bioactive enclosures."
          primaryHref="#care-snapshot"
          primaryLabel="Quick Care Snapshot"
          secondaryHref="/community/new?category=guides"
          secondaryLabel="Ask A Care Question"
          imageUrl={heroSpecies?.image_url || null}
          imageAlt={heroSpecies?.common_name || "Isopedia isopod care"}
          visualNote="This general guide gives the care foundation, then sends keepers to species pages for exact humidity, temperature, and difficulty details."
        />

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-5">
            <ResourceBlock kicker="Quick Start" title="Quick Care Snapshot">
              <SnapshotGrid
                items={[
                  {
                    title: "Temperature",
                    body: "Species-specific, commonly room temperature to warm room ranges.",
                  },
                  {
                    title: "Humidity",
                    body: "Most cultures need a moisture gradient, not one evenly wet bin.",
                  },
                  {
                    title: "Substrate",
                    body: "Organic substrate deep enough to hold moisture and support burrowing.",
                  },
                  {
                    title: "Food",
                    body: "Leaf litter first, with calcium and supplemental foods added carefully.",
                  },
                  {
                    title: "Calcium",
                    body: "Keep a safe calcium source available for molts and reproduction.",
                  },
                  {
                    title: "Ventilation",
                    body: "Use enough airflow to reduce stagnant conditions without drying the culture.",
                  },
                ]}
              />
            </ResourceBlock>

            <ResourceBlock kicker="Setup" title="Housing And Substrate">
              <p>
                A basic culture should give isopods enough substrate depth,
                hides, leaf litter, decaying wood, ventilation, and a moist
                retreat. Different species handle dryness, heat, and airflow
                differently, so the general guide should always point users into
                species-specific profiles.
              </p>
              <p className="mt-4">
                For most cultures, the substrate should hold moisture without
                becoming swampy. A wet side and a drier side let the animals
                choose the microclimate they need.
              </p>
            </ResourceBlock>

            <ResourceBlock kicker="Moisture" title="Humidity And Ventilation">
              <p>
                Most problems come from extremes: cultures that dry out
                completely, or cultures that stay wet and stagnant. A good setup
                gives isopods a humid retreat while still allowing enough
                airflow to prevent stale conditions.
              </p>
              <p className="mt-4">
                Watch the animals and the substrate. If the culture smells sour,
                stays soaked, or grows mold quickly, reduce excess food and
                improve ventilation. If animals cluster at the wettest spot or
                molts fail, the culture may be too dry.
              </p>
            </ResourceBlock>

            <ResourceBlock kicker="Feeding" title="Feeding Isopods">
              <p>
                Leaf litter and decaying wood should be the foundation. Calcium
                sources and protein can be added, but overfeeding creates mold,
                pests, and culture stress.
              </p>
              <p className="mt-4">
                Supplemental foods should be offered in small amounts and
                removed if they are not eaten. Species and colony size affect how
                quickly food disappears.
              </p>
            </ResourceBlock>

            <ResourceBlock kicker="Troubleshooting" title="Common Problems">
              <ul className="ml-5 list-disc space-y-2">
                <li>Mold from too much supplemental food.</li>
                <li>Die-offs from drying out or stagnant wet conditions.</li>
                <li>Slow breeding from stress, low nutrition, or immature cultures.</li>
                <li>Mites or pests from excess food and poor maintenance.</li>
              </ul>
            </ResourceBlock>

            <ResourceBlock kicker="Species Matter" title="Species-Specific Care Matters">
              <p className="mb-4">
                Not all isopods want the same setup. Use this page as the care
                foundation, then compare individual Isopedia species profiles
                before setting up a culture.
              </p>
              <SpeciesResourceGrid species={popularSpecies} />
            </ResourceBlock>

            <ResourceBlock kicker="FAQ" title="Care Questions">
              <FaqGrid faqs={faqs} />
            </ResourceBlock>
          </div>

          <div className="grid content-start gap-5">
            <SideCard kicker="Browse" title="Species Care Profiles">
              <p>
                Compare difficulty, temperature, humidity, genus, morph, and
                keeper-submitted images in the verified database.
              </p>
              <Link
                href="/isopods"
                className="mt-4 inline-flex rounded-lg bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Browse Isopods
              </Link>
            </SideCard>

            <SideCard kicker="Community" title="Recent Care Discussions">
              <DiscussionList
                discussions={careDiscussions}
                emptyText="No care discussions have been published yet."
              />
            </SideCard>

            <SideCard kicker="Guides" title="Community Guides">
              <p>
                The care hub is the evergreen starting point. Member guides and
                discussions in the community can go deeper into specific setups,
                enclosure builds, and keeper experience.
              </p>
              <Link
                href="/community/category/guides"
                className="mt-4 inline-flex rounded-lg border border-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
              >
                Visit Guides
              </Link>
            </SideCard>
          </div>
        </div>
      </div>
    </main>
  );
}
