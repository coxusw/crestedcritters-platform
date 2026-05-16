import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import {
  approvePostFromEditor,
  publishPostFromEditor,
  rejectPostFromEditor,
  updateContentAgentPost,
} from "./actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    notice?: string;
    error?: string;
  }>;
};

type ContentPost = {
  id: string;
  page_key: string;
  scheduled_at: string;
  post_type: string;
  topic: string | null;
  caption: string | null;
  hashtags: string | null;
  meme_top_text: string | null;
  meme_bottom_text: string | null;
  image_prompt: string | null;
  image_url: string | null;
  image_storage_path: string | null;
  status: string;
  approval_notes: string | null;
  posted_at: string | null;
  facebook_post_id: string | null;
  facebook_post_url: string | null;
  error: string | null;
  source_type: string | null;
  source_ref_id: string | null;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const STATUSES = ["Draft", "Needs Edit", "Approved", "Rejected", "Posted", "Error"];

export default async function ContentAgentPostEditPage({
  params,
  searchParams,
}: PageProps) {
  await requireContentAgentAdmin();

  const { id } = await params;
  const query = await searchParams;

  const supabase = createSupabaseAdminClient();

  const { data: post, error } = await supabase
    .from("content_agent_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!post) notFound();

  const typedPost = post as ContentPost;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link className="text-emerald-300 underline" href="/admin/content-agent">
            ← Back to Queue
          </Link>
          <Link className="text-emerald-300 underline" href="/admin/content-agent/settings">
            Settings & Schedule
          </Link>
          <Link className="text-emerald-300 underline" href="/admin/content-agent/topics">
            TopicBank Editor
          </Link>
        </div>

        <header className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
            Queue Editor
          </p>
          <h1 className="mt-3 text-3xl font-bold">
            Edit {typedPost.page_key} / {typedPost.post_type}
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            Source: {typedPost.source_type || "unknown"} · ID: {typedPost.id}
          </p>
        </header>

        {query?.notice && (
          <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-100">
            <div className="font-semibold">Success</div>
            <pre className="mt-2 whitespace-pre-wrap text-sm">{query.notice}</pre>
          </div>
        )}

        {query?.error && (
          <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-4 text-red-100">
            <div className="font-semibold">Error</div>
            <pre className="mt-2 whitespace-pre-wrap text-sm">{query.error}</pre>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <InfoCard label="Status" value={typedPost.status} />
          <InfoCard label="Scheduled" value={new Date(typedPost.scheduled_at).toLocaleString()} />
          <InfoCard label="Posted" value={typedPost.posted_at ? new Date(typedPost.posted_at).toLocaleString() : "Not posted"} />
          <InfoCard label="Image" value={typedPost.image_url ? "Attached" : "None"} />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <form action={updateContentAgentPost} className="space-y-5">
            <input type="hidden" name="post_id" value={typedPost.id} />

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  Scheduled Date/Time
                </span>
                <input
                  type="datetime-local"
                  name="scheduled_at"
                  defaultValue={toDateTimeLocalValue(typedPost.scheduled_at)}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-emerald-300"
                />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  Status
                </span>
                <select
                  name="status"
                  defaultValue={typedPost.status}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-emerald-300"
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <TextField
                name="topic"
                label="Topic"
                defaultValue={typedPost.topic || ""}
              />
            </div>

            <TextareaField
              name="caption"
              label="Caption"
              defaultValue={typedPost.caption || ""}
              rows={9}
            />

            <TextareaField
              name="hashtags"
              label="Hashtags"
              defaultValue={typedPost.hashtags || ""}
              rows={3}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <TextareaField
                name="meme_top_text"
                label="Meme Top Text"
                defaultValue={typedPost.meme_top_text || ""}
                rows={3}
              />
              <TextareaField
                name="meme_bottom_text"
                label="Meme Bottom Text"
                defaultValue={typedPost.meme_bottom_text || ""}
                rows={3}
              />
            </div>

            <TextareaField
              name="image_prompt"
              label="Image Prompt"
              defaultValue={typedPost.image_prompt || ""}
              rows={6}
            />

            <TextField
              name="image_url"
              label="Image URL"
              defaultValue={typedPost.image_url || ""}
            />

            {typedPost.image_url && (
              <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Image Preview
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={typedPost.image_url}
                  alt="Content agent post image preview"
                  className="mt-3 max-h-96 rounded-2xl object-contain"
                />
              </div>
            )}

            <TextareaField
              name="approval_notes"
              label="Approval Notes"
              defaultValue={typedPost.approval_notes || ""}
              rows={4}
            />

            <TextareaField
              name="error"
              label="Error"
              defaultValue={typedPost.error || ""}
              rows={4}
            />

            <label className="flex items-center gap-3 rounded-2xl bg-slate-950/70 p-4">
              <input type="checkbox" name="clear_error" className="h-5 w-5" />
              <span className="font-semibold">Clear error on save</span>
            </label>

            <div className="flex flex-wrap gap-3">
              <button className="rounded-2xl bg-emerald-400 px-5 py-2 font-bold text-slate-950 hover:bg-emerald-300">
                Save Changes
              </button>
              <Link
                href="/admin/content-agent"
                className="rounded-2xl border border-white/10 px-5 py-2 font-semibold text-slate-100 hover:bg-white/10"
              >
                Back to Queue
              </Link>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-bold">Quick Actions</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {typedPost.status !== "Approved" && typedPost.status !== "Posted" && (
              <form action={approvePostFromEditor.bind(null, typedPost.id)}>
                <button className="rounded-2xl bg-emerald-500 px-5 py-2 font-bold text-slate-950">
                  Approve
                </button>
              </form>
            )}

            {typedPost.status !== "Rejected" && typedPost.status !== "Posted" && (
              <form action={publishPostFromEditor.bind(null, typedPost.id)}>
                <button className="rounded-2xl bg-sky-400 px-5 py-2 font-bold text-slate-950">
                  Publish Now
                </button>
              </form>
            )}

            {typedPost.status !== "Rejected" && typedPost.status !== "Posted" && (
              <form action={rejectPostFromEditor.bind(null, typedPost.id)}>
                <button className="rounded-2xl bg-red-500 px-5 py-2 font-bold text-white">
                  Reject
                </button>
              </form>
            )}

            {typedPost.facebook_post_url && (
              <a
                href={typedPost.facebook_post_url}
                target="_blank"
                className="rounded-2xl border border-white/10 px-5 py-2 font-semibold text-slate-100 hover:bg-white/10"
              >
                Open Facebook Post
              </a>
            )}
          </div>
        </section>

        <details className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <summary className="cursor-pointer text-lg font-bold text-emerald-300">
            Raw Payload
          </summary>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950/80 p-4 text-xs text-slate-300">
            {JSON.stringify(typedPost.raw_payload || {}, null, 2)}
          </pre>
        </details>
      </div>
    </main>
  );
}

function TextField({
  name,
  label,
  defaultValue = "",
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-emerald-300"
      />
    </label>
  );
}

function TextareaField({
  name,
  label,
  defaultValue = "",
  rows = 4,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none focus:border-emerald-300"
      />
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (num: number) => String(num).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}
