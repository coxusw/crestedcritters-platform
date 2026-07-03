"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Props = {
  initialUrl: string | null;
};

export default function ProfileBannerUpload({ initialUrl }: Props) {
  const [bannerUrl, setBannerUrl] = useState(initialUrl || "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function uploadBanner(file: File) {
    setUploadError("");
    setUploading(true);

    try {
      if (!file.type.startsWith("image/")) {
        setUploadError("Please upload an image file.");
        setUploading(false);
        return;
      }

      if (file.size > 6 * 1024 * 1024) {
        setUploadError("Please keep profile banners under 6 MB.");
        setUploading(false);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUploadError("You must be logged in to upload a profile banner.");
        setUploading(false);
        return;
      }

      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `profile-banners/${user.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error } = await supabase.storage
        .from("isopedia-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (error) {
        setUploadError(error.message);
        setUploading(false);
        return;
      }

      const { data } = supabase.storage
        .from("isopedia-images")
        .getPublicUrl(filePath);

      setBannerUrl(data.publicUrl);
    } catch {
      setUploadError("Profile banner upload failed. Please try again.");
    }

    setUploading(false);
  }

  return (
    <div className="grid gap-3">
      <input type="hidden" name="profile_banner_url" value={bannerUrl} />

      <span className="text-sm font-medium text-slate-200">Profile Banner</span>

      <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950 p-4">
        <div className="flex aspect-[5/2] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900 text-sm font-black uppercase tracking-[0.2em] text-emerald-300">
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bannerUrl}
              alt="Current profile banner preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <span>No banner selected</span>
          )}
        </div>

        <div className="grid gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadBanner(file);
            }}
            className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-400 file:px-4 file:py-2 file:font-bold file:text-slate-950"
          />

          <p className="text-xs leading-5 text-slate-500">
            Wide images work best. JPG, PNG, or WebP under 6 MB.
          </p>

          {bannerUrl && !uploading && (
            <button
              type="button"
              onClick={() => setBannerUrl("")}
              className="w-fit rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
            >
              Remove Banner
            </button>
          )}

          {uploading && (
            <p className="text-sm font-semibold text-slate-400">
              Uploading profile banner...
            </p>
          )}

          {uploadError && (
            <p className="text-sm font-semibold text-red-300">{uploadError}</p>
          )}

          {bannerUrl && !uploading && (
            <p className="text-sm font-semibold text-emerald-300">
              Profile banner ready. Save your profile to publish it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
