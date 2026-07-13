import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/notifications/actions";

type NotificationActor = {
  username: string | null;
  display_name: string | null;
  business_name: string | null;
};

type NotificationRow = {
  id: string;
  actor_id: string | null;
  type: string;
  discussion_id: string | null;
  reply_id: string | null;
  destination_url: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
  actor: NotificationActor | null;
  discussion: { title: string | null; slug: string | null } | null;
};

export const metadata = {
  title: "Notifications | Isopedia",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/notifications");

  let query = supabase
    .from("notifications")
    .select(
      `
      id,
      actor_id,
      type,
      discussion_id,
      reply_id,
      destination_url,
      metadata,
      read_at,
      created_at,
      actor:actor_id (
        username,
        display_name,
        business_name
      ),
      discussion:discussion_id (
        title,
        slug
      )
    `
    )
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(80);

  if (params.view === "unread") {
    query = query.is("read_at", null);
  }

  const { data, error } = await query.returns<NotificationRow[]>();
  if (error) throw new Error(error.message);

  const notifications = data || [];
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <IsopediaNav active="notifications" />

        <header className="rounded-lg border border-white/10 bg-[#102016] p-5 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
            Isopedia
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-black text-white">Notifications</h1>
              <p className="mt-3 text-sm leading-6 text-emerald-50/70">
                Replies, mentions, and community activity tied to your account.
              </p>
            </div>
            {unreadCount > 0 && (
              <form action={markAllNotificationsRead}>
                <button className="rounded-lg border border-emerald-400/30 px-4 py-2 text-sm font-black text-emerald-100 hover:bg-emerald-400/10">
                  Mark all read
                </button>
              </form>
            )}
          </div>
        </header>

        <div className="mt-5 flex flex-wrap gap-2">
          <FilterLink href="/notifications" active={params.view !== "unread"} label="All" />
          <FilterLink
            href="/notifications?view=unread"
            active={params.view === "unread"}
            label="Unread"
          />
        </div>

        <section className="mt-5 grid gap-3">
          {notifications.length ? (
            notifications.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
              <h2 className="text-xl font-black text-white">
                {params.view === "unread"
                  ? "You do not have unread notifications."
                  : "You do not have notifications yet."}
              </h2>
              <Link
                href="/community"
                className="mt-4 inline-flex rounded-lg bg-emerald-400 px-4 py-2 font-black text-slate-950"
              >
                Browse Community
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function NotificationCard({ notification }: { notification: NotificationRow }) {
  const destination = notification.destination_url || discussionHref(notification) || "/community";
  const unread = !notification.read_at;

  return (
    <article
      className={`rounded-lg border p-4 ${
        unread
          ? "border-emerald-300/30 bg-emerald-400/10"
          : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {unread && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                New
              </span>
            )}
            <span className="text-xs font-black uppercase tracking-wide text-emerald-300">
              {notificationLabel(notification.type)}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-black text-white">
            {notificationTitle(notification)}
          </h2>
          <p className="mt-1 text-sm leading-6 text-emerald-50/65">
            {notificationDescription(notification)}
          </p>
          <p className="mt-2 text-xs text-emerald-50/45">
            {formatDate(notification.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <form action={markNotificationRead}>
            <input type="hidden" name="notification_id" value={notification.id} />
            <input type="hidden" name="destination_url" value={destination} />
            <button className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-300">
              Open
            </button>
          </form>
          {unread && (
            <form action={markNotificationRead}>
              <input type="hidden" name="notification_id" value={notification.id} />
              <button className="rounded-lg border border-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/10">
                Mark read
              </button>
            </form>
          )}
        </div>
      </div>
    </article>
  );
}

function FilterLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border px-4 py-2 text-sm font-black ${
        active
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
          : "border-white/10 bg-[#07130c] text-white hover:bg-white/10"
      }`}
    >
      {label}
    </Link>
  );
}

function notificationTitle(notification: NotificationRow) {
  const actorName = profileName(notification.actor);
  if (notification.type === "discussion_reply") {
    return `${actorName} replied to your discussion`;
  }
  if (notification.type === "mention") {
    return `${actorName} mentioned you`;
  }
  if (notification.type === "accepted_answer") return "Your answer was accepted";
  if (notification.type === "moderator_action") return "A moderator updated your post";
  if (notification.type === "badge_awarded") return "You earned a badge";
  return "New notification";
}

function notificationDescription(notification: NotificationRow) {
  const title =
    typeof notification.metadata?.title === "string"
      ? notification.metadata.title
      : notification.discussion?.title;

  if (title) return title;
  if (notification.discussion?.slug) return "Open the related discussion.";
  return "Open this notification for details.";
}

function notificationLabel(type: string) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function discussionHref(notification: NotificationRow) {
  return notification.discussion?.slug
    ? `/community/discussion/${notification.discussion.slug}`
    : null;
}

function profileName(profile: NotificationActor | null) {
  return (
    profile?.display_name ||
    profile?.business_name ||
    (profile?.username ? `@${profile.username}` : "Someone")
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
