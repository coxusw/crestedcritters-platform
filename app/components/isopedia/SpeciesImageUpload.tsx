"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function SpeciesImageUpload() {
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  async function uploadImage(file: File) {
    setUploadError("");
    setUploading(true);

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        setUploadError("Supabase environment variables are missing.");
        setUploading(false);
        return;
      }

      const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `submissions/${crypto.randomUUID()}.${fileExt}`;

      const { error } = await supabase.storage
        .from("isopedia-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        setUploadError(error.message);
        setUploading(false);
        return;
      }

      const { data } = supabase.storage
        .from("isopedia-images")
        .getPublicUrl(fileName);

      setImageUrl(data.publicUrl);
    } catch {
      setUploadError("Image upload failed. Please try again.");
    }

    setUploading(false);
  }

  return (
    <div className="grid gap-3">
      <input type="hidden" name="image_url" value={imageUrl} />

      <span className="text-sm font-medium text-slate-200">
        Species Image
      </span>

      <input
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            uploadImage(file);
          }
        }}
        className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-400 file:px-4 file:py-2 file:font-bold file:text-slate-950"
      />

      {uploading && <p className="text-sm text-slate-400">Uploading image...</p>}

      {uploadError && (
        <p className="text-sm font-semibold text-red-300">{uploadError}</p>
      )}

      {imageUrl && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="mb-3 text-sm font-semibold text-emerald-300">
            Image uploaded successfully.
          </p>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Species upload preview"
            className="max-h-72 w-full rounded-xl object-contain"
          />
        </div>
      )}
    </div>
  );
}