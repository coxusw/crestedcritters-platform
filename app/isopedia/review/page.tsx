import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import { filterReviewableGalleryImages } from "@/lib/isopedia-gallery-review";

type Profile = {
  id: string;
  username: string | null;
};

export default async function IsopediaReviewPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/isopedia/review");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!profile?.username) {
    redirect("/account?error=profile-required");
  }

  const [submissionsResult, editsResult, imagesResult, verifiedImagesResult] = await Promise.all([
    supabase
      .from("isopedia_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "unverified"),

    supabase
      .from("isopedia_suggested_edits")
      .select("id", { count: "exact", head: true })
      .eq("status", "unverified"),

    supabase
      .from("isopedia_species_images")
      .select(
        `
        id,
        species_id,
        image_url,
        isopedia_species:species_id (
          image_url
        )
        `
      )
      .eq("status", "unverified"),
    supabase
      .from("isopedia_species_images")
      .select("species_id, image_url")
      .eq("status", "verified"),
  ]);

  const submissionCount = submissionsResult.count || 0;
  const editCount = editsResult.count || 0;
  const imageCount = filterReviewableGalleryImages(
    imagesResult.data,
    verifiedImagesResult.data
  ).length;
  const totalCount = submissionCount + editCount + imageCount;

  return (
    <main className="min-h-screen bg-[#07130c] px-4 py-6 text-slate-100 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <IsopediaNav active="review" />

        <section className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#102016] shadow-2xl shadow-black/30">
          <div className="bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_36%),linear-gradient(135deg,rgba(6,78,59,0.48),rgba(7,19,12,0.95))] px-6 py-8 sm:px-10 sm:py-10">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-300 sm:text-sm">
                Community Review
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-6xl">
                Isopedia Review Queue
              </h1>

              <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-emerald-50/80 sm:text-lg">
                Review new species submissions, suggested edits, and gallery
                images from other contributors. You cannot verify your own
                submissions, edits, or images.
              </p>

              <div className="mx-auto mt-8 max-w-sm rounded-3xl border border-white/10 bg-black/20 p-5 text-center shadow-xl shadow-black/20">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300/80">
                  Total Items Waiting
                </p>

                <p className="mt-3 text-5xl font-black text-white">
                  {totalCount}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-8 grid max-w-5xl gap-6 lg:grid-cols-3">
          <ReviewCard
            href="/isopedia/verify"
            label="New Species"
            title="Verify Submissions"
            description="Review full new species entries submitted by contributors. Approved submissions become public Isopedia pages."
            count={submissionCount}
            buttonText="Open submission queue ->"
          />

          <ReviewCard
            href="/isopedia/verify-edits"
            label="Existing Species"
            title="Verify Suggested Edits"
            description="Review corrections, care updates, taxonomy changes, and image suggestions for existing species pages."
            count={editCount}
            buttonText="Open edit queue ->"
          />

          <ReviewCard
            href="/isopedia/verify-images"
            label="Gallery Images"
            title="Verify Gallery Images"
            description="Review uploaded species gallery images before they appear publicly on species pages."
            count={imageCount}
            buttonText="Open image queue ->"
          />
        </section>
      </div>
    </main>
  );
}

function ReviewCard({
  href,
  label,
  title,
  description,
  count,
  buttonText,
}: {
  href: string;
  label: string;
  title: string;
  description: string;
  count: number;
  buttonText: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border border-white/10 bg-[#102016] p-6 shadow-xl shadow-black/20 transition hover:border-emerald-400/40 hover:bg-[#14311f]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
            {label}
          </p>

          <h2 className="mt-3 text-3xl font-black text-white">{title}</h2>

          <p className="mt-4 text-sm leading-6 text-emerald-50/60">
            {description}
          </p>
        </div>

        <div className="rounded-2xl bg-emerald-400 px-4 py-3 text-2xl font-black text-slate-950">
          {count}
        </div>
      </div>

      <p className="mt-6 text-sm font-black text-emerald-300 group-hover:text-emerald-200">
        {buttonText}
      </p>
    </Link>
  );
}
