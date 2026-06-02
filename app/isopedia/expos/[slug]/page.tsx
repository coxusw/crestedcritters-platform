import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { absoluteIsopediaUrl } from "@/lib/isopedia-site";
import { attachDiscussionLikes } from "@/lib/isopedia-discussion-likes";
import { truncateMetaDescription } from "@/lib/seo";
import DiscussionStructuredData from "@/app/components/isopedia/DiscussionStructuredData";
import DiscussionSection from "@/app/components/isopedia/DiscussionSection";
import {
  removeExpoRsvp,
  setExpoRsvp,
} from "@/app/isopedia/expos/[slug]/actions";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type Expo = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  venue: string | null;
  starts_at: string;
  ends_at: string | null;
  description: string | null;
  status: "pending" | "approved" | "rejected";
};

type Rsvp = {
  id: string;
  status: "attending" | "vending";
  user_id: string;
  profiles: {
    username: string | null;
    display_name: string | null;
    business_name: string | null;
  } | null;
};

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

type DiscussionBan = {
  reason: string | null;
  expires_at: string | null;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

function profileHref(
  profile:
    | {
        username: string | null;
        display_name: string | null;
        business_name: string | null;
      }
    | null
) {
  return profile?.username ? `/profile/${profile.username}` : null;
}

function expoDescription(expo: Pick<Expo, "name" | "city" | "state" | "venue" | "description">) {
  return (
    expo.description ||
    `${expo.name} in ${expo.city}, ${expo.state}${
      expo.venue ? ` at ${expo.venue}` : ""
    }.`
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: expo } = await supabase
    .from("isopedia_expos")
    .select("id, name, slug, city, state, venue, starts_at, ends_at, description, status")
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle<Expo>();

  if (!expo) {
    return {
      title: "Expo Not Found",
      robots: { index: false, follow: false },
    };
  }

  const canonical = absoluteIsopediaUrl(`/expos/${expo.slug}`);
  const title = expo.name;
  const description = truncateMetaDescription(expoDescription(expo), `${expo.name} expo listing on Isopedia.`);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Isopedia",
      type: "website",
      images: [
        {
          url: absoluteIsopediaUrl("/isopedia-social-preview.jpg"),
          width: 1200,
          height: 630,
          alt: `${expo.name} expo listing`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteIsopediaUrl("/isopedia-social-preview.jpg")],
    },
  };
}

