import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type ContactMessage = {
  id: string;
  submitted_by: string | null;
  name: string;
  email: string;
  category: "issue" | "suggestion" | "question" | "other";
  subject: string | null;
  message: string;
  status: "open" | "reviewed" | "archived";
  admin_notes: string | null;
  admin_response: string | null;
  responded_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  submitter: {
    username: string | null;
    display_name: string | null;
    business_name: string | null;
  } | null;
  responder: {
    username: string | null;
    display_name: string | null;
    business_name: string | null;
  } | null;
};

type ProfileRecipient = {
  id: string;
  username: string | null;
  display_name: string | null;
  business_name: string | null;
};

type ProfileMessageReply = {
  id: string;
  subject: string | null;
  body: string;
  user_reply: string | null;
  user_replied_at: string | null;
  created_at: string;
  recipient: ProfileRecipient | null;
  sender: ProfileRecipient | null;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 4000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const [{ data: adminProfile }, { data: roleProfile }] = await Promise.all([
    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle(),
  ]);

  const allowed =
    Boolean(adminProfile) ||
    roleProfile?.role === "admin" ||
    roleProfile?.role === "moderator";

  if (!allowed) redirect("/admin/login");

  return { supabase, user };
}

async function respondToContactMessage(formData: FormData) {
  "use server";

  const { supabase, user } = await requireAdmin();
  const messageId = cleanText(formData.get("message_id"), 80);
  const adminResponse = cleanText(formData.get("admin_response"), 4000);
  const adminNotes = cleanText(formData.get("admin_notes"), 2000) || null;

  if (!messageId) throw new Error("Missing contact message id.");
  if (!adminResponse) throw new Error("Response is required.");

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("isopedia_contact_messages")
    .update({
      admin_response: adminResponse,
      admin_notes: adminNotes,
      responded_by: user.id,
      responded_at: now,
      reviewed_by: user.id,
      reviewed_at: now,
      status: "reviewed",
      updated_at: now,
    })
    .eq("id", messageId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/isopedia/contact");
  revalidatePath("/admin/isopedia");
  redirect("/admin/isopedia/contact?saved=true");
}

async function updateContactMessageStatus(formData: FormData) {
  "use server";

  const { supabase, user } = await requireAdmin();
  const messageId = cleanText(formData.get("message_id"), 80);
  const status = cleanText(formData.get("status"), 40);

  if (!messageId) throw new Error("Missing contact message id.");
  if (!["open", "reviewed", "archived"].includes(status)) {
    throw new Error("Invalid status.");
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("isopedia_contact_messages")
    .update({
      status,
      reviewed_by: status === "open" ? null : user.id,
      reviewed_at: status === "open" ? null : now,
      updated_at: now,
    })
    .eq("id", messageId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/isopedia/contact");
  revalidatePath("/admin/isopedia");
}

async function sendAdminProfileMessage(formData: FormData) {
  "use server";

  const { supabase, user } = await requireAdmin();
  const audience = cleanText(formData.get("audience"), 40);
  const recipientId = cleanText(formData.get("recipient_id"), 80);
  const subject = cleanText(formData.get("subject"), 200) || null;
  const body = cleanText(formData.get("body"), 4000);

  if (!["individual", "all"].includes(audience)) {
    throw new Error("Invalid message audience.");
  }

  if (audience === "individual" && !recipientId) {
    throw new Error("Choose a recipient.");
  }

  if (!body) {
    throw new Error("Message body is required.");
  }

  let recipientIds: string[] = [];

  if (audience === "all") {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id")
      .returns<Array<{ id: string }>>();

    if (error) throw new Error(error.message);
    recipientIds = (profiles || []).map((profile) => profile.id);
  } else {
    recipientIds = [recipientId];
  }

  if (!recipientIds.length) {
    throw new Error("No matching recipients found.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("isopedia_profile_messages").insert(
    recipientIds.map((id) => ({
      recipient_id: id,
      sent_by: user.id,
      audience,
      subject,
      body,
      created_at: now,
      updated_at: now,
    }))
  );

  if (error) throw new Error(error.message);

  revalidatePath("/admin/isopedia/contact");
  revalidatePath("/admin/isopedia");
  redirect("/admin/isopedia/contact?sent=true");
}

export default async function AdminIsopediaContactPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; sent?: string; status?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const statusFilter = ["open", "reviewed", "archived"].includes(params.status || "")
    ? params.status
    : "open";

  const { data: messages, error } = await supabase
    .from("isopedia_contact_messages")
    .select(
      `
      id,
      submitted_by,
      name,
      email,
      category,
      subject,
      message,
      status,
      admin_notes,
      admin_response,
      responded_at,
      reviewed_at,
      created_at,
      submitter:submitted_by (
        username,
        display_name,
        business_name
      ),
      responder:responded_by (
        username,
        display_name,
        business_name
      )
    `
    )
    .eq("status", statusFilter)
    .order("created_at", { ascending: false })
    .returns<ContactMessage[]>();

  if (error) throw new Error(error.message);

  const { data: recipients } = await supabase
    .from("profiles")
    .select("id, username, display_name, business_name")
    .order("username", { ascending: true })
    .range(0, 4999)
    .returns<ProfileRecipient[]>();

  const { data: profileMessageReplies } = await supabase
    .from("isopedia_profile_messages")
    .select(
      `
      id,
      subject,
      body,
      user_reply,
      user_replied_at,
      created_at,
      recipient:recipient_id (
        id,
        username,
        display_name,
        business_name
      ),
      sender:sent_by (
        id,
        username,
        display_name,
        business_name
      )
    `
    )
    .not("user_reply", "is", null)
    .order("user_replied_at", { ascending: false })
    .limit(25)
    .returns<ProfileMessageReply[]>();

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
              Isopedia Tools
            </p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">
              Contact Messages
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Review Contact Us submissions and write responses that logged-in
              users can see privately on their own profile page.
            </p>
          </div>

          <Link
            href="/admin/isopedia"
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
          >
            Back to Isopedia
          </Link>
        </header>

        {params.saved === "true" && (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">
            Response saved.
          </div>
        )}

        {params.sent === "true" && (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">
            Admin message sent.
          </div>
        )}

        <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">
            Send Message
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Message users
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Send a private message to one account or an announcement to all
            Isopedia accounts. Users will see unread messages on their profile
            and in the top navigation.
          </p>

          <form action={sendAdminProfileMessage} className="mt-5 grid gap-4">
            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-200">
                  Audience
                </span>
                <select
                  name="audience"
                  defaultValue="individual"
                  className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white outline-none ring-emerald-400/30 focus:ring-4"
                >
                  <option value="individual">Individual</option>
                  <option value="all">All accounts</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-200">
                  Individual Recipient
                </span>
                <select
                  name="recipient_id"
                  className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white outline-none ring-emerald-400/30 focus:ring-4"
                >
                  <option value="">Choose a user for individual messages</option>
                  {(recipients || []).map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {recipientName(profile)}
                      {profile.username ? ` (@${profile.username})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-200">Subject</span>
              <input
                name="subject"
                maxLength={200}
                className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white outline-none ring-emerald-400/30 focus:ring-4"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-200">
                Message
              </span>
              <textarea
                name="body"
                rows={5}
                required
                className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white outline-none ring-emerald-400/30 focus:ring-4"
              />
            </label>

            <button
              type="submit"
              className="w-fit rounded-md bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-300"
            >
              Send Message
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">
            Admin Message Replies
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            User replies
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Replies sent from private admin messages on user profile pages.
          </p>

          <div className="mt-5 grid gap-4">
            {(profileMessageReplies || []).length > 0 ? (
              profileMessageReplies?.map((message) => (
                <article
                  key={message.id}
                  className="rounded-lg border border-lime-300/20 bg-lime-300/[0.04] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-white">
                        {message.subject || "Isopedia message"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Reply from {recipientName(message.recipient || {})}
                        {message.recipient?.username
                          ? ` (@${message.recipient.username})`
                          : ""}{" "}
                        on {formatDate(message.user_replied_at)}
                      </p>
                    </div>
                    {message.recipient?.username && (
                      <Link
                        href={`/profile/${message.recipient.username}`}
                        className="rounded-md border border-white/10 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-white/10"
                      >
                        View Profile
                      </Link>
                    )}
                  </div>

                  <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      Original Admin Message
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                      {message.body}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Sent {formatDate(message.created_at)}
                      {message.sender?.username
                        ? ` by @${message.sender.username}`
                        : ""}
                    </p>
                  </div>

                  <div className="mt-3 rounded-md border border-lime-300/20 bg-lime-300/10 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-200">
                      User Reply
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-lime-50/90">
                      {message.user_reply}
                    </p>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-md border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                No admin message replies yet.
              </p>
            )}
          </div>
        </section>

        <nav className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-2">
          {(["open", "reviewed", "archived"] as const).map((status) => (
            <Link
              key={status}
              href={`/admin/isopedia/contact?status=${status}`}
              className={`rounded-md px-3 py-2 text-sm font-black capitalize ${
                statusFilter === status
                  ? "bg-emerald-400 text-slate-950"
                  : "bg-black/20 text-slate-200 hover:bg-white/10"
              }`}
            >
              {status}
            </Link>
          ))}
        </nav>

        <section className="grid gap-5">
          {(messages || []).length > 0 ? (
            messages?.map((message) => (
              <article
                key={message.id}
                className="rounded-lg border border-white/10 bg-white/[0.05] p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">
                      {message.category}
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      {message.subject || "No subject"}
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                      From {message.name} &lt;{message.email}&gt; on{" "}
                      {formatDate(message.created_at)}
                    </p>
                    {message.submitter?.username && (
                      <Link
                        href={`/profile/${message.submitter.username}`}
                        className="mt-2 inline-block text-sm font-bold text-emerald-300 hover:text-emerald-200"
                      >
                        View @{message.submitter.username}
                      </Link>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {message.status !== "open" && (
                      <form action={updateContactMessageStatus}>
                        <input type="hidden" name="message_id" value={message.id} />
                        <input type="hidden" name="status" value="open" />
                        <button className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10">
                          Reopen
                        </button>
                      </form>
                    )}
                    {message.status !== "archived" && (
                      <form action={updateContactMessageStatus}>
                        <input type="hidden" name="message_id" value={message.id} />
                        <input type="hidden" name="status" value="archived" />
                        <button className="rounded-md border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm font-bold text-red-100 hover:bg-red-400/10">
                          Archive
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                <div className="mt-5 rounded-md border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                    Message
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                    {message.message}
                  </p>
                </div>

                {message.admin_response && (
                  <div className="mt-4 rounded-md border border-emerald-400/20 bg-emerald-400/5 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                      Current Response
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-50/80">
                      {message.admin_response}
                    </p>
                    <p className="mt-3 text-xs text-emerald-50/45">
                      Responded {formatDate(message.responded_at)}
                      {message.responder?.username
                        ? ` by @${message.responder.username}`
                        : ""}
                    </p>
                  </div>
                )}

                <form action={respondToContactMessage} className="mt-5 grid gap-4">
                  <input type="hidden" name="message_id" value={message.id} />

                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-slate-200">
                      Admin Response
                    </span>
                    <textarea
                      name="admin_response"
                      rows={5}
                      defaultValue={message.admin_response || ""}
                      required
                      className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white outline-none ring-emerald-400/30 focus:ring-4"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-slate-200">
                      Internal Notes
                    </span>
                    <textarea
                      name="admin_notes"
                      rows={3}
                      defaultValue={message.admin_notes || ""}
                      className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white outline-none ring-emerald-400/30 focus:ring-4"
                    />
                  </label>

                  <button
                    type="submit"
                    className="w-fit rounded-md bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-300"
                  >
                    Save Response
                  </button>
                </form>
              </article>
            ))
          ) : (
            <div className="rounded-lg border border-white/10 bg-white/[0.05] p-8 text-center text-slate-400">
              No {statusFilter} contact messages.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function recipientName(profile: Partial<ProfileRecipient>) {
  return (
    profile.display_name ||
    profile.business_name ||
    profile.username ||
    "Unnamed user"
  );
}
