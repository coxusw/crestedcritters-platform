import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { awardIsoTokens } from "@/lib/isotokens";
import { communityExcerpt } from "@/lib/community";
import { isUnderRestrictedAge } from "@/lib/isopedia-age";

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

  const [
    { data: guideCategory, error: categoryError },
    { data: profile },
    { data: adminProfile },
    { data: activeBan },
  ] = await Promise.all([
    supabase
      .from("community_categories")
      .select("id, requires_approval, is_active")
      .eq("slug", "guides")
      .maybeSingle<{
        id: string;
        requires_approval: boolean;
        is_active: boolean;
      }>(),
    supabase
      .from("profiles")
      .select("role, birth_date")
      .eq("id", user.id)
      .maybeSingle<{ role: string | null; birth_date: string | null }>(),
    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
    supabase
      .from("isopedia_discussion_bans")
      .select("id, reason")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle<{ id: string; reason: string | null }>(),
  ]);

  if (categoryError) {
    return NextResponse.json({ error: categoryError.message }, { status: 500 });
  }

  if (!guideCategory?.is_active) {
    return NextResponse.json({ error: "Guides category is not available." }, { status: 404 });
  }

  if (activeBan) {
    return NextResponse.json(
      {
        error: activeBan.reason
          ? `You are currently banned from discussions: ${activeBan.reason}`
          : "You are currently banned from discussions.",
      },
      { status: 403 }
    );
  }

  if (profile?.birth_date && isUnderRestrictedAge(profile.birth_date)) {
    return NextResponse.json(
      { error: "Discussion posting is disabled for accounts under the age of 13." },
      { status: 403 }
    );
  }

  const canModerate =
    Boolean(adminProfile) ||
    profile?.role === "admin" ||
    profile?.role === "moderator";
  const status = guideCategory.requires_approval && !canModerate ? "pending" : "published";

  const { data: guide, error } = await supabase
    .from("community_discussions")
    .insert({
      category_id: guideCategory.id,
      author_id: user.id,
      slug,
      title,
      body: guideBody,
      excerpt: communityExcerpt(guideBody),
      content_type: "guide",
      status,
      moderation_status: status === "pending" ? "pending" : "clear",
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
    entityType: "community_discussion",
    entityId: guide.id,
  });

  revalidatePath("/community");
  revalidatePath("/community/category/guides");
  revalidatePath("/guides");

  return NextResponse.json({ guide });
}
