import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getIsopediaBaseUrl, isStagingDeployment } from "@/lib/isopedia-site";
import { publicSpeciesSlug } from "@/lib/isopedia-slugs";
import { randomizerBaseUrl } from "@/lib/randomizer-site";
import { shopBaseUrl } from "@/lib/shop";

type Species = {
  slug: string;
  updated_at: string | null;
};

type Expo = {
  slug: string;
  updated_at: string | null;
};

type CommunityDiscussion = {
  slug: string;
  updated_at: string | null;
  created_at: string | null;
  content_type: string;
};

type Profile = {
  username: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    return [
      {
        url: `${baseUrl}/`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.1,
      },
    ];
  }

  if (isRandomizerHost) {
    return [
      {
        url: `${baseUrl}/`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 1,
      },
      {
        url: `${baseUrl}/verify`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.8,
      },
      {
        url: `${baseUrl}/faq`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.7,
      },
    ];
  }

  const defaultPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },

    {
      url: `${baseUrl}/expos`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },

    {
      url: `${baseUrl}/community`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },

    {
      url: `${baseUrl}/community/category/guides`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },

    {
      url: `${baseUrl}/isotoken-store/earn`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },

  ];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return isShopHost ? shopDefaultPages(baseUrl) : defaultPages;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (isShopHost) {
    const { data: products } = await supabase
      .from("shop_products")
      .select("slug, updated_at")
      .eq("active", true)
      .not("slug", "is", null)
      .returns<Array<{ slug: string; updated_at: string | null }>>();

    return [
      ...shopDefaultPages(baseUrl),
      ...(products?.map((product) => ({
        url: `${baseUrl}/products/${product.slug}`,
        lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })) || []),
    ];
  }

  const [
    speciesResult,
    exposResult,
    profilesResult,
    communityResult,
  ] = await Promise.all([
    supabase
      .from("isopedia_species")
      .select("slug, updated_at")
      .not("slug", "is", null)
      .returns<Species[]>(),

    supabase
      .from("isopedia_expos")
      .select("slug, updated_at")
      .eq("status", "approved")
      .not("slug", "is", null)
      .returns<Expo[]>(),

    supabase
      .from("profiles")
      .select("username")
      .not("username", "is", null)
      .returns<Profile[]>(),

    supabase
      .from("community_discussions")
      .select("slug, updated_at, created_at, content_type")
      .eq("status", "published")
      .not("slug", "is", null)
      .returns<CommunityDiscussion[]>(),
  ]);

  const speciesPages =
    speciesResult.data?.map((entry) => ({
      url: `${baseUrl}/${publicSpeciesSlug(entry.slug)}`,
      lastModified: entry.updated_at
        ? new Date(entry.updated_at)
        : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })) || [];

  const expoPages =
    exposResult.data?.map((expo) => ({
      url: `${baseUrl}/expos/${expo.slug}`,
      lastModified: expo.updated_at
        ? new Date(expo.updated_at)
        : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })) || [];

  const profilePages =
    profilesResult.data
      ?.filter((profile) => profile.username)
      .map((profile) => ({
        url: `${baseUrl}/profile/${profile.username}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })) || [];

  const communityPages =
    communityResult.data?.map((discussion) => ({
      url: `${baseUrl}/community/discussion/${discussion.slug}`,
      lastModified: discussion.updated_at
        ? new Date(discussion.updated_at)
        : discussion.created_at
          ? new Date(discussion.created_at)
          : new Date(),
      changeFrequency: "weekly" as const,
      priority: discussion.content_type === "guide" ? 0.7 : 0.6,
    })) || [];

  return [
    ...defaultPages,
    ...speciesPages,
    ...expoPages,
    ...communityPages,
    ...profilePages,
  ];
}

function shopDefaultPages(baseUrl: string): MetadataRoute.Sitemap {
  return [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/live-shipping`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
