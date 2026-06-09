"use client";

import { useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import RichTextEditor from "@/app/components/isopedia/RichTextEditor";

const FIELD_OPTIONS = [
  { value: "common_name", label: "Common Name", type: "plain" },
  { value: "scientific_name", label: "Scientific Name", type: "plain" },
  { value: "organism_type", label: "Type", type: "plain" },
  { value: "genus", label: "Genus", type: "plain" },
  { value: "species", label: "Species", type: "plain" },
  { value: "morph", label: "Morph", type: "plain" },
  { value: "trade_names", label: "Trade Names", type: "plain" },
  { value: "difficulty", label: "Difficulty", type: "plain" },
  { value: "origin", label: "Origin", type: "plain" },
  { value: "temperature", label: "Temperature", type: "plain" },
  { value: "humidity", label: "Humidity", type: "plain" },
  { value: "diet", label: "Diet", type: "plain" },
  { value: "substrate", label: "Substrate", type: "plain" },
  { value: "notes", label: "Care Notes", type: "rich" },
  { value: "image_url", label: "Image", type: "image" },
];

export default function SuggestedEditInput() {
  const [fieldName, setFieldName] = useState("");
  const [plainValue, setPlainValue] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const selectedField = useMemo(
    () => FIELD_OPTIONS.find((field) => field.value === fieldName),
    [fieldName]
  );

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
      const fileName = `suggested-edits/${crypto.randomUUID()}.${fileExt}`;

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
    <div className="grid gap-6">
      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-200">
          What field are you suggesting an edit for?
        </span>

        <select
          name="field_name"
          value={fieldName}
          onChange={(event) => {
            setFieldName(event.target.value);
            setPlainValue("");
            setImageUrl("");
            setUploadError("");
          }}
          className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
          required
        >
          <option value="">Choose a field</option>
          {FIELD_OPTIONS.map((field) => (
            <option key={field.value} value={field.value}>
              {field.label}
            </option>
          ))}
        </select>
      </label>

      {selectedField?.type === "image" ? (
        <div className="grid gap-3">
          <input type="hidden" name="proposed_value" value={imageUrl} />

          <span className="text-sm font-medium text-slate-200">
            Upload Suggested Image *
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
            required
          />

          {uploading && (
            <p className="text-sm text-slate-400">Uploading image...</p>
          )}

          {uploadError && (
            <p className="text-sm font-semibold text-red-300">
              {uploadError}
            </p>
          )}

          {imageUrl && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="mb-3 text-sm font-semibold text-emerald-300">
                Image uploaded successfully.
              </p>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Suggested upload preview"
                className="max-h-72 w-full rounded-xl object-contain"
              />
            </div>
          )}
        </div>
      ) : selectedField?.type === "rich" ? (
        <div className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">
            Suggested Replacement *
          </span>

          <p className="text-sm text-slate-400">
            Care Notes supports formatting.
          </p>

          <RichTextEditor name="proposed_value" defaultValue="" />
        </div>
      ) : fieldName ? (
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">
            Suggested Replacement *
          </span>

          <p className="text-sm text-slate-400">
            Plain text only. Formatting is only available for Care Notes.
          </p>

          <textarea
            name="proposed_value"
            value={plainValue}
            onChange={(event) => setPlainValue(event.target.value)}
            rows={4}
            placeholder="Enter the replacement information here."
            className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 placeholder:text-slate-500 focus:ring-4"
            required
          />
        </label>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-400">
          Select a field above to enter your suggested replacement.
        </div>
      )}

      {fieldName && (
        <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-200">
              Why are you suggesting this edit? <span className="text-slate-500">(optional)</span>
            </span>

            <textarea
              name="edit_reason"
              rows={3}
              maxLength={2000}
              placeholder="Add a short explanation for reviewers."
              className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 placeholder:text-slate-500 focus:ring-4"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-200">
              Source information <span className="text-slate-500">(optional)</span>
            </span>

            <textarea
              name="source_info"
              rows={3}
              maxLength={2000}
              placeholder="Add a source, link, observation note, or reference."
              className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 placeholder:text-slate-500 focus:ring-4"
            />
          </label>
        </div>
      )}
    </div>
  );
}
