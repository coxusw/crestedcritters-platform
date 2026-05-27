"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type Species = {
  id: number;
  common_name: string;
  slug: string;
};

export default function SubmitSpeciesImagePage() {
  const params = useParams();
  const router = useRouter();

  const slug = String(params.slug);

  const [species, setSpecies] = useState<Species | null>(null);

  const [caption, setCaption] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function loadSpecies() {
      const { data, error } = await supabase
        .from("isopedia_species")
        .select("id, common_name, slug")
        .eq("slug", slug)
        .maybeSingle();

      if (error || !data) {
        setError("Species not found.");
        setLoading(false);
        return;
      }

      setSpecies(data);
      setLoading(false);
    }

    loadSpecies();
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!species) {
      setError("Species not found.");
      return;
    }

    if (!imageFile) {
      setError("Please upload an image.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in.");
        setSaving(false);
        return;
      }

      const extension =
        imageFile.name.split(".").pop()?.toLowerCase() || "jpg";

      const filePath = `species-gallery/${species.slug}/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("isopedia-images")
        .upload(filePath, imageFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: imageFile.type,
        });

      if (uploadError) {
        setError(uploadError.message);
        setSaving(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("isopedia-images")
        .getPublicUrl(filePath);

      const imageUrl = publicUrlData.publicUrl;

      const { error: insertError } = await supabase
        .from("isopedia_species_images")
        .insert({
          species_id: species.id,
          image_url: imageUrl,
          caption: caption.trim() || null,
          credit_user_id: user.id,
          status: "unverified",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      setSuccess("Gallery image submitted for review.");

      setTimeout(() => {
        router.push(`/${species.slug}`);
      }, 1500);
    } catch {
      setError("Failed to submit image.");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0c1710] text-white">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0c1710] px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href={`/${slug}`}
            className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
          >
            ← Back to Species
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-white/10 bg-[#142318] px-4 py-2 text-sm font-semibold text-white hover:bg-[#18291d]"
          >
            Browse Species
          </Link>
        </div>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#142318] shadow-2xl shadow-black/30">
          <div className="border-b border-white/10 bg-gradient-to-br from-emerald-500/20 via-[#142318] to-[#0c1710] p-6 sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
              Species Gallery
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
              Submit Gallery Image
            </h1>

            {species && (
              <p className="mt-3 text-lg text-emerald-50/70">
                {species.common_name}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="grid gap-6 p-6 sm:p-8">
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-100/60">
                Upload Image *
              </span>

              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setImageFile(e.target.files?.[0] || null)
                }
                className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-100/60">
                Caption
              </span>

              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                placeholder="Optional notes about the image..."
                className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-emerald-400"
              />
            </label>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-200">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-emerald-400 px-6 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60"
            >
              {saving ? "Submitting..." : "Submit Gallery Image"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
