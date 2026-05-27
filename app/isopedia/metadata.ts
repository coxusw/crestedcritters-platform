import type { Metadata } from "next";
import { absoluteIsopediaUrl } from "@/lib/isopedia-site";

export const isopediaMetadata: Metadata = {
  title: "Isopedia | Community Bioactive Database",
  description:
    "Community-verified care guides, profiles, discussions, collections, and expo information for isopods, springtails, millipedes, beetles, and bioactive cleanup crew species.",
  alternates: {
    canonical: absoluteIsopediaUrl("/"),
  },
  openGraph: {
    title: "Isopedia | Community Bioactive Database",
    description:
      "Community-verified bioactive care guides, species profiles, collections, discussions, and expo information.",
    url: absoluteIsopediaUrl("/"),
    siteName: "Isopedia",
    type: "website",
    images: [
      {
        url: absoluteIsopediaUrl("/isopedia-social-preview.jpg"),
        width: 1200,
        height: 630,
        alt: "Isopedia community bioactive database",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Isopedia | Community Bioactive Database",
    description:
      "Community-verified bioactive care guides, species profiles, collections, discussions, and expo information.",
    images: [absoluteIsopediaUrl("/isopedia-social-preview.jpg")],
  },
};
