import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { awardIsoTokens } from "@/lib/isotokens";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
    return NextResponse.json({ error: "Invalid image payload." }, { status: 400 });
  }

  const speciesId = Number(body.speciesId);
  const imageUrl = cleanText(body.imageUrl);
  const caption = cleanText(body.caption);

  if (!Number.isFinite(speciesId) || speciesId <= 0 || !imageUrl) {
    return NextResponse.json({ error: "Missing gallery image details." }, { status: 400 });
  }

  const { data: image, error } = await supabase
    .from("isopedia_species_images")
    .insert({
      species_id: speciesId,
      image_url: imageUrl,
      caption: caption || null,
      credit_user_id: user.id,
      status: "unverified",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !image) {
    return NextResponse.json({ error: error?.message || "Could not save image." }, { status: 500 });
  }

  await awardIsoTokens(supabase, {
    profileId: user.id,
    amount: 2,
    reason: "gallery_photo_submission",
    reasonKey: `gallery_photo_submission:${image.id}`,
    description: "Submitted a species gallery photo.",
    entityType: "species_image",
    entityId: image.id,
  });

  return NextResponse.json({ ok: true, id: image.id });
}
