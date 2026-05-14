import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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

  const [submissionsResult, editsResult, imagesResult] = await Promise.all([
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
      .select("id", { count: "exact", head: true })
      .eq("status", "unverified"),
  ]);

  const submissionCount = submissionsResult.count || 0;
  const editCount = editsResult.count || 0;
  const imageCount = imagesResult.count || 0;
  const totalCount = submissionCount + editCount + imageCount;

  return (
    <main className="min-h-screen bg-[#0c1710] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <Link
            href="/isopedia"
            className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
          >
            ← Back to Isopedia
          </Link>
        </div>

        <section className="mb-8 rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-xl shadow-black/20 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
            Community Review
          </p>

          <h1 className="mt-2 text-4xl font-black text-white">
            Isopedia Review Queue
          </h1>

          <p className="mt-3 max-w-3xl text-slate-300">
            Review new species submissions, suggested edits, and gallery images
            from other contributors. You cannot verify your own submissions,
            edits, or images.
          </p>

          <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
              Total Items Waiting
            </p>
            <p className="mt-2 text-5xl font-black text-white">{totalCount}</p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <ReviewCard
            href="/isopedia/verify"
            label="New Species"
            title="Verify Submissions"
            description="Review full new species entries submitted by contributors. Approved submissions become public Isopedia pages."
            count={submissionCount}
            buttonText="Open submission queue →"
          />

          <ReviewCard
            href="/isopedia/verify-edits"
            label="Existing Species"
            title="Verify Suggested Edits"
            description="Review corrections, care updates, taxonomy changes, and image suggestions for existing species pages."
            count={editCount}
            buttonText="Open edit queue →"
          />

          <ReviewCard
            href="/isopedia/verify-images"
            label="Gallery Images"
            title="Verify Gallery Images"
            description="Review uploaded species gallery images before they appear publicly on species pages."
            count={imageCount}
            buttonText="Open image queue →"
          />
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-xl shadow-black/20">
          <h2 className="text-2xl font-bold text-white">Review Rules</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <RuleCard
              title="Second-user verification"
              text="A submission, edit, or image must be verified by someone other than the original contributor."
            />

            <RuleCard
              title="Give credit"
              text="The original contributor receives credit, and the verifier receives review credit."
            />

            <RuleCard
              title="Check carefully"
              text="Only verify content you believe is accurate, useful, appropriate, and relevant to the species page."
            />
          </div>
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
      className="group rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-xl shadow-black/20 transition hover:border-emerald-400/40 hover:bg-[#18291d]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
            {label}
          </p>

          <h2 className="mt-2 text-3xl font-bold text-white">{title}</h2>

          <p className="mt-3 text-slate-400">{description}</p>
        </div>

        <div className="rounded-2xl bg-emerald-400 px-4 py-3 text-2xl font-black text-slate-950">
          {count}
        </div>
      </div>

      <p className="mt-6 text-sm font-bold text-emerald-300 group-hover:text-emerald-200">
        {buttonText}
      </p>
    </Link>
  );
}

function RuleCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b140d]/70 p-5">
      <h3 className="font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
    </div>
  );
}