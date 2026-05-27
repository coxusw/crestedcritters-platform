import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
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

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
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

  const username = cleanText(formData.get("username"))
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");

  const display_name = cleanText(formData.get("display_name"));
  const business_name = cleanText(formData.get("business_name"));
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
    business_name,
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
      revalidatePath("/isopedia");
      revalidatePath(`/profile/${username}`);
      revalidatePath(`/isopedia/profile/${username}`);
      revalidatePath(`/isopedia/collection/${username}`);

      redirect("/account?error=logo-column-missing");
    }
  }

  if (error) {
    redirect("/account?error=save-failed");
  }

  revalidatePath("/account");
  revalidatePath("/isopedia");
  revalidatePath(`/profile/${username}`);
  revalidatePath(`/isopedia/profile/${username}`);
  revalidatePath(`/isopedia/collection/${username}`);

  redirect(`/profile/${username}`);
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; welcome?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/isopedia");
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

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/isopedia"
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
                  href={`/isopedia/collection/${username}`}
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
                name="username"
                defaultValue={profile?.username || ""}
                placeholder="example: crestedkeeper"
                className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                required
              />

              <span className="text-xs text-slate-500">
                Lowercase letters, numbers, dashes, and underscores only.
              </span>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-200">
                Display Name
              </span>

              <input
                name="display_name"
                defaultValue={profile?.display_name || ""}
                placeholder="Your public name"
                className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-200">
                Business Name
              </span>

              <input
                name="business_name"
                defaultValue={profile?.business_name || ""}
                placeholder="Your business, page, or project name"
                className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
              />
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
              href="/isopedia"
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
      </div>
    </main>
  );
}
