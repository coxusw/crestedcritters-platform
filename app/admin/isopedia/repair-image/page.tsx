import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { repairWatermarkedImage } from "./actions";

type PageProps = {
  searchParams?: Promise<{
    repaired?: string;
    refs?: string;
    error?: string;
    image_url?: string;
  }>;
};

function errorMessage(error: string) {
  if (error === "missing-supabase-url") return "Missing Supabase URL configuration.";
  if (error === "invalid-image-url") return "Paste a public Isopedia image URL from the isopedia-images bucket.";
  if (error === "missing-file") return "Choose the clean original image file.";
  if (error === "invalid-file-type") return "Replacement must be an image file.";
  if (error === "file-too-large") return "Replacement image must be 12MB or smaller.";
  return decodeURIComponent(error);
}

export default async function RepairImagePage({ searchParams }: PageProps) {
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
  const selectedImageUrl = params?.image_url || "";

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

          <h1 className="mt-3 text-3xl font-black">Replace Image</h1>

          <p className="mt-2 text-sm leading-6 text-slate-300">
            Replace a junked image with the clean original. This overwrites the
            same Supabase Storage file and refreshes matching image URLs. It
            does not create submissions, change contributor credit, change
            verification status, or award IsoTokens.
          </p>
        </header>

        {params?.repaired === "true" && (
          <section className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4">
            <h2 className="font-bold text-emerald-100">Image repaired</h2>
            <p className="mt-2 text-sm text-emerald-50/80">
              Updated {Number(params.refs || 0)} matching database reference
              {Number(params.refs || 0) === 1 ? "" : "s"}.
            </p>
          </section>
        )}

        {params?.error && (
          <section className="rounded-lg border border-red-400/20 bg-red-400/10 p-4 text-red-100">
            {errorMessage(params.error)}
          </section>
        )}

        <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
          <form action={repairWatermarkedImage} className="grid gap-5">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-100/60">
                Current image URL
              </span>
              <input
                name="image_url"
                type="url"
                required
                defaultValue={selectedImageUrl}
                placeholder="https://.../storage/v1/object/public/isopedia-images/..."
                className="rounded-xl border border-white/10 bg-[#07130c] px-4 py-3 text-sm text-white"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-100/60">
                Replacement image
              </span>
              <input
                name="replacement_image"
                type="file"
                accept="image/*"
                required
                className="rounded-xl border border-white/10 bg-[#07130c] px-4 py-3 text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-400 file:px-3 file:py-2 file:text-sm file:font-bold file:text-slate-950"
              />
            </label>

            <button
              type="submit"
              className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Replace with original
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
