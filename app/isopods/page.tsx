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
  "Learn what isopods are, how they are used in bioactive enclosures, and browse community-verified Isopedia species profiles.";

const faqs: FaqItem[] = [
  {
    question: "What do isopods eat?",
    answer:
      "Most kept isopods rely on leaf litter and decaying wood as staple foods, with calcium and small supplemental foods added carefully.",
  },
  {
    question: "Do isopods need humidity?",
    answer:
      "Yes. Terrestrial isopods need moisture to breathe and molt properly, but most cultures do best with a moisture gradient rather than one evenly wet setup.",
  },
  {
    question: "Are isopods good pets?",
    answer:
      "Many isopods can be good low-space pets, but care difficulty varies by species. Beginner species are usually a better first choice than sensitive display species.",
  },
  {
    question: "Can isopods live in bioactive reptile enclosures?",
    answer:
      "Many keepers use isopods in bioactive reptile and amphibian enclosures, but species choice, humidity, temperature, animal safety, and local rules all matter.",
  },
];

export const metadata: Metadata = {
  title: "Isopods",
  description,
  alternates: {
    canonical: absoluteIsopediaUrl("/isopods"),
  },
  openGraph: {
    title: "Isopods | Isopedia",
    description,
    url: absoluteIsopediaUrl("/isopods"),
    siteName: "Isopedia",
    type: "article",
    images: [
      {
        url: absoluteIsopediaUrl("/isopedia-social-preview.jpg"),
        width: 1200,
        height: 630,
        alt: "Isopedia isopod resource",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Isopods | Isopedia",
    description,
    images: [absoluteIsopediaUrl("/isopedia-social-preview.jpg")],
  },
};

export default async function IsopodsPage() {
  const {
    popularSpecies,
    beginnerSpecies,
    heroSpecies,
    generalDiscussions,
  } = await getIsopodResourceData();

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <ResourcePageStructuredData
        path="/isopods"
        title="Isopods"
        description={description}
        breadcrumbs={[
          { name: "Isopedia", path: "/" },
          { name: "Isopods", path: "/isopods" },
        ]}
        faqs={faqs}
      />

      <div className="mx-auto max-w-6xl">
        <IsopediaNav active="database" />

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/" className="font-bold text-emerald-300 underline">
            Back to Database
          </Link>
          <Link
            href="/isopod-care"
            className="rounded-lg border border-emerald-400/30 px-4 py-2 font-black text-emerald-100 transition hover:bg-emerald-400/10"
          >
            Isopod Care Guide
          </Link>
        </div>

        <ResourceHero
          kicker="Isopod Resource"
          title="Isopods"
          description="A practical introduction to isopods, bioactive cleanup crews, pet species, and community-verified Isopedia care profiles."
          primaryHref="#popular-isopods"
          primaryLabel="Browse Isopod Species"
          secondaryHref="/community/new?category=general-discussion"
          secondaryLabel="Ask The Community"
          imageUrl={heroSpecies?.image_url || null}
          imageAlt={heroSpecies?.common_name || "Isopedia isopod species"}
          visualNote="This page uses verified Isopedia species entries and points new keepers into the database instead of replacing species-specific care."
        />

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-5">
            <ResourceBlock kicker="Overview" title="What Are Isopods?">
              <p>
                Isopods are crustaceans that include familiar land-dwelling
                woodlice, pill bugs, and many hobby species kept in culture bins
                or bioactive enclosures. In the hobby, keepers value them as
                pets, display animals, cleanup crews, and tiny recyclers that
                help break down leaf litter and organic waste.
              </p>
              <p className="mt-4">
                Isopedia focuses on the care side: species profiles, temperature
                and humidity ranges, morph names, keeper notes, photos, and
                community discussions that help people compare real-world
                experience.
              </p>
            </ResourceBlock>

            <ResourceBlock kicker="Database Preview" title="Popular Isopods In Isopedia">
              <SpeciesResourceGrid species={popularSpecies} />
              <Link
                href="/"
                className="mt-4 inline-flex rounded-lg border border-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
              >
                View all verified entries
              </Link>
            </ResourceBlock>

            <ResourceBlock kicker="Beginner Friendly" title="Starter Isopod Species">
              <p className="mb-4">
                Beginner-friendly species usually tolerate normal keeper mistakes
                better than sensitive display species. Always check the species
                page before setting up a culture.
              </p>
              <SpeciesResourceGrid species={beginnerSpecies} />
            </ResourceBlock>

            <ResourceBlock kicker="Bioactive Setups" title="Isopods As Cleanup Crew">
              <p>
                In bioactive terrariums and vivariums, isopods help process leaf
                litter, shed, leftover food, and other organic material. They are
                often paired with springtails because the two groups occupy
                different parts of the cleanup crew role.
              </p>
              <p className="mt-4">
                The best species depends on enclosure humidity, temperature,
                inhabitants, and how much visible activity you want. Isopedia
                species profiles make those comparisons easier.
              </p>
              <Link
                href="/isopod-care"
                className="mt-5 inline-flex rounded-lg bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Read The Isopod Care Guide
              </Link>
            </ResourceBlock>

            <ResourceBlock kicker="FAQ" title="Common Isopod Questions">
              <FaqGrid faqs={faqs} />
            </ResourceBlock>
          </div>

          <div className="grid content-start gap-5">
            <SideCard kicker="Care Starts Here" title="Learn The Basics">
              <p>
                Start with temperature, humidity, substrate, food, calcium, and
                ventilation basics, then use individual species pages for exact
                care ranges.
              </p>
              <Link
                href="/isopod-care"
                className="mt-4 inline-flex rounded-lg bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Isopod Care Guide
              </Link>
            </SideCard>

            <SideCard kicker="Quick Topics" title="What New Keepers Compare">
              <SnapshotGrid
                items={[
                  {
                    title: "Difficulty",
                    body: "Beginner, intermediate, and sensitive species need different expectations.",
                  },
                  {
                    title: "Humidity",
                    body: "Moisture needs vary, but most cultures need a stable humid retreat.",
                  },
                  {
                    title: "Visibility",
                    body: "Some species are bold and active, while others stay hidden most of the time.",
                  },
                  {
                    title: "Bioactive Fit",
                    body: "Cleanup crew choices should match enclosure conditions and animal safety.",
                  },
                ]}
              />
            </SideCard>

            <SideCard kicker="Community" title="Recent Isopod Discussions">
              <DiscussionList
                discussions={generalDiscussions}
                emptyText="No isopod discussions have been published yet."
              />
            </SideCard>
          </div>
        </div>
      </div>
    </main>
  );
}
