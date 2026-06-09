"use client";

import {
  type Dispatch,
  type SetStateAction,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  createDiscussionComment,
  deleteDiscussionComment,
  editDiscussionComment,
  reportDiscussionComment,
  toggleDiscussionLike,
} from "@/app/components/isopedia/discussion-actions";

type DiscussionComment = {
  id: string;
  parent_id: string | null;
  user_id: string;
  body: string;
  status: "active" | "deleted" | "hidden";
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  like_count?: number;
  liked_by_current_user?: boolean;
  profiles: {
    username: string | null;
    display_name: string | null;
    business_name: string | null;
  } | null;
};

type DiscussionBan = {
  reason: string | null;
  expires_at: string | null;
};

type Props = {
  entityType: "species" | "expo" | "guide";
  entityId: string;
  entityPath: string;
  comments: DiscussionComment[];
  isLoggedIn: boolean;
  currentUserId: string | null;
  canModerate: boolean;
  activeDiscussionBan: DiscussionBan | null;
  canPostDiscussion?: boolean;
  discussionRestrictionMessage?: string | null;
};

function getAuthorName(comment: DiscussionComment) {
  return (
    comment.profiles?.display_name ||
    comment.profiles?.business_name ||
    comment.profiles?.username ||
    "Unknown User"
  );
}

