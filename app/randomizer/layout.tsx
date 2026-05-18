import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Randomizer",
    template: "%s | Randomizer",
  },
  description: "Generate official giveaway randomizer results with saved verification pages.",
  openGraph: {
    title: "Randomizer",
    description: "Official Crested Critters giveaway randomizer with saved verification pages.",
    siteName: "Randomizer",
    images: ["/randomizer-preview.svg"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Randomizer",
    description: "Official Crested Critters giveaway randomizer with saved verification pages.",
    images: ["/randomizer-preview.svg"],
  },
  icons: {
    icon: "/randomizer-icon.svg",
    shortcut: "/randomizer-icon.svg",
  },
};

export default function RandomizerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
