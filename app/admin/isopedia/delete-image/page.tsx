import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { deleteIsopediaImage } from "./actions";

type PageProps = {
  searchParams?: Promise<{
    deleted?: string;
    refs?: string;
    cleared?: string;
    rows?: string;
    error?: string;
    image_url?: string;
  }>;
};

function errorMessage(error: string) {
  if (error === "missing-supabase-url") return "Missing Supabase URL configuration.";
  if (error === "invalid-image-url") return "Use a public Isopedia image URL from the isopedia-images bucket.";
  return decodeURIComponent(error);
}

export default async function DeleteImagePage({ searchParams }: PageProps) {
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
  const refs = Number(params?.refs || 0);
  const cleared = Number(params?.cleared || 0);
  const rows = Number(params?.rows || 0);

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

          <h1 className="mt-3 text-3xl font-black">Delete Image</h1>

          <p className="mt-2 text-sm leading-6 text-slate-300">
            Delete an Isopedia image from storage and remove it from matching
            species, gallery, guide, submission, or suggested-edit records. This
            does not change contributor credit history or IsoToken ledger
            entries.
          </p>
        </header>

        {params?.deleted === "true" && (
          <section className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4">
            <h2 className="font-bold text-emerald-100">Image deleted</h2>
            <p className="mt-2 text-sm text-emerald-50/80">
              Found {refs} matching reference{refs === 1 ? "" : "s"}, cleared{" "}
              {cleared} URL field{cleared === 1 ? "" : "s"}, and removed {rows}{" "}
              gallery/guide row{rows === 1 ? "" : "s"}.
            </p>
          </section>
        )}

        {params?.error && (
          <section className="rounded-lg border border-red-400/20 bg-red-400/10 p-4 text-red-100">
            {errorMessage(params.error)}
          </section>
        )}

        <section className="rounded-lg border border-red-400/20 bg-red-400/10 p-5">
          <h2 className="text-xl font-bold text-red-100">Confirm Delete</h2>

          {selectedImageUrl ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/30">
              <div className="relative min-h-[260px]">
                <Image
                  src={selectedImageUrl}
                  alt="Selected image for deletion"
                  fill
                  sizes="(min-width: 768px) 720px, 100vw"
                  className="object-contain"
                />
              </div>
            </div>
          ) : null}

          <form action={deleteIsopediaImage} className="mt-5 grid gap-5">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-red-100/70">
                Image URL
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

            <button
              type="submit"
              className="rounded-xl bg-red-500 px-5 py-3 text-sm font-black text-white transition hover:bg-red-400"
            >
              Permanently delete image
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
