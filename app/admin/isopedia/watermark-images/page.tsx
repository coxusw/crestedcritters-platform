import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { watermarkExistingIsopediaImages } from "./actions";

type PageProps = {
  searchParams?: Promise<{
    processed?: string;
    skipped?: string;
    failed?: string;
    limit?: string;
  }>;
};

export default async function WatermarkImagesPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const [{ data: adminProfile }, { data: roleProfile }] = await Promise.all([
    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle(),
  ]);

  if (!adminProfile && roleProfile?.role !== "admin") {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const processed = Number(params?.processed || 0);
  const skipped = Number(params?.skipped || 0);
  const failed = Number(params?.failed || 0);
  const hasResult = Boolean(params?.processed || params?.skipped || params?.failed);

  return (
    <main className="min-h-screen bg-[#08110d] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="border-b border-white/10 pb-5">
          <Link
            href="/admin/isopedia"
            className="text-sm font-bold text-emerald-300 hover:text-emerald-200"
          >
            Back to Isopedia tools
          </Link>

          <h1 className="mt-3 text-3xl font-black">
            Watermark Existing Isopedia Images
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-300">
            This rewrites existing files in the Supabase Storage
            <code className="mx-1 rounded bg-black/30 px-1.5 py-0.5">
              isopedia-images
            </code>
            bucket at the same paths. It does not create submissions, change
            contributor credit, change verification status, or award IsoTokens.
          </p>
        </header>

        {hasResult && (
          <section className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4">
            <h2 className="font-bold text-emerald-100">Last batch complete</h2>
            <p className="mt-2 text-sm text-emerald-50/80">
              Watermarked {processed} image{processed === 1 ? "" : "s"}.
              Skipped {skipped} already-watermarked image{skipped === 1 ? "" : "s"}.
              Failed {failed}.
            </p>
          </section>
        )}

        <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <h2 className="text-xl font-bold">Run a batch</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Start with a small batch. Files are tagged after processing so this
            tool can skip them on later runs.
          </p>

          <form action={watermarkExistingIsopediaImages} className="mt-5 grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-100/60">
                Batch size
              </span>
              <select
                name="limit"
                defaultValue="10"
                className="rounded-xl border border-white/10 bg-[#07130c] px-4 py-3 text-white"
              >
                <option value="1">1 image</option>
                <option value="5">5 images</option>
                <option value="10">10 images</option>
                <option value="25">25 images</option>
              </select>
            </label>

            <button
              type="submit"
              className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Watermark next batch
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
