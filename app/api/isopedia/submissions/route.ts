import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSubmissionReviewAlertPost } from "@/lib/content-agent/isopedia";

const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Expert"] as const;

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanImageUrl(value: unknown) {
  const imageUrl = cleanText(value);

  if (!imageUrl) return null;

  try {
    const url = new URL(imageUrl);
    return url.protocol === "https:" ? imageUrl : null;
  } catch {
    return null;
  }
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
    return NextResponse.json({ error: "Invalid submission payload." }, { status: 400 });
  }

  const organismType = cleanText(body.organismType);
  const genus = cleanText(body.genus);
  const species = cleanText(body.species);
  const morph = cleanText(body.morph);
  const commonName = cleanText(body.commonName);
  const scientificName = cleanText(body.scientificName);
  const tradeNames = cleanText(body.tradeNames);
  const difficulty = cleanText(body.difficulty);
  const origin = cleanText(body.origin);
  const temperature = cleanText(body.temperature);
  const humidity = cleanText(body.humidity);
  const diet = cleanText(body.diet);
  const substrate = cleanText(body.substrate);
  const notes = cleanText(body.notes);
  const imageUrl = cleanImageUrl(body.imageUrl);

  if (!commonName) {
    return NextResponse.json({ error: "Common name is required." }, { status: 400 });
  }

  if (
    difficulty &&
    !DIFFICULTY_OPTIONS.includes(difficulty as (typeof DIFFICULTY_OPTIONS)[number])
  ) {
    return NextResponse.json(
      { error: "Difficulty must be Beginner, Intermediate, or Expert." },
      { status: 400 }
    );
  }

  const submissionId = crypto.randomUUID();
  const { error } = await supabase.from("isopedia_submissions").insert({
    id: submissionId,
    organism_type: organismType || null,
    genus: genus || null,
    species: species || null,
    morph: morph || null,
    common_name: commonName,
    scientific_name: scientificName || null,
    trade_names: tradeNames || null,
    difficulty: difficulty || null,
    origin: origin || null,
    temperature: temperature || null,
    humidity: humidity || null,
    diet: diet || null,
    substrate: substrate || null,
    notes: notes || null,
    image_url: imageUrl,
    submitted_by: user.id,
    status: "unverified",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await createSubmissionReviewAlertPost(submissionId);
  } catch (autoPostError) {
    console.error("Failed to auto-create Isopedia submission review alert:", autoPostError);
  }

  return NextResponse.json({ ok: true });
}
