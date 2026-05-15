import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://www.crestedcritters.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/isopedia",
          "/isopedia/",
          "/isopedia/expos",
          "/profile/",
        ],
        disallow: [
          "/admin/",
          "/api/",
          "/login",
          "/logout",
        ],
      },
    ],

    sitemap: `${baseUrl}/sitemap.xml`,
  };
}