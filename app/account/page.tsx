import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import IsopediaNotificationSettings from "@/app/components/isopedia/IsopediaAppSettings";
import ProfileBannerUpload from "@/app/components/isopedia/ProfileBannerUpload";
import ProfileLogoUpload from "@/app/components/isopedia/ProfileLogoUpload";
import { getProfileFeatureAccess } from "@/lib/isopedia-feature-flags";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  business_name: string | null;
  bio: string | null;
  profile_banner_url: string | null;
  profile_logo_url: string | null;
  role?: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
};

type NotificationPreferences = {
  push_enabled: boolean;
  notify_guides: boolean;
  notify_discussions: boolean;
  notify_marketplace: boolean;
  notify_expos: boolean;
  notify_verified_species: boolean;
  notify_messages: boolean;
};

type PendingSubmission = {
  id: string;
  organism_type: string | null;
  genus: string | null;
  species: string | null;
  morph: string | null;
  trade_names: string | null;
  common_name: string;
  scientific_name: string | null;
  difficulty: string | null;
  origin: string | null;
  temperature: string | null;
  humidity: string | null;
  diet: string | null;
  substrate: string | null;
  notes: string | null;
  source_info: string | null;
  image_url: string | null;
  created_at: string | null;
};

const difficultyOptions = ["Beginner", "Intermediate", "Expert"];

