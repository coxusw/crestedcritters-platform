"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Props = {
  initialUrl: string | null;
};

export default function ProfileLogoUpload({ initialUrl }: Props) {
  const [logoUrl, setLogoUrl] = useState(initialUrl || "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function uploadLogo(file: File) {
    setUploadError("");
    setUploading(true);

    try {
      if (!file.type.startsWith("image/")) {
        setUploadError("Please upload an image file.");
        setUploading(false);
        return;
      }

      if (file.size > 4 * 1024 * 1024) {
        setUploadError("Please keep profile logos under 4 MB.");
        setUploading(false);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUploadError("You must be logged in to upload a profile logo.");
        setUploading(false);
        return;
      }

      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `profile-logos/${user.id}/${crypto.randomUUID()}.${fileExt}`;

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

      setLogoUrl(data.publicUrl);
    } catch {
      setUploadError("Profile logo upload failed. Please try again.");
    }

    setUploading(false);
  }

  return (
    <div className="grid gap-3">
      <input type="hidden" name="profile_logo_url" value={logoUrl} />

      <span className="text-sm font-medium text-slate-200">Profile Logo</span>

      <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950 p-4 sm:grid-cols-[96px_1fr] sm:items-center">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900 text-3xl font-black text-emerald-300">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Current profile logo preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <span>?</span>
          )}
        </div>

        <div className="grid gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) uploadLogo(file);
            }}
            className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-400 file:px-4 file:py-2 file:font-bold file:text-slate-950"
          />

          <p className="text-xs leading-5 text-slate-500">
            Square images work best. JPG, PNG, or WebP under 4 MB.
          </p>

          {uploading && (
            <p className="text-sm font-semibold text-slate-400">
              Uploading profile logo...
            </p>
          )}

          {uploadError && (
            <p className="text-sm font-semibold text-red-300">{uploadError}</p>
          )}

          {logoUrl && !uploading && (
            <p className="text-sm font-semibold text-emerald-300">
              Profile logo ready. Save your profile to publish it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
