import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type SpeciesMatchRow = {
  id: number;
  common_name: string | null;
  scientific_name: string | null;
  genus: string | null;
  species: string | null;
  morph: string | null;
  slug: string | null;
};

type SubmissionMatchRow = {
  id: string;
  common_name: string | null;
  scientific_name: string | null;
  genus: string | null;
  species: string | null;
  morph: string | null;
  created_at: string | null;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactScientific(row: {
  scientific_name?: string | null;
  genus?: string | null;
  species?: string | null;
  morph?: string | null;
}) {
  return normalize(
    row.scientific_name ||
      [row.genus, row.species, row.morph].filter(Boolean).join(" ")
  );
}

function similar(left: string, right: string) {
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 5 && right.includes(left)) return true;
  if (right.length >= 5 && left.includes(right)) return true;
  return false;
}

function isMatch(
  input: { commonName: string; scientificName: string; morph: string },
  row: SpeciesMatchRow | SubmissionMatchRow
) {
  const common = normalize(row.common_name);
  const scientific = compactScientific(row);
  const morph = normalize(row.morph);

  return (
    similar(input.scientificName, scientific) ||
    (similar(input.commonName, common) &&
      (!input.morph || !morph || similar(input.morph, morph))) ||
    (Boolean(input.morph) && similar(input.morph, morph) && similar(input.commonName, common))
  );
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before submitting." }, { status: 401 });
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid duplicate-check payload." }, { status: 400 });
  }

  const input = {
    commonName: normalize(cleanText(body.commonName)),
    scientificName: normalize(cleanText(body.scientificName)),
    morph: normalize(cleanText(body.morph)),
  };

  if (!input.commonName && !input.scientificName && !input.morph) {
    return NextResponse.json({ matches: [] });
  }

  const [speciesResult, submissionsResult] = await Promise.all([
    supabase
      .from("isopedia_species")
      .select("id, common_name, scientific_name, genus, species, morph, slug")
      .limit(5000)
      .returns<SpeciesMatchRow[]>(),
    supabase
      .from("isopedia_submissions")
      .select("id, common_name, scientific_name, genus, species, morph, created_at")
      .eq("status", "unverified")
      .limit(5000)
      .returns<SubmissionMatchRow[]>(),
  ]);

  if (speciesResult.error || submissionsResult.error) {
    return NextResponse.json(
      { error: speciesResult.error?.message || submissionsResult.error?.message || "Could not check for similar entries." },
      { status: 500 }
    );
  }

  const existingSpecies = (speciesResult.data || [])
    .filter((row) => isMatch(input, row))
    .slice(0, 4)
    .map((row) => ({
      id: String(row.id),
      type: "species" as const,
      title: row.common_name || row.scientific_name || "Existing species",
      detail: row.scientific_name || [row.genus, row.species, row.morph].filter(Boolean).join(" "),
      href: row.slug ? `/${row.slug}` : "/",
    }));

  const pendingSubmissions = (submissionsResult.data || [])
    .filter((row) => isMatch(input, row))
    .slice(0, 4)
    .map((row) => ({
      id: row.id,
      type: "submission" as const,
      title: row.common_name || row.scientific_name || "Pending submission",
      detail: row.scientific_name || [row.genus, row.species, row.morph].filter(Boolean).join(" "),
      href: `/verify#submission-${row.id}`,
    }));

  return NextResponse.json({
    matches: [...existingSpecies, ...pendingSubmissions].slice(0, 6),
  });
}
