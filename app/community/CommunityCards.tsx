import Link from "next/link";
import {
  type CommunityDiscussion,
  type InlineBadge,
  communityExcerpt,
  communityProfileName,
} from "@/lib/community";

export function DiscussionCard({
  discussion,
  badges = [],
}: {
  discussion: CommunityDiscussion;
  badges?: InlineBadge[];
}) {
  const authorName = communityProfileName(discussion.author);
  const authorHref = discussion.author?.username
    ? `/profile/${discussion.author.username}`
    : null;

  return (
    <article className="rounded-lg border border-white/10 bg-black/20 p-4 transition hover:border-emerald-300/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {discussion.pinned && (
              <span className="rounded-md bg-amber-300 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-950">
                Pinned
              </span>
            )}
            <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-100">
              {discussion.content_type}
            </span>
            {discussion.category && (
              <Link
                href={`/community/category/${discussion.category.slug}`}
                className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-200 hover:bg-white/10"
              >
                {discussion.category.name}
              </Link>
            )}
            {discussion.answered && (
              <span className="rounded-md bg-lime-300/15 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-lime-100">
                Answered
              </span>
            )}
          </div>

          <h2 className="mt-3 text-xl font-black text-white">
            <Link href={`/community/discussion/${discussion.slug}`} className="hover:text-emerald-200">
              {discussion.title}
            </Link>
          </h2>

          <p className="mt-2 line-clamp-2 text-sm leading-6 text-emerald-50/65">
            {discussion.excerpt || communityExcerpt(discussion.body)}
          </p>
        </div>

        <div className="grid min-w-24 grid-cols-3 gap-2 text-center text-xs text-emerald-50/60">
          <Metric label="Replies" value={discussion.reply_count} />
          <Metric label="Views" value={discussion.view_count} />
          <Metric label="Saves" value={discussion.save_count} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-emerald-50/45">
        <span>By</span>
        {authorHref ? (
          <Link href={authorHref} className="font-bold text-emerald-300 hover:text-emerald-200">
            @{discussion.author?.username}
          </Link>
        ) : (
          <span className="font-bold text-emerald-100">{authorName}</span>
        )}
        <InlineBadges badges={badges} />
        <span>•</span>
        <span>{formatDate(discussion.last_activity_at)}</span>
      </div>
    </article>
  );
}

export function InlineBadges({ badges }: { badges: InlineBadge[] }) {
  if (!badges.length) return null;

  return (
    <span className="flex flex-wrap items-center gap-1">
      {badges.map((badge) => (
        <span
          key={badge.id}
          title={badge.description || badge.label}
          className="max-w-32 truncate rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-black text-emerald-100"
        >
          {badge.icon ? `${badge.icon} ` : ""}
          {badge.label}
        </span>
      ))}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#07130c] px-2 py-1">
      <div className="font-black text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wide">{label}</div>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
