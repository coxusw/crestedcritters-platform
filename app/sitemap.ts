import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { getIsopediaBaseUrl, isStagingDeployment } from "@/lib/isopedia-site";
import { publicSpeciesSlug } from "@/lib/isopedia-slugs";

type Species = {
  slug: string;
  updated_at: string | null;
};

type Expo = {
  slug: string;
  updated_at: string | null;
};

type Guide = {
  slug: string;
  updated_at: string | null;
  created_at: string | null;
};

type Profile = {
  username: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getIsopediaBaseUrl();

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
      url: `${baseUrl}/guides`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },

  ];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return defaultPages;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const [
    speciesResult,
    exposResult,
    guidesResult,
    profilesResult,
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
      .from("isopedia_guides")
      .select("slug, updated_at, created_at")
      .eq("status", "published")
      .not("slug", "is", null)
      .returns<Guide[]>(),

    supabase
      .from("profiles")
      .select("username")
      .not("username", "is", null)
      .returns<Profile[]>(),
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

  const guidePages =
    guidesResult.data?.map((guide) => ({
      url: `${baseUrl}/guides/${guide.slug}`,
      lastModified: guide.updated_at
        ? new Date(guide.updated_at)
        : guide.created_at
          ? new Date(guide.created_at)
          : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })) || [];

  return [
    ...defaultPages,
    ...speciesPages,
    ...expoPages,
    ...guidePages,
    ...profilePages,
  ];
}
