import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://www.crestedcritters.com";

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
    url: `${siteUrl}/isopedia`,
    siteName: "Isopedia",
    images: [
      {
        url: "/crest-logo.png",
        width: 1200,
        height: 630,
        alt: "Isopedia",
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
    images: ["/crest-logo.png"],
  },

  robots: {
    index: true,
    follow: true,
  },

  alternates: {
    canonical: `${siteUrl}/isopedia`,
  },

  icons: {
    icon: "/favicon.ico",
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
    >
      <body className="min-h-full flex flex-col bg-[#07130c] text-white">
        {children}
      </body>
    </html>
  );
}