const defaultNotificationPreferences: NotificationPreferences = {
  push_enabled: false,
  notify_guides: true,
  notify_discussions: true,
  notify_marketplace: true,
  notify_expos: true,
  notify_verified_species: true,
  notify_messages: true,
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
  const featureAccess = await getProfileFeatureAccess(supabase, user.id, [
    "profile_banner_images",
  ]);
  const canUseProfileBanner = featureAccess.profile_banner_images === true;

  const display_name = cleanText(formData.get("display_name"));
  const username = existingProfile.data?.username || slugifyUsername(display_name);
  const bio = cleanText(formData.get("bio"));
  const profile_banner_url = cleanText(formData.get("profile_banner_url"));
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
    ...(canUseProfileBanner ? { profile_banner_url: profile_banner_url || null } : {}),
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
      error.message.includes("profile_banner_url") ||
      error.message.includes("instagram_url"))
  ) {
    const fallbackProfileUpdate: Record<string, unknown> = { ...profileUpdate };
    delete fallbackProfileUpdate.profile_banner_url;
    delete fallbackProfileUpdate.profile_logo_url;
    delete fallbackProfileUpdate.instagram_url;

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
      notify_marketplace: formData.get("notify_marketplace") === "on",
      notify_expos: formData.get("notify_expos") === "on",
      notify_verified_species: formData.get("notify_verified_species") === "on",
      notify_messages: formData.get("notify_messages") === "on",
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

async function updatePendingSubmission(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account?tab=submissions");
  }

  const submissionId = cleanText(formData.get("submission_id"));
  const commonName = cleanText(formData.get("common_name"));
  const difficulty = cleanText(formData.get("difficulty"));

  if (!submissionId || !commonName) {
    redirect("/account?tab=submissions&error=submission-required");
  }

  if (difficulty && !difficultyOptions.includes(difficulty)) {
    redirect("/account?tab=submissions&error=submission-save-failed");
  }

  const { error, count } = await supabase
    .from("isopedia_submissions")
    .update(
      {
        organism_type: cleanText(formData.get("organism_type")) || null,
        genus: cleanText(formData.get("genus")) || null,
        species: cleanText(formData.get("species")) || null,
        morph: cleanText(formData.get("morph")) || null,
        trade_names: cleanText(formData.get("trade_names")) || null,
        common_name: commonName,
        scientific_name: cleanText(formData.get("scientific_name")) || null,
        difficulty: difficulty || null,
        origin: cleanText(formData.get("origin")) || null,
        temperature: cleanText(formData.get("temperature")) || null,
        humidity: cleanText(formData.get("humidity")) || null,
        diet: cleanText(formData.get("diet")) || null,
        substrate: cleanText(formData.get("substrate")) || null,
        notes: cleanText(formData.get("notes")) || null,
        source_info: cleanText(formData.get("source_info")).slice(0, 4000) || null,
        image_url: cleanText(formData.get("image_url")) || null,
      },
      { count: "exact" }
    )
    .eq("id", submissionId)
    .eq("submitted_by", user.id)
    .eq("status", "unverified");

  if (error || count !== 1) {
    redirect("/account?tab=submissions&error=submission-save-failed");
  }

  revalidatePath("/account");
  revalidatePath("/review");
  revalidatePath("/verify");
  redirect("/account?tab=submissions&saved=submission");
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; welcome?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const activeTab =
    params.tab === "settings"
      ? "settings"
      : params.tab === "submissions"
        ? "submissions"
        : "profile";
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
      "id, username, display_name, business_name, bio, profile_banner_url, profile_logo_url, role, website_url, facebook_url, instagram_url"
    )
    .eq("id", user.id)
    .maybeSingle<Profile>();

  let profile = profileQuery.data;

  if (
    profileQuery.error &&
    (profileQuery.error.message.includes("profile_logo_url") ||
      profileQuery.error.message.includes("profile_banner_url") ||
      profileQuery.error.message.includes("instagram_url"))
  ) {
    const fallbackQuery = await supabase
      .from("profiles")
      .select("id, username, display_name, business_name, bio, role, website_url, facebook_url")
      .eq("id", user.id)
      .maybeSingle<Omit<Profile, "profile_banner_url" | "profile_logo_url" | "instagram_url">>();

    profile = fallbackQuery.data
      ? { ...fallbackQuery.data, profile_banner_url: null, profile_logo_url: null, instagram_url: null }
      : null;
  }

  const username = profile?.username;
  const featureAccess = await getProfileFeatureAccess(supabase, user.id, [
    "profile_banner_images",
  ]);
  const canUseProfileBanner = featureAccess.profile_banner_images === true;
  const notificationQuery = await supabase
    .from("isopedia_notification_preferences")
    .select("push_enabled, notify_guides, notify_discussions, notify_marketplace, notify_expos, notify_verified_species, notify_messages")
    .eq("profile_id", user.id)
    .maybeSingle<NotificationPreferences>();
  const notificationPreferences = notificationQuery.data || defaultNotificationPreferences;
  const notificationPreferencesReady = !notificationQuery.error;
  const pendingSubmissionsQuery = await supabase
    .from("isopedia_submissions")
    .select(
      `
      id,
      organism_type,
      genus,
      species,
      morph,
      trade_names,
      common_name,
      scientific_name,
      difficulty,
      origin,
      temperature,
      humidity,
      diet,
      substrate,
      notes,
      source_info,
      image_url,
      created_at
    `
    )
    .eq("submitted_by", user.id)
    .eq("status", "unverified")
    .order("created_at", { ascending: false })
    .returns<PendingSubmission[]>();
  const pendingSubmissions = pendingSubmissionsQuery.data || [];

  return (
    <main className="isopedia-theme-root min-h-screen bg-slate-950 px-3 py-4 text-slate-100 sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <IsopediaNav active={activeTab === "settings" ? "settings" : "profile"} />

        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex flex-wrap justify-end gap-2">
          <Link
            href="/"
            className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
          >
            ← Back to Isopedia
          </Link>

          {username && (
            <Link
              href={`/collection/${username}`}
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
            >
              View Collection
            </Link>
          )}
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

        {params.saved === "submission" && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
            Pending submission updated.
          </div>
        )}

        {params.welcome === "true" && !profile?.username && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
            Finish your profile first by choosing your public username. After that, you will be prompted to review the legal and age requirements.
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

        {params.error === "submission-required" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Common name is required before saving a pending submission.
          </div>
        )}

        {params.error === "submission-save-failed" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Pending submission could not be saved. It may have already been verified.
          </div>
        )}

        {params.error === "birth-date-required" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Please enter a valid birth date.
          </div>
        )}

        {params.error === "birth-date-save-failed" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Birth date could not be saved. Please try again.
          </div>
        )}

        <nav className="mb-5 flex gap-2 rounded-2xl border border-white/10 bg-slate-900 p-2">
          <AccountTab href="/account" active={activeTab === "profile"} label="Profile" />
          <AccountTab
            href="/account?tab=submissions"
            active={activeTab === "submissions"}
            label="My Pending Submissions"
          />
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

              {canUseProfileBanner && (
                <ProfileBannerUpload initialUrl={profile?.profile_banner_url || null} />
              )}

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
                className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
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
        ) : activeTab === "submissions" ? (
          <PendingSubmissionsPanel
            submissions={pendingSubmissions}
            saveAction={updatePendingSubmission}
          />
        ) : (
          <IsopediaNotificationSettings
            preferences={notificationPreferences}
            vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""}
            preferencesReady={notificationPreferencesReady}
            savePreferencesAction={saveNotificationPreferences}
          />
        )}
      </div>
      </div>
    </main>
  );
}

