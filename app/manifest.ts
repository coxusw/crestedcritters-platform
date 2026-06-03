import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Isopedia",
    short_name: "Isopedia",
    description: "Community bioactive database for isopods, springtails, and cleanup crews.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#07130c",
    theme_color: "#10b981",
    icons: [
      {
        src: "/isopedia-app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
