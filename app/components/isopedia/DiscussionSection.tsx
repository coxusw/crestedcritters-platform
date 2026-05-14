"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createDiscussionComment,
  deleteDiscussionComment,
  editDiscussionComment,
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
  profiles: {
    username: string | null;
    display_name: string | null;
    business_name: string | null;
  } | null;
};

type Props = {
  entityType: "species";
  entityId: string;
  entityPath: string;
  comments: DiscussionComment[];
  isLoggedIn: boolean;
  currentUserId: string | null;
  canModerate: boolean;
};

function getAuthorName(comment: DiscussionComment) {
  return (
    comment.profiles?.display_name ||
    comment.profiles?.business_name ||
    comment.profiles?.username ||
    "Unknown User"
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function DiscussionSection({
  entityType,
  entityId,
  entityPath,
  comments,
  isLoggedIn,
  currentUserId,
  canModerate,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editBodies, setEditBodies] = useState<Record<string, string>>({});
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});

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

    topLevel.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    for (const [parentId, items] of replies.entries()) {
      replies.set(
        parentId,
        items.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      );
    }

    return {
      topLevelComments: topLevel,
      repliesByParent: replies,
    };
  }, [comments]);

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

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-xl shadow-black/20 sm:p-8">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
          Community
        </p>

        <h2 className="mt-2 text-3xl font-black text-white">
          Species Discussion
        </h2>

        <p className="mt-3 text-slate-400">
          Discuss care, breeding, observations, questions, and experiences with
          this species.
        </p>
      </div>

      {isLoggedIn ? (
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
                  isPending={isPending}
                  editingCommentId={editingCommentId}
                  editBody={editBodies[comment.id] ?? comment.body}
                  setEditingCommentId={setEditingCommentId}
                  setEditBodies={setEditBodies}
                  submitEdit={submitEdit}
                />

                <div className="ml-0 space-y-3 border-l border-white/10 pl-4 sm:ml-6 sm:pl-5">
                  {replies.map((reply) => (
                    <CommentCard
                      key={reply.id}
                      comment={reply}
                      entityPath={entityPath}
                      currentUserId={currentUserId}
                      canModerate={canModerate}
                      isPending={isPending}
                      editingCommentId={editingCommentId}
                      editBody={editBodies[reply.id] ?? reply.body}
                      setEditingCommentId={setEditingCommentId}
                      setEditBodies={setEditBodies}
                      submitEdit={submitEdit}
                      isReply
                    />
                  ))}

                  {comment.status === "active" &&
                  isLoggedIn &&
                  replyingTo === comment.id ? (
                    <form
                      action={(formData) => submitReply(formData, comment.id)}
                      className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"
                    >
                      <input type="hidden" name="entity_type" value={entityType} />
                      <input type="hidden" name="entity_id" value={entityId} />
                      <input type="hidden" name="parent_id" value={comment.id} />
                      <input type="hidden" name="return_path" value={entityPath} />

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
                  ) : comment.status === "active" && isLoggedIn ? (
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
  isPending,
  editingCommentId,
  editBody,
  setEditingCommentId,
  setEditBodies,
  submitEdit,
  isReply = false,
}: {
  comment: DiscussionComment;
  entityPath: string;
  currentUserId: string | null;
  canModerate: boolean;
  isPending: boolean;
  editingCommentId: string | null;
  editBody: string;
  setEditingCommentId: (id: string | null) => void;
  setEditBodies: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  submitEdit: (formData: FormData, commentId: string) => void;
  isReply?: boolean;
}) {
  const author = getAuthorName(comment);
  const isOwner = currentUserId === comment.user_id;
  const canEdit = comment.status === "active" && isOwner;
  const canDelete = comment.status === "active" && (isOwner || canModerate);
  const isEditing = editingCommentId === comment.id;

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

      {(canEdit || canDelete) && !isEditing && (
        <div className="mt-4 flex flex-wrap gap-2">
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
                value={canModerate && !isOwner ? "Moderator removed" : "User removed"}
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
        </div>
      )}
    </article>
  );
}