function PendingSubmissionsPanel({
  submissions,
  saveAction,
}: {
  submissions: PendingSubmission[];
  saveAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-xl shadow-black/20">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
          My Pending Submissions
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white">
          Waiting for community verification
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          These entries are not public yet. You can fix typos or update details
          until another user verifies the submission.
        </p>
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-slate-900 p-8 text-center text-slate-300">
          <h3 className="text-xl font-bold text-white">
            No pending submissions
          </h3>
          <p className="mt-2">
            Any new species submissions waiting on verification will show here.
          </p>
          <Link
            href="/submit"
            className="mt-5 inline-flex rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-emerald-300"
          >
            Submit New Species
          </Link>
        </div>
      ) : (
        submissions.map((submission) => (
          <PendingSubmissionForm
            key={submission.id}
            submission={submission}
            saveAction={saveAction}
          />
        ))
      )}
    </section>
  );
}

function PendingSubmissionForm({
  submission,
  saveAction,
}: {
  submission: PendingSubmission;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={saveAction}
      className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-xl shadow-black/20"
    >
      <input type="hidden" name="submission_id" value={submission.id} />

      <div className="grid gap-5 border-b border-white/10 p-5 md:grid-cols-[180px_1fr]">
        <div>
          {submission.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={submission.image_url}
              alt={submission.common_name}
              className="h-44 w-full rounded-2xl object-cover"
            />
          ) : (
            <div className="grid h-44 place-items-center rounded-2xl border border-dashed border-white/15 bg-slate-950 px-4 text-center text-sm text-slate-500">
              No image submitted
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-300">
            Pending Verification
          </p>
          <h3 className="mt-2 text-2xl font-bold text-white">
            {submission.common_name}
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            Submitted {formatDate(submission.created_at)}
          </p>
        </div>
      </div>

      <div className="grid gap-5 p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <SubmissionInput
            label="Common Name"
            name="common_name"
            defaultValue={submission.common_name}
            required
          />
          <SubmissionInput
            label="Scientific Name"
            name="scientific_name"
            defaultValue={submission.scientific_name}
          />
          <SubmissionInput
            label="Organism Type"
            name="organism_type"
            defaultValue={submission.organism_type}
          />
          <SubmissionInput
            label="Trade Names"
            name="trade_names"
            defaultValue={submission.trade_names}
          />
          <SubmissionInput
            label="Genus"
            name="genus"
            defaultValue={submission.genus}
          />
          <SubmissionInput
            label="Species"
            name="species"
            defaultValue={submission.species}
          />
          <SubmissionInput
            label="Morph"
            name="morph"
            defaultValue={submission.morph}
          />
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-200">
              Difficulty
            </span>
            <select
              name="difficulty"
              defaultValue={submission.difficulty || ""}
              className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
            >
              <option value="">Not listed</option>
              {difficultyOptions.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {difficulty}
                </option>
              ))}
            </select>
          </label>
          <SubmissionInput
            label="Origin"
            name="origin"
            defaultValue={submission.origin}
          />
          <SubmissionInput
            label="Temperature"
            name="temperature"
            defaultValue={submission.temperature}
          />
          <SubmissionInput
            label="Humidity"
            name="humidity"
            defaultValue={submission.humidity}
          />
          <SubmissionInput
            label="Diet"
            name="diet"
            defaultValue={submission.diet}
          />
          <SubmissionInput
            label="Substrate"
            name="substrate"
            defaultValue={submission.substrate}
          />
          <SubmissionInput
            label="Image URL"
            name="image_url"
            defaultValue={submission.image_url}
          />
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">
            Care Notes
          </span>
          <textarea
            name="notes"
            defaultValue={submission.notes || ""}
            rows={6}
            className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">
            Footnotes / Sources
          </span>
          <textarea
            name="source_info"
            defaultValue={submission.source_info || ""}
            rows={4}
            maxLength={4000}
            placeholder="Source links, citations, keeper observations, or reference notes."
            className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 placeholder:text-slate-500 focus:ring-4"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <p className="text-sm text-slate-400">
            Saving is disabled automatically once this submission is verified.
          </p>
          <button
            type="submit"
            className="rounded-xl bg-emerald-400 px-6 py-3 font-bold text-slate-950 transition hover:bg-emerald-300"
          >
            Save Pending Submission
          </button>
        </div>
      </div>
    </form>
  );
}

function SubmissionInput({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-200">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        name={name}
        defaultValue={defaultValue || ""}
        required={required}
        className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
      />
    </label>
  );
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
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
