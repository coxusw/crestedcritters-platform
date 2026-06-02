"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

export async function toggleGuideLike(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be logged in.");
  }

  const guideId = cleanText(formData.get("guide_id"));
  const returnPath = cleanText(formData.get("return_path")) || "/guides";

  if (!guideId) {
    throw new Error("Missing guide.");
  }

  const { data: guide, error: guideError } = await supabase
    .from("isopedia_guides")
    .select("id, author_user_id, status")
    .eq("id", guideId)
    .maybeSingle<{
      id: string;
      author_user_id: string;
      status: string;
    }>();

  if (guideError) {
    throw new Error(guideError.message);
  }

  if (!guide || guide.status !== "published") {
    throw new Error("Guide not found.");
  }

  if (guide.author_user_id === user.id) {
    throw new Error("You cannot like your own guide.");
  }

  const { data: existingLike, error: existingError } = await supabase
    .from("isopedia_guide_likes")
    .select("id")
    .eq("guide_id", guideId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingLike) {
    const { error } = await supabase
      .from("isopedia_guide_likes")
      .delete()
      .eq("id", existingLike.id);

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { error } = await supabase.from("isopedia_guide_likes").insert({
      guide_id: guideId,
      user_id: user.id,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath(returnPath);
  revalidatePath("/guides");
}
