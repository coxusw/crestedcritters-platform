import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import BirthDateGate from "@/app/components/legal/BirthDateGate";
import LegalAcceptanceGate from "@/app/components/legal/LegalAcceptanceGate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://isopedia.crestedcritters.com";
const isopediaPreviewImage = `${siteUrl}/isopedia-social-preview.jpg`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "Isopedia | Community Bioactive Database",
    template: "%s | Isopedia",
  },

  description:
    "Community-driven bioactive database for isopods, springtails, millipedes, beetles, and other cleanup crew species.",

  keywords: [
    "isopods",
    "isopod care",
    "bioactive",
    "springtails",
    "millipedes",
    "beetles",
    "terrarium",
    "vivarium",
    "cleanup crew",
    "isopedia",
  ],

  openGraph: {
    title: "Isopedia",
    description:
      "Community-driven bioactive database for isopods, springtails, millipedes, beetles, and more.",
    url: siteUrl,
    siteName: "Isopedia",
    images: [
      {
        url: isopediaPreviewImage,
        width: 1200,
        height: 630,
        alt: "Isopedia community bioactive database",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Isopedia",
    description:
      "Community-driven bioactive database for isopods, springtails, millipedes, beetles, and more.",
    images: [isopediaPreviewImage],
  },

  robots: {
    index: true,
    follow: true,
  },

  alternates: {
    canonical: siteUrl,
  },

  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/isopedia-favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/isopedia-favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-[#07130c] text-white">
        <Script id="isopedia-theme" strategy="beforeInteractive">
          {`
            try {
              var theme = window.localStorage.getItem("isopedia-theme");
              if (theme === "light" || theme === "dark") {
                document.documentElement.dataset.isopediaTheme = theme;
              }
            } catch (error) {}
          `}
        </Script>
        {children}
        <LegalAcceptanceGate />
        <BirthDateGate />
      </body>
    </html>
  );
}
