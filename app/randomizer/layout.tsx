import type { Metadata } from "next";
import { absoluteRandomizerUrl, randomizerBaseUrl } from "@/lib/randomizer-site";

export const metadata: Metadata = {
  metadataBase: new URL(randomizerBaseUrl),
  title: {
    default: "Randomizer",
    template: "%s | Randomizer",
  },
  description: "Generate official giveaway randomizer results with saved verification pages.",
  alternates: {
    canonical: absoluteRandomizerUrl("/"),
  },
  openGraph: {
    title: "Randomizer",
    description: "Official Crested Critters giveaway randomizer with saved verification pages.",
    url: absoluteRandomizerUrl("/"),
    siteName: "Randomizer",
    images: [absoluteRandomizerUrl("/randomizer-preview.svg")],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Randomizer",
    description: "Official Crested Critters giveaway randomizer with saved verification pages.",
    images: [absoluteRandomizerUrl("/randomizer-preview.svg")],
  },
  icons: {
    icon: "/randomizer-icon.svg",
    shortcut: "/randomizer-icon.svg",
  },
};

export default function RandomizerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
