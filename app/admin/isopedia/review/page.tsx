import Link from "next/link";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { filterReviewableGalleryImages } from "@/lib/isopedia-gallery-review";

export default async function AdminIsopediaReviewPage() {
  await requireContentAgentAdmin();

  const supabase = createSupabaseAdminClient();
  const [submissions, edits, images, verifiedImages] = await Promise.all([
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

  const submissionCount = submissions.count || 0;
  const editCount = edits.count || 0;
  const imageCount = filterReviewableGalleryImages(images.data, verifiedImages.data).length;

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="text-emerald-300 underline" href="/admin">
            Back to Admin Dashboard
          </Link>
          <Link className="text-emerald-300 underline" href="/isopedia">
            View public Isopedia
          </Link>
        </div>

        <header className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
            Isopedia Admin
          </p>
          <h1 className="mt-2 text-3xl font-black">Review Queues</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Staff entry point for species submissions, suggested edits, and
            gallery image verification. Community-facing review URLs still exist
            for contributors, but staff can start here.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <ReviewCard
            href="/admin/isopedia/verify"
            title="Species Submissions"
            count={submissionCount}
            description="Review new species pages submitted by contributors."
          />
          <ReviewCard
            href="/admin/isopedia/verify-edits"
            title="Suggested Edits"
            count={editCount}
            description="Review proposed changes to existing species pages."
          />
          <ReviewCard
            href="/admin/isopedia/verify-images"
            title="Gallery Images"
            count={imageCount}
            description="Review submitted species gallery images."
          />
        </section>
      </div>
    </main>
  );
}

function ReviewCard({
  href,
  title,
  count,
  description,
}: {
  href: string;
  title: string;
  count: number;
  description: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border p-5 transition hover:-translate-y-0.5 ${
        count > 0
          ? "border-amber-400/30 bg-amber-400/10 hover:border-amber-300/60"
          : "border-white/10 bg-white/[0.05] hover:border-emerald-300/50"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-black">{title}</h2>
        <span className="rounded-md bg-emerald-400 px-3 py-2 text-xl font-black text-slate-950">
          {count}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-300">{description}</p>
      <p className="mt-5 text-sm font-black text-emerald-300">Open queue</p>
    </Link>
  );
}
