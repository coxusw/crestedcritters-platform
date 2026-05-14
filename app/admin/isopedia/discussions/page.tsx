import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type ReportRow = {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reporter: {
    username: string | null;
    display_name: string | null;
    business_name: string | null;
  } | null;
  comment: {
    id: string;
    body: string;
    status: string;
    entity_type: string;
    entity_id: string;
    created_at: string;
    user_id: string;
    author: {
      username: string | null;
      display_name: string | null;
      business_name: string | null;
    } | null;
  } | null;
};

type BanRow = {
  id: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
  user: {
    username: string | null;
    display_name: string | null;
    business_name: string | null;
  } | null;
  moderator: {
    username: string | null;
    display_name: string | null;
    business_name: string | null;
  } | null;
};

async function requireModerator() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const [{ data: profile }, { data: adminProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role: string | null }>(),

    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
  ]);

  const canModerate =
    Boolean(adminProfile) ||
    profile?.role === "admin" ||
    profile?.role === "moderator";

  if (!canModerate) redirect("/admin/isopedia");

  return { supabase, user };
}

async function resolveReport(formData: FormData) {
  "use server";

  const { supabase, user } = await requireModerator();

  const reportId = String(formData.get("report_id") || "");

  if (!reportId) throw new Error("Missing report id.");

  const { error } = await supabase
    .from("isopedia_discussion_reports")
    .update({
      status: "resolved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", reportId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/isopedia/discussions");
  revalidatePath("/admin/isopedia");
}

async function ignoreReport(formData: FormData) {
  "use server";

  const { supabase, user } = await requireModerator();

  const reportId = String(formData.get("report_id") || "");

  if (!reportId) throw new Error("Missing report id.");

  const { error } = await supabase
    .from("isopedia_discussion_reports")
    .update({
      status: "ignored",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", reportId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/isopedia/discussions");
  revalidatePath("/admin/isopedia");
}

async function deleteReportedComment(formData: FormData) {
  "use server";

  const { supabase, user } = await requireModerator();

  const reportId = String(formData.get("report_id") || "");
  const commentId = String(formData.get("comment_id") || "");

  if (!reportId || !commentId) throw new Error("Missing moderation target.");

  const { error: deleteError } = await supabase.rpc(
    "soft_delete_isopedia_discussion",
    {
      target_comment_id: commentId,
      delete_reason: "Removed after user report",
    }
  );

  if (deleteError) throw new Error(deleteError.message);

  const { error: reportError } = await supabase
    .from("isopedia_discussion_reports")
    .update({
      status: "resolved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", reportId);

  if (reportError) throw new Error(reportError.message);

  revalidatePath("/admin/isopedia/discussions");
  revalidatePath("/admin/isopedia");
}

async function banDiscussionUser(formData: FormData) {
  "use server";

  const { supabase, user } = await requireModerator();

  const targetUserId = String(formData.get("user_id") || "");
  const duration = String(formData.get("duration") || "7");
  const reason = String(formData.get("reason") || "").trim() || null;
  const reportId = String(formData.get("report_id") || "");

  if (!targetUserId) throw new Error("Missing user id.");

  if (targetUserId === user.id) {
    throw new Error("You cannot ban yourself from discussions.");
  }

  let expiresAt: string | null = null;

  if (duration !== "permanent") {
    const days = Number(duration);

    if (!Number.isFinite(days) || days <= 0) {
      throw new Error("Invalid ban duration.");
    }

    const date = new Date();
    date.setDate(date.getDate() + days);
    expiresAt = date.toISOString();
  }

  const { error: insertError } = await supabase
    .from("isopedia_discussion_bans")
    .insert({
      user_id: targetUserId,
      banned_by: user.id,
      reason,
      expires_at: expiresAt,
      is_active: true,
    });

  if (insertError) throw new Error(insertError.message);

  if (reportId) {
    const { error: reportError } = await supabase
      .from("isopedia_discussion_reports")
      .update({
        status: "resolved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq("id", reportId);

    if (reportError) throw new Error(reportError.message);
  }

  revalidatePath("/admin/isopedia/discussions");
  revalidatePath("/admin/isopedia");
}

async function liftDiscussionBan(formData: FormData) {
  "use server";

  const { supabase, user } = await requireModerator();

  const banId = String(formData.get("ban_id") || "");

  if (!banId) throw new Error("Missing ban id.");

  const { error } = await supabase
    .from("isopedia_discussion_bans")
    .update({
      is_active: false,
      lifted_at: new Date().toISOString(),
      lifted_by: user.id,
    })
    .eq("id", banId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/isopedia/discussions");
  revalidatePath("/admin/isopedia");
}

function displayName(
  profile:
    | {
        username: string | null;
        display_name: string | null;
        business_name: string | null;
      }
    | null
) {
  return (
    profile?.display_name ||
    profile?.business_name ||
    profile?.username ||
    "Unknown user"
  );
}

export default async function DiscussionModerationPage() {
  const { supabase } = await requireModerator();

  const [{ data: reports, error }, { data: activeBans, error: bansError }] =
    await Promise.all([
      supabase
        .from("isopedia_discussion_reports")
        .select(
          `
          id,
          reason,
          details,
          status,
          created_at,
          reporter:reporter_user_id (
            username,
            display_name,
            business_name
          ),
          comment:comment_id (
            id,
            body,
            status,
            entity_type,
            entity_id,
            created_at,
            user_id,
            author:user_id (
              username,
              display_name,
              business_name
            )
          )
        `
        )
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .returns<ReportRow[]>(),

      supabase
        .from("isopedia_discussion_bans")
        .select(
          `
          id,
          reason,
          expires_at,
          created_at,
          user:user_id (
            username,
            display_name,
            business_name
          ),
          moderator:banned_by (
            username,
            display_name,
            business_name
          )
        `
        )
        .eq("is_active", true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false })
        .returns<BanRow[]>(),
    ]);

  if (error) throw new Error(error.message);
  if (bansError) throw new Error(bansError.message);

  return (
    <main className="min-h-screen bg-[#0c1710] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
                Isopedia Admin
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
                Discussion Moderation
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/65">
                Review reported discussion comments, remove inappropriate
                content, ban repeat offenders from discussions, or dismiss
                reports that do not require action.
              </p>
            </div>

            <Link
              href="/admin/isopedia"
              className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-3 text-sm font-bold text-emerald-200 transition hover:bg-[#18291d]"
            >
              ← Admin Dashboard
            </Link>
          </div>
        </div>

        <section className="mb-8 rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-xl shadow-black/20">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
                Active Discussion Bans
              </p>

              <h2 className="mt-2 text-2xl font-black text-white">
                Banned Users
              </h2>
            </div>

            <span className="rounded-full border border-white/10 bg-[#0b140d] px-3 py-1 text-xs font-black text-emerald-100/70">
              {activeBans?.length || 0} active
            </span>
          </div>

          {activeBans && activeBans.length > 0 ? (
            <div className="grid gap-3">
              {activeBans.map((ban) => (
                <div
                  key={ban.id}
                  className="grid gap-4 rounded-2xl border border-white/10 bg-[#0b140d] p-4 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div>
                    <p className="font-black text-white">
                      {displayName(ban.user)}
                    </p>

                    <p className="mt-1 text-sm text-emerald-50/60">
                      Banned by {displayName(ban.moderator)} ·{" "}
                      {ban.expires_at
                        ? `Expires ${new Date(ban.expires_at).toLocaleString()}`
                        : "Permanent"}
                    </p>

                    {ban.reason && (
                      <p className="mt-2 text-sm text-emerald-50/70">
                        Reason: {ban.reason}
                      </p>
                    )}
                  </div>

                  <form action={liftDiscussionBan}>
                    <input type="hidden" name="ban_id" value={ban.id} />

                    <button
                      type="submit"
                      className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-200 transition hover:bg-emerald-400/20"
                    >
                      Lift Ban
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#0b140d] p-5 text-sm text-emerald-50/60">
              No active discussion bans.
            </div>
          )}
        </section>

        <section className="grid gap-4">
          {reports && reports.length > 0 ? (
            reports.map((report) => {
              const comment = report.comment;

              return (
                <article
                  key={report.id}
                  className="rounded-3xl border border-white/10 bg-[#142318] p-5 shadow-xl shadow-black/20"
                >
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-red-300">
                        Reported Comment
                      </p>

                      <h2 className="mt-2 text-2xl font-black text-white">
                        {report.reason}
                      </h2>

                      <p className="mt-2 text-sm text-emerald-50/55">
                        Reported by {displayName(report.reporter)} ·{" "}
                        {new Date(report.created_at).toLocaleString()}
                      </p>
                    </div>

                    <span className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs font-black text-red-200">
                      Open
                    </span>
                  </div>

                  {report.details && (
                    <div className="mb-4 rounded-2xl border border-white/10 bg-[#0b140d] p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-emerald-100/40">
                        Reporter Details
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-50/70">
                        {report.details}
                      </p>
                    </div>
                  )}

                  <div className="rounded-2xl border border-white/10 bg-[#0b140d] p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-100/40">
                      Comment
                    </p>

                    {comment ? (
                      <>
                        <p className="mt-2 text-sm text-emerald-50/55">
                          Author: {displayName(comment.author)} · Status:{" "}
                          {comment.status}
                        </p>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-emerald-50/80">
                          {comment.body || "This comment has no visible body."}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-emerald-50/50">
                        Comment no longer exists.
                      </p>
                    )}
                  </div>

                  <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-[#0b140d]/70 p-4">
                    <p className="text-sm font-black text-white">
                      Moderation Actions
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {comment && comment.status === "active" && (
                        <form action={deleteReportedComment}>
                          <input
                            type="hidden"
                            name="report_id"
                            value={report.id}
                          />
                          <input
                            type="hidden"
                            name="comment_id"
                            value={comment.id}
                          />

                          <button
                            type="submit"
                            className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-black text-red-200 transition hover:bg-red-400/20"
                          >
                            Delete Comment
                          </button>
                        </form>
                      )}

                      <form action={resolveReport}>
                        <input
                          type="hidden"
                          name="report_id"
                          value={report.id}
                        />

                        <button
                          type="submit"
                          className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-200 transition hover:bg-emerald-400/20"
                        >
                          Mark Resolved
                        </button>
                      </form>

                      <form action={ignoreReport}>
                        <input
                          type="hidden"
                          name="report_id"
                          value={report.id}
                        />

                        <button
                          type="submit"
                          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
                        >
                          Ignore Report
                        </button>
                      </form>
                    </div>

                    {comment && (
                      <form
                        action={banDiscussionUser}
                        className="mt-2 grid gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-4"
                      >
                        <input
                          type="hidden"
                          name="report_id"
                          value={report.id}
                        />
                        <input
                          type="hidden"
                          name="user_id"
                          value={comment.user_id}
                        />

                        <div className="grid gap-3 md:grid-cols-[160px_1fr_auto]">
                          <label className="grid gap-2">
                            <span className="text-xs font-bold uppercase tracking-widest text-red-100/60">
                              Ban Length
                            </span>

                            <select
                              name="duration"
                              defaultValue="7"
                              className="rounded-xl border border-white/10 bg-[#0b140d] px-3 py-2 text-sm text-white outline-none"
                            >
                              <option value="7">7 Days</option>
                              <option value="30">30 Days</option>
                              <option value="permanent">Permanent</option>
                            </select>
                          </label>

                          <label className="grid gap-2">
                            <span className="text-xs font-bold uppercase tracking-widest text-red-100/60">
                              Ban Reason
                            </span>

                            <input
                              name="reason"
                              defaultValue={`Report: ${report.reason}`}
                              className="rounded-xl border border-white/10 bg-[#0b140d] px-3 py-2 text-sm text-white outline-none"
                            />
                          </label>

                          <div className="flex items-end">
                            <button
                              type="submit"
                              className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-black text-red-200 transition hover:bg-red-400/20"
                            >
                              Ban User
                            </button>
                          </div>
                        </div>
                      </form>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-3xl border border-white/10 bg-[#142318] p-8 text-center shadow-xl shadow-black/20">
              <h2 className="text-2xl font-black text-white">
                No open discussion reports
              </h2>

              <p className="mt-3 text-emerald-50/60">
                Reported discussion comments will appear here.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}