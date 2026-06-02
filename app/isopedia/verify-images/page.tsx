import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import { filterReviewableGalleryImages } from "@/lib/isopedia-gallery-review";
import { awardIsoTokens } from "@/lib/isotokens";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  business_name: string | null;
  role: string | null;
};

type Species = {
  id: number;
  common_name: string;
  slug: string;
  image_url: string | null;
};

type GalleryImage = {
  id: string;
  species_id: number;
  image_url: string;
  caption: string | null;
  credit_user_id: string | null;
  status: string;
  created_at: string | null;
  profiles: Profile | null;
  isopedia_species: Species | null;
};

async function verifyGalleryImage(formData: FormData) {
  "use server";

  const imageId = String(formData.get("image_id") || "");
  const speciesSlug = String(formData.get("species_slug") || "");

  const supabase = await createSupabaseServerClient();

  if (!imageId) {
    redirect("/verify-images?error=missing-image");
  }

  const { data: imageForReward } = await supabase
    .from("isopedia_species_images")
    .select("id, credit_user_id")
    .eq("id", imageId)
    .maybeSingle<{ id: string; credit_user_id: string | null }>();

  const { error } = await supabase.rpc("verify_isopedia_species_image", {
    image_id: imageId,
  });

  if (error) {
    redirect(
      `/verify-images?error=${encodeURIComponent(
        error.message || "verify-failed"
      )}`
    );
  }

  if (imageForReward?.credit_user_id) {
    await awardIsoTokens(supabase, {
      profileId: imageForReward.credit_user_id,
      amount: 3,
      reason: "gallery_photo_verified",
      reasonKey: `gallery_photo_verified:${imageId}`,
      description: "Submitted gallery photo was verified.",
      entityType: "species_image",
      entityId: imageId,
    });
  }

  revalidatePath("/review");
  revalidatePath("/verify-images");

  if (speciesSlug) {
    revalidatePath(`/${speciesSlug}`);
  }

  redirect("/verify-images?verified=true");
}

async function rejectGalleryImage(formData: FormData) {
  "use server";

  const imageId = String(formData.get("image_id") || "");

  const supabase = await createSupabaseServerClient();

  if (!imageId) {
    redirect("/verify-images?error=missing-image");
  }

  const { error } = await supabase.rpc("reject_isopedia_species_image", {
    image_id: imageId,
  });

  if (error) {
    redirect(
      `/verify-images?error=${encodeURIComponent(
        error.message || "reject-failed"
      )}`
    );
  }

  revalidatePath("/review");
  revalidatePath("/verify-images");

  redirect("/verify-images?rejected=true");
}

