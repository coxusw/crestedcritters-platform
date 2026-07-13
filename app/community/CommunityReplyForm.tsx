"use client";

import { useState } from "react";
import CommunityFormShell from "@/app/community/CommunityFormShell";

const COMMUNITY_REPLY_DRAFT_PREFIX = "isopedia-community-reply-draft";

function draftKey(discussionId: string) {
  return `${COMMUNITY_REPLY_DRAFT_PREFIX}-${discussionId}`;
}

function readDraft(key: string) {
  if (typeof window === "undefined") return "";

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "null") as {
      body?: unknown;
    } | null;
    return typeof parsed?.body === "string" ? parsed.body : "";
  } catch {
    return "";
  }
}

export default function CommunityReplyForm({
  action,
  discussionId,
  imagesEnabled,
}: {
  action: (formData: FormData) => Promise<void>;
  discussionId: string;
  imagesEnabled: boolean;
}) {
  const storageKey = draftKey(discussionId);
  const [body, setBody] = useState("");
  const [draftNotice, setDraftNotice] = useState("");

  function saveDraft(nextBody: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify({ body: nextBody }));
  }

  function restoreDraft() {
    const draftBody = readDraft(storageKey);
    if (!draftBody) {
      setDraftNotice("No saved reply draft found.");
      return;
    }
    setBody(draftBody);
    setDraftNotice("Reply draft restored.");
  }

  function clearDraft() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
    setBody("");
    setDraftNotice("Reply draft cleared.");
  }

  return (
    <CommunityFormShell
      action={action}
      className="mt-6 grid gap-3"
      draftStorageKey={storageKey}
    >
      <input type="hidden" name="discussion_id" value={discussionId} />
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <button
          type="button"
          onClick={restoreDraft}
          className="rounded-lg border border-emerald-400/25 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-400/10"
        >
          Restore Draft
        </button>
        <button
          type="button"
          onClick={clearDraft}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-emerald-50/80 hover:bg-white/10"
        >
          Clear Draft
        </button>
        {draftNotice && (
          <span className="text-xs font-bold text-emerald-50/55">{draftNotice}</span>
        )}
      </div>
      <label className="grid gap-2">
        <span className="text-sm font-black text-emerald-50/80">Reply</span>
        <textarea
          name="body"
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            saveDraft(event.target.value);
          }}
          required
          minLength={2}
          rows={5}
          className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
        />
      </label>
      {imagesEnabled && (
        <div className="grid gap-3">
          <label className="grid gap-2">
            <span className="text-sm font-black text-emerald-50/80">Images</span>
            <input
              name="image_files"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-sm text-emerald-50/80 outline-none file:mr-4 file:rounded-md file:border-0 file:bg-emerald-400 file:px-4 file:py-2 file:font-black file:text-slate-950 hover:file:bg-emerald-300"
            />
            <span className="text-xs text-emerald-50/45">
              Add up to 5 JPG, PNG, WEBP, or GIF images. Each image must be under 10MB.
            </span>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-black text-emerald-50/80">
              New Image Captions
            </span>
            <textarea
              name="new_image_captions"
              rows={3}
              maxLength={900}
              className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-sm text-white outline-none ring-emerald-400/30 placeholder:text-emerald-50/30 focus:ring-4"
              placeholder="Required when adding images. Add one caption per image, in the same order."
            />
          </label>
        </div>
      )}
      <button
        data-submitting-label="Submitting..."
        className="w-fit rounded-lg bg-emerald-400 px-5 py-3 font-black text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Post Reply
      </button>
    </CommunityFormShell>
  );
}