function LikeControl({
  comment,
  entityPath,
  currentUserId,
  isLoggedIn,
  isDiscussionBanned,
  isPending,
}: {
  comment: DiscussionComment;
  entityPath: string;
  currentUserId: string | null;
  isLoggedIn: boolean;
  isDiscussionBanned: boolean;
  isPending: boolean;
}) {
  const likeCount = comment.like_count || 0;
  const canLike =
    comment.status === "active" &&
    isLoggedIn &&
    currentUserId !== comment.user_id &&
    !isDiscussionBanned;

  if (!canLike) {
    return (
      <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300">
        {likeCount} like{likeCount === 1 ? "" : "s"}
      </span>
    );
  }

  return (
    <form action={toggleDiscussionLike}>
      <input type="hidden" name="comment_id" value={comment.id} />
      <input type="hidden" name="return_path" value={entityPath} />
      <button
        type="submit"
        disabled={isPending}
        className={`rounded-xl border px-3 py-2 text-xs font-black transition disabled:opacity-50 ${
          comment.liked_by_current_user
            ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/20"
            : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
        }`}
      >
        {comment.liked_by_current_user ? "Liked" : "Like"} - {likeCount}
      </button>
    </form>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatBanMessage(activeDiscussionBan: DiscussionBan) {
  const until = activeDiscussionBan.expires_at
    ? ` until ${new Date(activeDiscussionBan.expires_at).toLocaleString()}`
    : "";

  return `You are currently banned from discussions${until}.${
    activeDiscussionBan.reason ? ` Reason: ${activeDiscussionBan.reason}` : ""
  }`;
}

function discussionTitle(entityType: Props["entityType"]) {
  if (entityType === "expo") return "Expo Discussion";
  if (entityType === "guide") return "Guide Discussion";
  return "Species Discussion";
}

function discussionDescription(entityType: Props["entityType"]) {
  if (entityType === "expo") {
    return "Discuss attendance, vending, travel plans, questions, and expo experiences.";
  }

  if (entityType === "guide") {
    return "Discuss the guide, ask follow-up questions, and share related experience.";
  }

  return "Discuss care, breeding, observations, questions, and experiences with this species.";
}

export default function DiscussionSection({
  entityType,
  entityId,
  entityPath,
  comments,
  isLoggedIn,
  currentUserId,
  canModerate,
  activeDiscussionBan,
  canPostDiscussion = true,
  discussionRestrictionMessage = null,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(
    null
  );
  const [editBodies, setEditBodies] = useState<Record<string, string>>({});
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});
  const [reportDetails, setReportDetails] = useState("");
  const [reportReason, setReportReason] = useState("Spam");
  const [sortMode, setSortMode] = useState<"newest" | "most_liked">("newest");

  const isDiscussionBanned = Boolean(activeDiscussionBan);

  const { topLevelComments, repliesByParent } = useMemo(() => {
    const topLevel: DiscussionComment[] = [];
    const replies = new Map<string, DiscussionComment[]>();

    for (const comment of comments) {
      if (comment.parent_id) {
        const existing = replies.get(comment.parent_id) || [];
        existing.push(comment);
        replies.set(comment.parent_id, existing);
      } else {
        topLevel.push(comment);
      }
    }

    topLevel.sort((a, b) => {
      if (sortMode === "most_liked") {
        const likeDiff = (b.like_count || 0) - (a.like_count || 0);
        if (likeDiff !== 0) return likeDiff;
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    for (const [parentId, items] of replies.entries()) {
      replies.set(
        parentId,
        items.sort((a, b) => {
          if (sortMode === "most_liked") {
            const likeDiff = (b.like_count || 0) - (a.like_count || 0);
            if (likeDiff !== 0) return likeDiff;
          }

          return (
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
          );
        })
      );
    }

    return {
      topLevelComments: topLevel,
      repliesByParent: replies,
    };
  }, [comments, sortMode]);

  function submitTopLevelComment(formData: FormData) {
    startTransition(async () => {
      await createDiscussionComment(formData);
      setBody("");
    });
  }

  function submitReply(formData: FormData, parentId: string) {
    startTransition(async () => {
      await createDiscussionComment(formData);

      setReplyBodies((current) => ({
        ...current,
        [parentId]: "",
      }));

      setReplyingTo(null);
    });
  }

  function submitEdit(formData: FormData, commentId: string) {
    startTransition(async () => {
      await editDiscussionComment(formData);

      setEditBodies((current) => ({
        ...current,
        [commentId]: "",
      }));

      setEditingCommentId(null);
    });
  }

  function submitReport(formData: FormData) {
    startTransition(async () => {
      await reportDiscussionComment(formData);
      setReportingCommentId(null);
      setReportDetails("");
      setReportReason("Spam");
    });
  }

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-xl shadow-black/20 sm:p-8">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
          Community
        </p>

        <h2 className="mt-2 text-3xl font-black text-white">
          {discussionTitle(entityType)}
        </h2>

        <p className="mt-3 text-slate-400">
          {discussionDescription(entityType)}
        </p>
      </div>

      {isLoggedIn && activeDiscussionBan ? (
        <div className="mb-8 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm leading-6 text-red-100">
          {formatBanMessage(activeDiscussionBan)}
        </div>
      ) : isLoggedIn && !canPostDiscussion ? (
        <div className="mb-8 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
          {discussionRestrictionMessage ||
            "Discussion posting is disabled for this account."}
        </div>
      ) : isLoggedIn ? (
        <form action={submitTopLevelComment} className="mb-8">
          <input type="hidden" name="entity_type" value={entityType} />
          <input type="hidden" name="entity_id" value={entityId} />
          <input type="hidden" name="return_path" value={entityPath} />

          <textarea
            name="body"
            required
            minLength={2}
            maxLength={5000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Share care tips, observations, questions, breeding experiences, etc..."
            className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 text-white outline-none transition focus:border-emerald-400/40"
          />

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Keep discussions respectful and on-topic.
            </p>

            <button
              type="submit"
              disabled={isPending || body.trim().length < 2}
              className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Posting..." : "Post Comment"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-8 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
          You must be logged in to participate in discussions.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-400">
          {topLevelComments.length} discussion thread
          {topLevelComments.length === 1 ? "" : "s"}
        </p>

        <div className="flex rounded-xl border border-white/10 bg-slate-950/70 p-1">
          <button
            type="button"
            onClick={() => setSortMode("newest")}
            className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
              sortMode === "newest"
                ? "bg-emerald-400 text-slate-950"
                : "text-slate-300 hover:bg-white/10"
            }`}
          >
            Newest
          </button>
          <button
            type="button"
            onClick={() => setSortMode("most_liked")}
            className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
              sortMode === "most_liked"
                ? "bg-emerald-400 text-slate-950"
                : "text-slate-300 hover:bg-white/10"
            }`}
          >
            Most Liked
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {topLevelComments.length > 0 ? (
          topLevelComments.map((comment) => {
            const replies = repliesByParent.get(comment.id) || [];
            const replyBody = replyBodies[comment.id] || "";

            return (
              <div key={comment.id} className="space-y-3">
                <CommentCard
                  comment={comment}
                  entityPath={entityPath}
                  currentUserId={currentUserId}
                  canModerate={canModerate}
                  isDiscussionBanned={isDiscussionBanned}
                  isPending={isPending}
                  editingCommentId={editingCommentId}
                  reportingCommentId={reportingCommentId}
                  editBody={editBodies[comment.id] ?? comment.body}
                  reportReason={reportReason}
                  reportDetails={reportDetails}
                  setEditingCommentId={setEditingCommentId}
                  setReportingCommentId={setReportingCommentId}
                  setEditBodies={setEditBodies}
                  setReportReason={setReportReason}
                  setReportDetails={setReportDetails}
                  submitEdit={submitEdit}
                  submitReport={submitReport}
                  isLoggedIn={isLoggedIn}
                />

                <div className="ml-0 space-y-3 border-l border-white/10 pl-4 sm:ml-6 sm:pl-5">
                  {replies.map((reply) => (
                    <CommentCard
                      key={reply.id}
                      comment={reply}
                      entityPath={entityPath}
                      currentUserId={currentUserId}
                      canModerate={canModerate}
                      isDiscussionBanned={isDiscussionBanned}
                      isPending={isPending}
                      editingCommentId={editingCommentId}
                      reportingCommentId={reportingCommentId}
                      editBody={editBodies[reply.id] ?? reply.body}
                      reportReason={reportReason}
                      reportDetails={reportDetails}
                      setEditingCommentId={setEditingCommentId}
                      setReportingCommentId={setReportingCommentId}
                      setEditBodies={setEditBodies}
                      setReportReason={setReportReason}
                      setReportDetails={setReportDetails}
                      submitEdit={submitEdit}
                      submitReport={submitReport}
                      isLoggedIn={isLoggedIn}
                      isReply
                    />
                  ))}

                  {comment.status === "active" &&
                  isLoggedIn &&
                  canPostDiscussion &&
                  !isDiscussionBanned &&
                  replyingTo === comment.id ? (
                    <form
                      action={(formData) => submitReply(formData, comment.id)}
                      className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"
                    >
                      <input
                        type="hidden"
                        name="entity_type"
                        value={entityType}
                      />
                      <input type="hidden" name="entity_id" value={entityId} />
                      <input type="hidden" name="parent_id" value={comment.id} />
                      <input
                        type="hidden"
                        name="return_path"
                        value={entityPath}
                      />

                      <textarea
                        name="body"
                        required
                        minLength={2}
                        maxLength={5000}
                        value={replyBody}
                        onChange={(event) =>
                          setReplyBodies((current) => ({
                            ...current,
                            [comment.id]: event.target.value,
                          }))
                        }
                        placeholder="Write a reply..."
                        className="min-h-[100px] w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-emerald-400/40"
                      />

                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setReplyingTo(null)}
                          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
                        >
                          Cancel
                        </button>

                        <button
                          type="submit"
                          disabled={isPending || replyBody.trim().length < 2}
                          className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isPending ? "Posting..." : "Post Reply"}
                        </button>
                      </div>
                    </form>
                  ) : comment.status === "active" &&
                    isLoggedIn &&
                    canPostDiscussion &&
                    !isDiscussionBanned ? (
                    <button
                      type="button"
                      onClick={() => setReplyingTo(comment.id)}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-emerald-300 transition hover:bg-white/10 hover:text-emerald-200"
                    >
                      Reply
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-8 text-center">
            <p className="text-slate-400">
              No discussion yet. Be the first to contribute.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function CommentCard({
  comment,
  entityPath,
  currentUserId,
  canModerate,
  isDiscussionBanned,
  isPending,
  editingCommentId,
  reportingCommentId,
  editBody,
  reportReason,
  reportDetails,
  setEditingCommentId,
  setReportingCommentId,
  setEditBodies,
  setReportReason,
  setReportDetails,
  submitEdit,
  submitReport,
  isLoggedIn,
  isReply = false,
}: {
  comment: DiscussionComment;
  entityPath: string;
  currentUserId: string | null;
  canModerate: boolean;
  isDiscussionBanned: boolean;
  isPending: boolean;
  editingCommentId: string | null;
  reportingCommentId: string | null;
  editBody: string;
  reportReason: string;
  reportDetails: string;
  setEditingCommentId: (id: string | null) => void;
  setReportingCommentId: (id: string | null) => void;
  setEditBodies: Dispatch<SetStateAction<Record<string, string>>>;
  setReportReason: (value: string) => void;
  setReportDetails: (value: string) => void;
  submitEdit: (formData: FormData, commentId: string) => void;
  submitReport: (formData: FormData) => void;
  isLoggedIn: boolean;
  isReply?: boolean;
}) {
  const author = getAuthorName(comment);
  const isOwner = currentUserId === comment.user_id;
  const canEdit = comment.status === "active" && isOwner && !isDiscussionBanned;
  const canDelete = comment.status === "active" && (isOwner || canModerate);
  const canReport =
    comment.status === "active" && isLoggedIn && !isOwner && !isDiscussionBanned;
  const isEditing = editingCommentId === comment.id;
  const isReporting = reportingCommentId === comment.id;

  if (comment.status === "deleted") {
    return (
      <article className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
        <p className="text-sm italic text-slate-500">
          This comment was deleted.
        </p>
      </article>
    );
  }

  return (
    <article
      className={`rounded-2xl border border-white/10 bg-slate-950/70 p-5 ${
        isReply ? "bg-slate-950/50" : ""
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-white">{author}</p>

          {comment.profiles?.username && (
            <p className="text-sm text-emerald-300">
              Username: {comment.profiles.username}
            </p>
          )}
        </div>

        <div className="text-right">
          <p className="text-xs text-slate-500">
            {formatDate(comment.created_at)}
          </p>

          {comment.edited_at && (
            <p className="mt-1 text-xs text-slate-600">Edited</p>
          )}
        </div>
      </div>

      {isEditing ? (
        <form action={(formData) => submitEdit(formData, comment.id)}>
          <input type="hidden" name="comment_id" value={comment.id} />
          <input type="hidden" name="return_path" value={entityPath} />

          <textarea
            name="body"
            required
            minLength={2}
            maxLength={5000}
            value={editBody}
            onChange={(event) =>
              setEditBodies((current) => ({
                ...current,
                [comment.id]: event.target.value,
              }))
            }
            className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-emerald-400/40"
          />

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingCommentId(null)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isPending || editBody.trim().length < 2}
              className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save Edit
            </button>
          </div>
        </form>
      ) : (
        <div className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
          {comment.body}
        </div>
      )}

      {!isEditing && (
        <div className="mt-4 flex flex-wrap gap-2">
          <LikeControl
            comment={comment}
            entityPath={entityPath}
            currentUserId={currentUserId}
            isLoggedIn={isLoggedIn}
            isDiscussionBanned={isDiscussionBanned}
            isPending={isPending}
          />

          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setEditBodies((current) => ({
                  ...current,
                  [comment.id]: comment.body,
                }));
                setEditingCommentId(comment.id);
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
            >
              Edit
            </button>
          )}

          {canDelete && (
            <form action={deleteDiscussionComment}>
              <input type="hidden" name="comment_id" value={comment.id} />
              <input type="hidden" name="return_path" value={entityPath} />
              <input
                type="hidden"
                name="reason"
                value={
                  canModerate && !isOwner ? "Moderator removed" : "User removed"
                }
              />

              <button
                type="submit"
                disabled={isPending}
                className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-200 transition hover:bg-red-400/20 disabled:opacity-50"
              >
                {canModerate && !isOwner ? "Mod Delete" : "Delete"}
              </button>
            </form>
          )}

          {canReport && (
            <button
              type="button"
              onClick={() => setReportingCommentId(comment.id)}
              className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-400/20"
            >
              Report
            </button>
          )}
        </div>
      )}

      {isReporting && (
        <form
          action={submitReport}
          className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4"
        >
          <input type="hidden" name="comment_id" value={comment.id} />
          <input type="hidden" name="return_path" value={entityPath} />

          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-100/70">
              Report Reason
            </span>

            <select
              name="reason"
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="Spam">Spam</option>
              <option value="Harassment">Harassment</option>
              <option value="Misinformation">Misinformation</option>
              <option value="Off-topic">Off-topic</option>
              <option value="Inappropriate content">Inappropriate content</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <label className="mt-3 grid gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-100/70">
              Details Optional
            </span>

            <textarea
              name="details"
              value={reportDetails}
              onChange={(event) => setReportDetails(event.target.value)}
              placeholder="Add context for moderators..."
              className="min-h-[90px] rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            />
          </label>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReportingCommentId(null)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-amber-300 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-200 disabled:opacity-50"
            >
              Submit Report
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