export default async function VerifyGalleryImagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    verified?: string;
    rejected?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/verify-images");
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("id, username, role")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!currentProfile?.username) {
    redirect("/account?error=profile-required");
  }

  const { data: adminProfile } = await supabase
    .from("admin_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = currentProfile.role === "admin" || Boolean(adminProfile);
  const isModerator = currentProfile.role === "moderator";
  const isStaff = isAdmin || isModerator;

  const [{ data: rawImages }, { data: verifiedImages }] = await Promise.all([
    supabase
      .from("isopedia_species_images")
      .select(
        `
        id,
        species_id,
        image_url,
        caption,
        credit_user_id,
        status,
        created_at,
        profiles:credit_user_id (
          id,
          username,
          display_name,
          business_name,
          role
        ),
        isopedia_species:species_id (
          id,
          common_name,
          slug,
          image_url
        )
      `
      )
      .eq("status", "unverified")
      .order("created_at", { ascending: true })
      .returns<GalleryImage[]>(),
    supabase
      .from("isopedia_species_images")
      .select("species_id, image_url")
      .eq("status", "verified"),
  ]);

  const images = filterReviewableGalleryImages(rawImages, verifiedImages);

  return (
    <main className="min-h-screen bg-[#0c1710] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <IsopediaNav active="review" />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/review"
            className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
          >
            Back to Review Queue
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-white/10 bg-[#142318] px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-[#18291d]"
          >
            Browse Species
          </Link>
        </div>

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
            Gallery Verification
          </p>

          <h1 className="mt-2 text-4xl font-black text-white">
            Verify Gallery Images
          </h1>

          <p className="mt-3 max-w-3xl text-slate-300">
            Review species gallery images from contributors. Verified images
            appear publicly in the species gallery.
          </p>

          {isStaff && (
            <div className="mt-4 inline-flex rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-200">
              {isAdmin ? "Admin Mode Enabled" : "Moderator Mode Enabled"}
            </div>
          )}
        </div>

        {params.verified === "true" && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
            Gallery image verified and published.
          </div>
        )}

        {params.rejected === "true" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Gallery image rejected.
          </div>
        )}

        {params.error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {decodeURIComponent(params.error)}
          </div>
        )}

        {!images || images.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[#142318] p-8 text-center shadow-xl shadow-black/20">
            <h2 className="text-2xl font-bold text-white">
              No gallery images waiting
            </h2>

            <p className="mt-3 text-slate-400">
              There are currently no unverified gallery images.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {images.map((image) => {
              const contributorName =
                image.profiles?.display_name ||
                image.profiles?.business_name ||
                image.profiles?.username ||
                "Unknown contributor";

              const canVerify = isAdmin || image.credit_user_id !== user.id;

              return (
                <article
                  key={image.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-[#142318] shadow-xl shadow-black/20"
                >
                  <div className="grid gap-0 lg:grid-cols-[420px_1fr]">
                    <div className="border-b border-white/10 bg-[#0b140d] p-4 lg:border-b-0 lg:border-r">
                      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-[#0c1710]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.image_url}
                          alt={
                            image.caption ||
                            image.isopedia_species?.common_name ||
                            "Submitted gallery image"
                          }
                          className="h-full w-full object-contain"
                        />
                      </div>

                      <a
                        href={image.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 block text-center text-sm font-semibold text-emerald-300 hover:text-emerald-200"
                      >
                        Open image
                      </a>
                    </div>

                    <div className="p-6">
                      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
                            Unverified Gallery Image
                          </p>

                          <h2 className="mt-2 text-3xl font-black text-white">
                            {image.isopedia_species?.common_name ||
                              "Unknown Species"}
                          </h2>

                          <p className="mt-3 text-sm text-slate-400">
                            Submitted by{" "}
                            {image.profiles?.username ? (
                              <Link
                                href={`/profile/${image.profiles.username}`}
                                className="font-semibold text-emerald-300 hover:text-emerald-200"
                              >
                                {contributorName}
                              </Link>
                            ) : (
                              contributorName
                            )}
                          </p>

                          {image.isopedia_species?.slug && (
                            <Link
                              href={`/${image.isopedia_species.slug}`}
                              className="mt-3 inline-block text-sm font-semibold text-emerald-300 hover:text-emerald-200"
                            >
                              View species page
                            </Link>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <form action={verifyGalleryImage}>
                            <input
                              type="hidden"
                              name="image_id"
                              value={image.id}
                            />

                            <input
                              type="hidden"
                              name="species_slug"
                              value={image.isopedia_species?.slug || ""}
                            />

                            <button
                              type="submit"
                              disabled={!canVerify}
                              className={
                                canVerify
                                  ? "rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-emerald-300"
                                  : "cursor-not-allowed rounded-xl bg-slate-700 px-5 py-3 font-bold text-slate-400"
                              }
                            >
                              {canVerify ? "Verify & Publish" : "Your Image"}
                            </button>
                          </form>

                          {isStaff && (
                            <form action={rejectGalleryImage}>
                              <input
                                type="hidden"
                                name="image_id"
                                value={image.id}
                              />

                              <button
                                type="submit"
                                className="rounded-xl bg-red-500/20 px-5 py-3 font-bold text-red-200 transition hover:bg-red-500/30"
                              >
                                Reject
                              </button>
                            </form>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-[#0b140d]/80 p-5">
                        <h3 className="mb-3 text-lg font-bold text-white">
                          Caption
                        </h3>

                        {image.caption ? (
                          <p className="whitespace-pre-wrap text-slate-300">
                            {image.caption}
                          </p>
                        ) : (
                          <p className="text-slate-500">
                            No caption submitted.
                          </p>
                        )}
                      </div>

                      {image.isopedia_species?.slug && (
                        <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
                          <h3 className="mb-2 text-lg font-bold text-white">
                            After Verification
                          </h3>

                          <p className="text-sm leading-6 text-slate-300">
                            Once approved, this image will appear in the public
                            gallery section on the species page.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
