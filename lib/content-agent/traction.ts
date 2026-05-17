import { createSupabaseAdminClient } from "./supabase-admin";

type RawPayload = Record<string, unknown> | null;

export type TractionMetrics = {
  reactions: number;
  comments: number;
  shares: number;
  saves: number;
  notes: string;
  score: number;
  updatedAt: string | null;
};

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export function calculateTractionScore(metrics: Omit<TractionMetrics, "score" | "updatedAt">) {
  return (
    metrics.reactions +
    metrics.comments * 3 +
    metrics.shares * 6 +
    metrics.saves * 4
  );
}

export function parseTractionMetrics(rawPayload: RawPayload): TractionMetrics {
  const traction =
    rawPayload && typeof rawPayload === "object"
      ? (rawPayload.traction as Record<string, unknown> | undefined)
      : undefined;

  const base = {
    reactions: numberValue(traction?.reactions),
    comments: numberValue(traction?.comments),
    shares: numberValue(traction?.shares),
    saves: numberValue(traction?.saves),
    notes: String(traction?.notes || ""),
  };

  return {
    ...base,
    score: numberValue(traction?.score) || calculateTractionScore(base),
    updatedAt: typeof traction?.updatedAt === "string" ? traction.updatedAt : null,
  };
}

export async function getTractionGuidanceForPage(pageKey: string) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("content_agent_posts")
    .select("topic, post_type, caption, raw_payload, posted_at")
    .eq("page_key", pageKey)
    .eq("status", "Posted")
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(150);

  if (error) throw new Error(error.message);

  const scored = (data || [])
    .map((post) => ({
      topic: post.topic || "Untitled",
      postType: post.post_type || "Unknown",
      caption: String(post.caption || "").slice(0, 500),
      traction: parseTractionMetrics(post.raw_payload as RawPayload),
    }))
    .filter((post) => post.traction.score > 0)
    .sort((a, b) => b.traction.score - a.traction.score)
    .slice(0, 8);

  if (!scored.length) {
    return "No manual traction data has been entered yet. Do not infer winners from empty metrics.";
  }

  return [
    "Use these manually entered traction winners to steer style, angles, and topic selection. Do not copy captions. Learn from the patterns.",
    ...scored.map((post, index) =>
      [
        `${index + 1}. ${post.topic} (${post.postType})`,
        `score=${post.traction.score}`,
        `reactions=${post.traction.reactions}`,
        `comments=${post.traction.comments}`,
        `shares=${post.traction.shares}`,
        `saves=${post.traction.saves}`,
        post.traction.notes ? `admin notes=${post.traction.notes}` : "",
        `caption sample=${post.caption}`,
      ]
        .filter(Boolean)
        .join(" | ")
    ),
  ].join("\n");
}