export default async function ExpoDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let canModerate = false;
  let activeDiscussionBan: DiscussionBan | null = null;

  if (user) {
    const [{ data: profile }, { data: adminProfile }, { data: ban }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle<{ role: string | null }>(),

        supabase
          .from("admin_profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("isopedia_discussion_bans")
          .select("reason, expires_at")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
          .maybeSingle<DiscussionBan>(),
      ]);

    canModerate =
      Boolean(adminProfile) ||
      profile?.role === "admin" ||
      profile?.role === "moderator";

    activeDiscussionBan = ban || null;
  }

  let expoQuery = supabase
    .from("isopedia_expos")
    .select(
      `
      id,
      name,
      slug,
      city,
      state,
      venue,
      starts_at,
      ends_at,
      description,
      status
    `
    )
    .eq("slug", slug);

  if (!canModerate) {
    expoQuery = expoQuery.eq("status", "approved");
  }

  const { data: expo, error } = await expoQuery.maybeSingle<Expo>();

  if (error || !expo) {
    notFound();
  }

  const [{ data: rsvps }, { data: discussionComments }] = await Promise.all([
    supabase
      .from("isopedia_expo_rsvps")
      .select(
        `
        id,
        status,
        user_id,
        profiles:user_id (
          username,
          display_name,
          business_name
        )
      `
      )
      .eq("expo_id", expo.id)
      .order("created_at", { ascending: true })
      .returns<Rsvp[]>(),

    supabase
      .from("isopedia_discussions")
      .select(
        `
        id,
        parent_id,
        user_id,
        body,
        status,
        created_at,
        edited_at,
        deleted_at,
        profiles:user_id (
          username,
          display_name,
          business_name
        )
      `
      )
      .eq("entity_type", "expo")
      .eq("entity_id", String(expo.id))
      .in("status", ["active", "deleted"])
      .order("created_at", { ascending: false })
      .returns<DiscussionComment[]>(),
  ]);

  const allRsvps = rsvps || [];
  const attending = allRsvps.filter((rsvp) => rsvp.status === "attending");
  const vending = allRsvps.filter((rsvp) => rsvp.status === "vending");
  const discussionCommentsWithLikes = await attachDiscussionLikes(
    supabase,
    discussionComments,
    user?.id || null
  );
  const currentUserRsvp = user
    ? allRsvps.find((rsvp) => rsvp.user_id === user.id)
    : null;
  const pagePath = `/expos/${expo.slug}`;
  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${absoluteIsopediaUrl(pagePath)}#event`,
    name: expo.name,
    description: expoDescription(expo),
    startDate: expo.starts_at,
    endDate: expo.ends_at || undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url: absoluteIsopediaUrl(pagePath),
    location: {
      "@type": "Place",
      name: expo.venue || `${expo.city}, ${expo.state}`,
      address: {
        "@type": "PostalAddress",
        addressLocality: expo.city,
        addressRegion: expo.state,
        addressCountry: "US",
      },
    },
    organizer: {
      "@type": "Organization",
      name: "Isopedia",
      url: absoluteIsopediaUrl("/"),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(eventJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <DiscussionStructuredData
        pagePath={pagePath}
        pageTitle={expo.name}
        comments={discussionCommentsWithLikes.filter(
          (comment) => comment.status === "active"
        )}
      />
      <main className="min-h-screen bg-[#0c1710] px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/expos"
            className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
          >
            ← Back to Expo Calendar
          </Link>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/expos/submit"
              className="rounded-xl border border-white/10 bg-[#142318] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#18291d]"
            >
              Submit Expo
            </Link>

            <Link
              href="/"
              className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Isopedia Home
            </Link>
          </div>
        </div>

        {expo.status !== "approved" && canModerate && (
          <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-bold text-amber-100">
            Moderator preview: this expo is currently {expo.status}.
          </div>
        )}

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#142318] shadow-2xl shadow-black/30">
          <div className="bg-gradient-to-br from-emerald-500/20 via-[#142318] to-[#0c1710] p-6 sm:p-10">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
              Expo Details
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
              {expo.name}
            </h1>

            <p className="mt-4 text-lg font-bold text-emerald-100">
              {expo.city}, {expo.state}
              {expo.venue ? ` · ${expo.venue}` : ""}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <InfoPanel label="Starts" value={formatDateTime(expo.starts_at)} />

              <InfoPanel
                label="Ends"
                value={
                  expo.ends_at ? formatDateTime(expo.ends_at) : "Not listed"
                }
              />
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:p-10 lg:grid-cols-[1fr_340px]">
            <div>
              <h2 className="text-2xl font-bold text-white">Description</h2>

              {expo.description ? (
                <p className="mt-4 whitespace-pre-wrap leading-7 text-emerald-50/75">
                  {expo.description}
                </p>
              ) : (
                <p className="mt-4 text-emerald-50/50">
                  No description was provided for this expo.
                </p>
              )}
            </div>

            <aside className="rounded-3xl border border-white/10 bg-[#0b140d]/70 p-5">
              <h2 className="text-lg font-bold text-white">Expo Status</h2>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <StatPill label="Attending" value={attending.length} />
                <StatPill label="Vending" value={vending.length} />
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-[#142318] p-4">
                <p className="text-sm font-black text-white">
                  Mark your plans
                </p>

                {user ? (
                  <div className="mt-3 grid gap-2">
                    <form action={setExpoRsvp}>
                      <input type="hidden" name="expo_id" value={expo.id} />
                      <input type="hidden" name="expo_slug" value={expo.slug} />
                      <input type="hidden" name="status" value="attending" />

                      <button
                        type="submit"
                        className={`w-full rounded-xl px-4 py-3 text-sm font-black transition ${
                          currentUserRsvp?.status === "attending"
                            ? "bg-emerald-400 text-slate-950"
                            : "border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20"
                        }`}
                      >
                        I’m Attending
                      </button>
                    </form>

                    <form action={setExpoRsvp}>
                      <input type="hidden" name="expo_id" value={expo.id} />
                      <input type="hidden" name="expo_slug" value={expo.slug} />
                      <input type="hidden" name="status" value="vending" />

                      <button
                        type="submit"
                        className={`w-full rounded-xl px-4 py-3 text-sm font-black transition ${
                          currentUserRsvp?.status === "vending"
                            ? "bg-amber-300 text-slate-950"
                            : "border border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
                        }`}
                      >
                        I’m Vending
                      </button>
                    </form>

                    {currentUserRsvp && (
                      <form action={removeExpoRsvp}>
                        <input type="hidden" name="expo_id" value={expo.id} />
                        <input
                          type="hidden"
                          name="expo_slug"
                          value={expo.slug}
                        />

                        <button
                          type="submit"
                          className="w-full rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-black text-red-200 transition hover:bg-red-400/20"
                        >
                          Remove My Status
                        </button>
                      </form>
                    )}
                  </div>
                ) : (
                  <Link
                    href={`/login?next=/expos/${expo.slug}`}
                    className="mt-3 block rounded-xl bg-emerald-400 px-4 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-emerald-300"
                  >
                    Log In to Mark Status
                  </Link>
                )}
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <UserListCard
            title="Attending"
            users={attending}
            empty="No attendees yet."
          />

          <UserListCard
            title="Vending"
            users={vending}
            empty="No vendors marked yet."
          />
        </section>

        <DiscussionSection
          entityType="expo"
          entityId={String(expo.id)}
          entityPath={pagePath}
          comments={discussionCommentsWithLikes}
          isLoggedIn={Boolean(user)}
          currentUserId={user?.id || null}
          canModerate={canModerate}
          activeDiscussionBan={activeDiscussionBan}
        />
      </div>
      </main>
    </>
  );
}

function InfoPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-widest text-emerald-100/45">
        {label}
      </p>

      <p className="mt-2 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b140d] p-4 text-center">
      <p className="text-xs font-black uppercase tracking-widest text-emerald-100/40">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function UserListCard({
  title,
  users,
  empty,
}: {
  title: string;
  users: Rsvp[];
  empty: string;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-xl shadow-black/20">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black text-white">{title}</h2>

        <span className="rounded-full border border-white/10 bg-[#0b140d] px-3 py-1 text-xs font-black text-emerald-100/70">
          {users.length}
        </span>
      </div>

      {users.length > 0 ? (
        <div className="grid gap-3">
          {users.map((user) => {
            const href = profileHref(user.profiles);

            const content = (
              <div className="rounded-2xl border border-white/10 bg-[#0b140d] p-4 transition hover:border-emerald-400/40">
                <p className="font-black text-white">
                  {displayName(user.profiles)}
                </p>

                {user.profiles?.username && (
                  <p className="mt-1 text-sm text-emerald-300">
                    Username: {user.profiles.username}
                  </p>
                )}
              </div>
            );

            return href ? (
              <Link key={user.id} href={href}>
                {content}
              </Link>
            ) : (
              <div key={user.id}>{content}</div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-white/10 bg-[#0b140d] p-4 text-sm text-emerald-50/60">
          {empty}
        </p>
      )}
    </section>
  );
}
