import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

type Species = {
  slug: string;
  updated_at: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const defaultPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/isopedia`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/isopedia/submit`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/isopedia/review`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.4,
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

  const { data: species, error } = await supabase
    .from("isopedia_species")
    .select("slug, updated_at")
    .not("slug", "is", null)
    .returns<Species[]>();

  if (error || !species) {
    return defaultPages;
  }

  const speciesPages = species
    .filter((entry) => entry.slug)
    .map((entry) => ({
      url: `${baseUrl}/isopedia/${entry.slug}`,
      lastModified: entry.updated_at
        ? new Date(entry.updated_at)
        : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  return [...defaultPages, ...speciesPages];
}