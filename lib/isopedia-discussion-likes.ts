import type { createSupabaseServerClient } from "@/lib/supabase-server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type DiscussionWithLikeFields = {
  id: string;
  like_count?: number;
  liked_by_current_user?: boolean;
};

export async function attachDiscussionLikes<
  T extends DiscussionWithLikeFields,
>(
  supabase: SupabaseServerClient,
  comments: T[] | null | undefined,
  currentUserId: string | null | undefined
) {
  const rows = comments || [];
  const ids = rows.map((comment) => comment.id).filter(Boolean);

  if (ids.length === 0) {
    return rows.map((comment) => ({
      ...comment,
      like_count: 0,
      liked_by_current_user: false,
    }));
  }

  const { data, error } = await supabase
    .from("isopedia_discussion_likes")
    .select("comment_id, user_id")
    .in("comment_id", ids)
    .returns<Array<{ comment_id: string; user_id: string }>>();

  if (error) {
    return rows.map((comment) => ({
      ...comment,
      like_count: 0,
      liked_by_current_user: false,
    }));
  }

  const counts = new Map<string, number>();
  const liked = new Set<string>();

  for (const item of data || []) {
    counts.set(item.comment_id, (counts.get(item.comment_id) || 0) + 1);

    if (currentUserId && item.user_id === currentUserId) {
      liked.add(item.comment_id);
    }
  }

  return rows.map((comment) => ({
    ...comment,
    like_count: counts.get(comment.id) || 0,
    liked_by_current_user: liked.has(comment.id),
  }));
}
