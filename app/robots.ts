import type { MetadataRoute } from "next";
import { getIsopediaBaseUrl, isStagingDeployment } from "@/lib/isopedia-site";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getIsopediaBaseUrl();

  if (isStagingDeployment()) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
      sitemap: `${baseUrl}/sitemap.xml`,
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/expos",
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
