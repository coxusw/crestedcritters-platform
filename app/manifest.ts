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
        src: "/isopedia-app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/isopedia-app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
