import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.crestedcritters.com";

  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/isopedia",
        "/isopedia/",
      ],
      disallow: [
        "/admin/",
        "/api/",
      ],
    },

    sitemap: `${baseUrl}/sitemap.xml`,
  };
}