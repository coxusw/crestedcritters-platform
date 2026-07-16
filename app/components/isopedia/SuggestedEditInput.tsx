"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import RichTextEditor from "@/app/components/isopedia/RichTextEditor";

type SpeciesEditValues = {
  common_name: string;
  scientific_name: string | null;
  organism_type: string | null;
  genus: string | null;
  species: string | null;
  morph: string | null;
  trade_names: string | null;
  difficulty: string | null;
  origin: string | null;
  temperature: string | null;
  humidity: string | null;
  diet: string | null;
  substrate: string | null;
  notes: string | null;
  source_info: string | null;
  image_url: string | null;
};

type FieldOption = {
  value: keyof SpeciesEditValues;
  label: string;
  type: "plain" | "rich" | "image";
  group: "Identity" | "Care Basics" | "Care Details" | "Media";
  help?: string;
  rows?: number;
};

const FIELD_OPTIONS = [
  { value: "common_name", label: "Common Name", type: "plain", group: "Identity" },
  { value: "scientific_name", label: "Scientific Name", type: "plain", group: "Identity" },
  { value: "organism_type", label: "Type", type: "plain", group: "Identity" },
  { value: "genus", label: "Genus", type: "plain", group: "Identity" },
  { value: "species", label: "Species", type: "plain", group: "Identity" },
  { value: "morph", label: "Morph", type: "plain", group: "Identity" },
  { value: "trade_names", label: "Trade Names", type: "plain", group: "Identity" },
  { value: "difficulty", label: "Difficulty", type: "plain", group: "Care Basics" },
  { value: "origin", label: "Origin", type: "plain", group: "Care Basics" },
  { value: "temperature", label: "Temperature", type: "plain", group: "Care Basics" },
  { value: "humidity", label: "Humidity", type: "plain", group: "Care Basics" },
  { value: "diet", label: "Diet", type: "plain", group: "Care Details", rows: 3 },
  { value: "substrate", label: "Substrate", type: "plain", group: "Care Details", rows: 3 },
  {
    value: "notes",
    label: "Care Notes",
    type: "rich",
    group: "Care Details",
    help: "Formatting is available for care notes.",
  },
  {
    value: "source_info",
    label: "Footnotes / Sources",
    type: "plain",
    group: "Care Details",
    rows: 4,
    help: "Add sources, links, observations, or reference notes.",
  },
  { value: "image_url", label: "Image", type: "image", group: "Media" },
] satisfies FieldOption[];

const FIELD_GROUPS: FieldOption["group"][] = [
  "Identity",
  "Care Basics",
  "Care Details",
  "Media",
];

export default function SuggestedEditInput({
  species,
}: {
  species: SpeciesEditValues;
}) {
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
      const fileName = `suggested-edits/${crypto.randomUUID()}.${fileExt}`;

      const { error } = await supabase.storage
        .from("isopedia-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "image/jpeg",
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
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm leading-6 text-slate-300">
        Fill in only the fields you want changed. Blank fields will be skipped,
        so one submission can include a single correction or several related
        updates.
      </div>

      {FIELD_GROUPS.map((group) => (
        <section key={group} className="grid gap-4">
          <h2 className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">
            {group}
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            {FIELD_OPTIONS.filter((field) => field.group === group).map(
              (field) => (
                <FieldEditor
                  key={field.value}
                  field={field}
                  currentValue={species[field.value]}
                  imageUrl={imageUrl}
                  uploading={uploading}
                  uploadError={uploadError}
                  uploadImage={uploadImage}
                />
              )
            )}
          </div>
        </section>
      ))}

      <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-200">
            Why are you suggesting these edits?{" "}
            <span className="text-slate-500">(optional)</span>
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
            Source information for reviewers{" "}
            <span className="text-slate-500">(optional)</span>
          </span>

          <textarea
            name="source_info"
            rows={3}
            maxLength={2000}
            placeholder="Add a source, link, observation note, or reference for reviewers."
            className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 placeholder:text-slate-500 focus:ring-4"
          />
        </label>
      </div>
    </div>
  );
}

function FieldEditor({
  field,
  currentValue,
  imageUrl,
  uploading,
  uploadError,
  uploadImage,
}: {
  field: FieldOption;
  currentValue: string | null;
  imageUrl: string;
  uploading: boolean;
  uploadError: string;
  uploadImage: (file: File) => void;
}) {
  const fieldId = `edit-${field.value}`;
  const fieldName = `field_${field.value}`;
  const isWide = field.type === "rich" || field.value === "source_info" || field.type === "image";

  return (
    <div
      id={fieldId}
      className={`scroll-mt-24 rounded-2xl border border-white/10 bg-slate-950/60 p-4 target:border-emerald-300/70 target:bg-emerald-400/10 ${
        isWide ? "md:col-span-2" : ""
      }`}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white">{field.label}</h3>
          {field.help && (
            <p className="mt-1 text-sm text-slate-400">{field.help}</p>
          )}
        </div>

        <p className="max-w-full rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Optional
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-white/10 bg-slate-900 p-3">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
          Current
        </p>
        <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">
          {displayCurrentValue(currentValue, field.type)}
        </p>
      </div>

      {field.type === "image" ? (
        <ImageField
          name={fieldName}
          imageUrl={imageUrl}
          uploading={uploading}
          uploadError={uploadError}
          uploadImage={uploadImage}
        />
      ) : field.type === "rich" ? (
        <RichTextEditor name={fieldName} defaultValue="" />
      ) : (
        <textarea
          name={fieldName}
          rows={field.rows || 2}
          placeholder={`Suggested ${field.label.toLowerCase()}`}
          className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 placeholder:text-slate-500 focus:ring-4"
        />
      )}
    </div>
  );
}

function ImageField({
  name,
  imageUrl,
  uploading,
  uploadError,
  uploadImage,
}: {
  name: string;
  imageUrl: string;
  uploading: boolean;
  uploadError: string;
  uploadImage: (file: File) => void;
}) {
  return (
    <div className="grid gap-3">
      <input type="hidden" name={name} value={imageUrl} />

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

      {uploading && (
        <p className="text-sm text-slate-400">Uploading image...</p>
      )}

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
            alt="Suggested upload preview"
            className="max-h-72 w-full rounded-xl object-contain"
          />
        </div>
      )}
    </div>
  );
}

function displayCurrentValue(value: string | null, type: FieldOption["type"]) {
  const cleaned =
    type === "rich"
      ? (value || "")
          .replace(/<[^>]*>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : (value || "").trim();

  return cleaned || "Not listed";
}
