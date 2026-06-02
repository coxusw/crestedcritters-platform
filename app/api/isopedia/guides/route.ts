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
    return NextResponse.json({ error: "Sign in before adding a guide." }, { status: 401 });
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid guide payload." }, { status: 400 });
  }

  const slug = cleanText(body.slug);
  const title = cleanText(body.title);
  const guideBody = cleanText(body.body);

  if (!slug || title.length < 3 || guideBody.length < 20) {
    return NextResponse.json({ error: "Guide title and body are required." }, { status: 400 });
  }

  const { data: guide, error } = await supabase
    .from("isopedia_guides")
    .insert({
      slug,
      title,
      body: guideBody,
      author_user_id: user.id,
      status: "published",
    })
    .select("id, slug")
    .single<{ id: string; slug: string }>();

  if (error || !guide) {
    return NextResponse.json({ error: error?.message || "Could not create guide." }, { status: 500 });
  }

  await awardIsoTokens(supabase, {
    profileId: user.id,
    amount: 5,
    reason: "guide_submission",
    reasonKey: `guide_submission:${guide.id}`,
    description: "Published a community guide.",
    entityType: "guide",
    entityId: guide.id,
  });

  return NextResponse.json({ guide });
}
