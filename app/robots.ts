import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getIsopediaBaseUrl, isStagingDeployment } from "@/lib/isopedia-site";
import { randomizerBaseUrl } from "@/lib/randomizer-site";
import { shopBaseUrl } from "@/lib/shop";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") || headersList.get("host") || "";
  const cleanHost = host.toLowerCase().split(":")[0];
  const isRandomizerHost = cleanHost === "randomizer.crestedcritters.com";
  const isShopHost = cleanHost === "shop.crestedcritters.com";
  const baseUrl = isRandomizerHost
    ? randomizerBaseUrl
    : isShopHost
      ? shopBaseUrl()
      : getIsopediaBaseUrl();

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
        allow: isRandomizerHost
          ? ["/", "/faq", "/verify", "/results/"]
          : isShopHost
            ? ["/", "/products/", "/faq", "/live-shipping"]
            : [
                "/",
                "/expos",
                "/profile/",
              ],
        disallow: [
          "/admin/",
          "/api/",
          "/login",
          "/logout",
          "/signup",
          "/reset-password",
          "/update-password",
          "/account",
          "/billing",
          "/cart",
        ],
      },
    ],

    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
