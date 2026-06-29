"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { publicSpeciesSlug, storedSpeciesSlug } from "@/lib/isopedia-slugs";
import { watermarkImageFile } from "@/app/components/isopedia/image-watermark";

type Species = {
  id: number;
  common_name: string;
  slug: string;
};

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export default function SubmitSpeciesImagePage() {
  const params = useParams();
  const router = useRouter();

  const slug = String(params.slug);
  const lookupSlug = storedSpeciesSlug(slug);

  const [species, setSpecies] = useState<Species | null>(null);

  const [caption, setCaption] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  useEffect(() => {
    async function loadSpecies() {
      const { data, error } = await supabase
        .from("isopedia_species")
        .select("id, common_name, slug")
        .eq("slug", lookupSlug)
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
  }, [lookupSlug]);

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

    if (!imageFile.type.startsWith("image/")) {
      setError("Uploaded file must be an image.");
      return;
    }

    if (imageFile.size > MAX_IMAGE_BYTES) {
      setError("Image must be under 25MB.");
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

      const watermarkedFile = await watermarkImageFile(imageFile);
      const extension =
        watermarkedFile.name.split(".").pop()?.toLowerCase() || "jpg";

      const filePath = `species-gallery/${user.id}/${species.slug}/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("isopedia-images")
        .upload(filePath, watermarkedFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: watermarkedFile.type,
          metadata: { isopediaWatermarked: "true" },
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

      const insertResponse = await fetch("/api/isopedia/gallery-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speciesId: species.id,
          imageUrl,
          caption,
        }),
      });

      if (!insertResponse.ok) {
        const payload = await insertResponse.json().catch(() => null);
        setError(payload?.error || "Could not save gallery image.");
        setSaving(false);
        return;
      }

      setSuccess("Gallery image submitted for review.");

      setTimeout(() => {
        router.push(`/${publicSpeciesSlug(species.slug)}`);
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
            href={`/${species ? publicSpeciesSlug(species.slug) : slug}`}
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

              <span className="text-xs text-emerald-50/45">
                JPG, PNG, WEBP, or GIF. Max 25MB.
              </span>
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
