import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import IsopediaNotificationSettings from "@/app/components/isopedia/IsopediaAppSettings";
import ProfileLogoUpload from "@/app/components/isopedia/ProfileLogoUpload";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  business_name: string | null;
  bio: string | null;
  profile_logo_url: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
};

type NotificationPreferences = {
  push_enabled: boolean;
  notify_guides: boolean;
  notify_discussions: boolean;
  notify_expos: boolean;
  notify_verified_species: boolean;
};

const defaultNotificationPreferences: NotificationPreferences = {
  push_enabled: false,
  notify_guides: true,
  notify_discussions: true,
  notify_expos: true,
  notify_verified_species: true,
};

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function slugifyUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

async function saveProfile(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const existingProfile = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle<{ username: string | null }>();

  const display_name = cleanText(formData.get("display_name"));
  const username = existingProfile.data?.username || slugifyUsername(display_name);
  const bio = cleanText(formData.get("bio"));
  const profile_logo_url = cleanText(formData.get("profile_logo_url"));
  const website_url = cleanText(formData.get("website_url"));
  const facebook_url = cleanText(formData.get("facebook_url"));
  const instagram_url = cleanText(formData.get("instagram_url"));

  if (!username) {
    redirect("/account?error=username-required");
  }

  const profileUpdate = {
    id: user.id,
    username,
    display_name,
    business_name: null,
    bio,
    profile_logo_url: profile_logo_url || null,
    website_url,
    facebook_url,
    instagram_url,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("profiles").upsert(profileUpdate);

  if (
    error &&
    (error.message.includes("profile_logo_url") ||
      error.message.includes("instagram_url"))
  ) {
    const {
      profile_logo_url: _profileLogoUrl,
      instagram_url: _instagramUrl,
      ...fallbackProfileUpdate
    } = profileUpdate;
    const { error: fallbackError } = await supabase
      .from("profiles")
      .upsert(fallbackProfileUpdate);

    if (!fallbackError) {
      revalidatePath("/account");
      revalidatePath("/");
      revalidatePath(`/profile/${username}`);
      revalidatePath(`/collection/${username}`);

      redirect("/account?error=logo-column-missing");
    }
  }

  if (error) {
    redirect("/account?error=save-failed");
  }

  revalidatePath("/account");
  revalidatePath("/");
  revalidatePath(`/profile/${username}`);
  revalidatePath(`/collection/${username}`);

  redirect(`/profile/${username}`);
}

async function saveNotificationPreferences(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const { error } = await supabase.from("isopedia_notification_preferences").upsert(
    {
      profile_id: user.id,
      notify_guides: formData.get("notify_guides") === "on",
      notify_discussions: formData.get("notify_discussions") === "on",
      notify_expos: formData.get("notify_expos") === "on",
      notify_verified_species: formData.get("notify_verified_species") === "on",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" }
  );

  if (error) {
    redirect("/account?error=notifications-save-failed");
  }

  revalidatePath("/account");
  redirect("/account?tab=settings&saved=notifications");
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; welcome?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const activeTab = params.tab === "settings" ? "settings" : "profile";
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/");
  }

  const profileQuery = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, business_name, bio, profile_logo_url, website_url, facebook_url, instagram_url"
    )
    .eq("id", user.id)
    .maybeSingle<Profile>();

  let profile = profileQuery.data;

  if (
    profileQuery.error &&
    (profileQuery.error.message.includes("profile_logo_url") ||
      profileQuery.error.message.includes("instagram_url"))
  ) {
    const fallbackQuery = await supabase
      .from("profiles")
      .select("id, username, display_name, business_name, bio, website_url, facebook_url")
      .eq("id", user.id)
      .maybeSingle<Omit<Profile, "profile_logo_url" | "instagram_url">>();

    profile = fallbackQuery.data
      ? { ...fallbackQuery.data, profile_logo_url: null, instagram_url: null }
      : null;
  }

  const username = profile?.username;
  const notificationQuery = await supabase
    .from("isopedia_notification_preferences")
    .select("push_enabled, notify_guides, notify_discussions, notify_expos, notify_verified_species")
    .eq("profile_id", user.id)
    .maybeSingle<NotificationPreferences>();
  const notificationPreferences = notificationQuery.data || defaultNotificationPreferences;
  const notificationPreferencesReady = !notificationQuery.error;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
          >
            ← Back to Isopedia
          </Link>

          <div className="flex flex-wrap gap-2">
            {username && (
              <>
                <Link
                  href={`/profile/${username}`}
                  className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
                >
                  View Profile
                </Link>

                <Link
                  href={`/collection/${username}`}
                  className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
                >
                  View Collection
                </Link>
              </>
            )}

            <Link
              href="/logout"
              className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20"
            >
              Logout
            </Link>
          </div>
        </div>

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
            Contributor Account
          </p>

          <h1 className="mt-2 text-4xl font-bold text-white">
            Your Isopedia Profile
          </h1>

          <p className="mt-3 text-slate-300">
            This profile will be attached to your submissions, suggested edits,
            gallery images, collections, and verifications.
          </p>
        </div>

        {params.saved === "true" && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
            Profile saved successfully.
          </div>
        )}

        {params.saved === "notifications" && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
            Notification preferences saved.
          </div>
        )}

        {params.welcome === "true" && !profile?.username && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
            Account created. Finish your profile so your submissions, photos, and reviews show who contributed them.
          </div>
        )}

        {params.error === "username-required" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Username is required.
          </div>
        )}

        {params.error === "save-failed" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Profile could not be saved. The username may already be taken.
          </div>
        )}

        {params.error === "logo-column-missing" && (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
            Profile saved, but the logo column is not live in Supabase yet.
          </div>
        )}

        {params.error === "notifications-save-failed" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Notification preferences could not be saved. The notification tables may still need to be added in Supabase.
          </div>
        )}

        <nav className="mb-5 flex gap-2 rounded-2xl border border-white/10 bg-slate-900 p-2">
          <AccountTab href="/account" active={activeTab === "profile"} label="Profile" />
          <AccountTab href="/account?tab=settings" active={activeTab === "settings"} label="Settings" />
        </nav>

        {activeTab === "profile" ? (
          <form
            action={saveProfile}
            className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-xl shadow-black/20"
          >
            <div className="grid gap-5">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-200">
                  Username *
                </span>

                <input
                  name="display_name"
                  defaultValue={profile?.display_name || profile?.username || ""}
                  placeholder="Your public name"
                  className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                  required
                />

                <span className="text-xs text-slate-500">
                  This is the name shown on your public profile.
                  {profile?.username
                    ? " Your profile URL is locked after account setup."
                    : " Your profile URL will be created from this name."}
                </span>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-200">Bio</span>

                <textarea
                  name="bio"
                  defaultValue={profile?.bio || ""}
                  placeholder="Tell people a little about yourself, your collection, or your business."
                  rows={5}
                  className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                />
              </label>

              <ProfileLogoUpload initialUrl={profile?.profile_logo_url || null} />

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-200">
                  Website Link
                </span>

                <input
                  name="website_url"
                  defaultValue={profile?.website_url || ""}
                  placeholder="https://example.com"
                  className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-200">
                  Facebook Link
                </span>

                <input
                  name="facebook_url"
                  defaultValue={profile?.facebook_url || ""}
                  placeholder="https://facebook.com/yourpage"
                  className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-200">
                  Instagram Link
                </span>

                <input
                  name="instagram_url"
                  defaultValue={profile?.instagram_url || ""}
                  placeholder="https://instagram.com/yourhandle or @yourhandle"
                  className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                />
              </label>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/"
                className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
              >
                Back to Isopedia
              </Link>

              <button
                type="submit"
                className="rounded-xl bg-emerald-400 px-6 py-3 font-bold text-slate-950 transition hover:bg-emerald-300"
              >
                Save Profile
              </button>
            </div>
          </form>
        ) : (
          <IsopediaNotificationSettings
            preferences={notificationPreferences}
            vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""}
            preferencesReady={notificationPreferencesReady}
            savePreferencesAction={saveNotificationPreferences}
          />
        )}
      </div>
    </main>
  );
}

function AccountTab({
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
      className={`flex-1 rounded-xl px-4 py-3 text-center text-sm font-black transition ${
        active
          ? "bg-emerald-400 text-slate-950"
          : "border border-white/10 bg-slate-950 text-slate-200 hover:bg-slate-800"
      }`}
    >
      {label}
    </Link>
  );
}
