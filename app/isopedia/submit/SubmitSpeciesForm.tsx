"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Expert"] as const;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type Status = {
  tone: "idle" | "good" | "bad";
  message: string;
};

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function slugifyFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getSafeImageExtension(file: File) {
  const nameExtension = file.name.split(".").pop()?.toLowerCase() || "";
  const mimeExtension = file.type.split("/").pop()?.toLowerCase() || "";
  const extension = nameExtension || mimeExtension || "jpg";

  if (extension === "jpeg") return "jpg";

  if (["jpg", "png", "webp", "gif"].includes(extension)) {
    return extension;
  }

  return "jpg";
}

export default function SubmitSpeciesForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>({
    tone: "idle",
    message: "Fill in what you know. Only the common name is required.",
  });
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function uploadImage(file: File, commonName: string) {
    if (!file || file.size === 0) return null;

    if (!file.type.startsWith("image/")) {
      throw new Error("Uploaded file must be an image.");
    }

    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("Image must be under 10MB.");
    }

    const extension = getSafeImageExtension(file);
    const safeName = slugifyFilePart(commonName) || "species-submission";
    const filePath = `species-submissions/${userId}/${Date.now()}-${safeName}.${extension}`;
    const { error } = await supabase.storage
      .from("isopedia-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from("isopedia-images").getPublicUrl(filePath);
    return data.publicUrl || null;
  }

  async function submitSpecies(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    const formData = new FormData(event.currentTarget);
    const commonName = cleanText(formData.get("common_name"));
    const imageFile = formData.get("image_file");

    if (!commonName) {
      setStatus({ tone: "bad", message: "Common name is required." });
      return;
    }

    setIsSubmitting(true);
    setStatus({ tone: "idle", message: "Submitting species for review..." });

    try {
      let imageUrl: string | null = null;

      if (imageFile instanceof File && imageFile.size > 0) {
        setStatus({ tone: "idle", message: "Uploading image..." });
        imageUrl = await uploadImage(imageFile, commonName);
      }

      setStatus({ tone: "idle", message: "Saving submission..." });

      const response = await fetch("/api/isopedia/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organismType: cleanText(formData.get("organism_type")),
          genus: cleanText(formData.get("genus")),
          species: cleanText(formData.get("species")),
          morph: cleanText(formData.get("morph")),
          commonName,
          scientificName: cleanText(formData.get("scientific_name")),
          tradeNames: cleanText(formData.get("trade_names")),
          difficulty: cleanText(formData.get("difficulty")),
          origin: cleanText(formData.get("origin")),
          temperature: cleanText(formData.get("temperature")),
          humidity: cleanText(formData.get("humidity")),
          diet: cleanText(formData.get("diet")),
          substrate: cleanText(formData.get("substrate")),
          notes: cleanText(formData.get("notes")),
          imageUrl,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Could not submit species.");
      }

      setStatus({ tone: "good", message: "Submission saved. Redirecting..." });
      router.push("/isopedia?submitted=true");
    } catch (error) {
      setStatus({
        tone: "bad",
        message: error instanceof Error ? error.message : "Could not submit species.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const statusClass =
    status.tone === "good"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
      : status.tone === "bad"
        ? "border-red-400/20 bg-red-400/10 text-red-100"
        : "border-white/10 bg-white/5 text-emerald-50/70";

  return (
    <form onSubmit={submitSpecies} className="grid gap-6 p-6 sm:p-8">
      <section className="grid gap-5 rounded-3xl border border-white/10 bg-[#07130c]/70 p-5">
        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
            Identity
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
            Species Information
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Organism Type"
            name="organism_type"
            placeholder="Isopod, Springtail, Millipede, Beetle..."
          />

          <Field
            label="Common Name"
            name="common_name"
            required
            placeholder="Rubber Ducky, Dairy Cow, Orange Springtail..."
          />

          <Field
            label="Scientific Name"
            name="scientific_name"
            placeholder="Cubaris sp., Porcellio laevis..."
          />

          <Field
            label="Trade Names"
            name="trade_names"
            placeholder="Other hobby names, line names, aliases..."
          />

          <Field label="Genus" name="genus" placeholder="Cubaris" />

          <Field
            label="Species"
            name="species"
            placeholder="sp., murina, laevis..."
          />

          <Field
            label="Morph"
            name="morph"
            placeholder="Rubber Ducky, Dairy Cow, Orange..."
          />

          <DifficultyField />
        </div>
      </section>

      <section className="grid gap-5 rounded-3xl border border-white/10 bg-[#07130c]/70 p-5">
        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
            Care
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
            Husbandry Details
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Origin"
            name="origin"
            placeholder="Country/region if known"
          />

          <Field
            label="Temperature"
            name="temperature"
            placeholder="Example: 70-76 degrees F"
          />

          <Field
            label="Humidity"
            name="humidity"
            placeholder="Example: Moist gradient, 60-80%"
          />

          <Field
            label="Diet"
            name="diet"
            placeholder="Leaf litter, protein, vegetables..."
          />

          <Field
            label="Substrate"
            name="substrate"
            placeholder="Organic soil, leaf litter, rotting wood..."
          />

          <ImageUploadField />
        </div>

        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
            Notes
          </span>

          <textarea
            name="notes"
            rows={8}
            placeholder="Care notes, breeding notes, behavior, warnings, keeper observations..."
            className="rounded-2xl border border-white/10 bg-[#102016] px-4 py-3 text-white outline-none transition placeholder:text-emerald-50/30 focus:border-emerald-400/40"
          />
        </label>
      </section>

      <div className={`rounded-2xl border p-4 text-center text-sm leading-6 ${statusClass}`}>
        {status.message}
      </div>

      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-center text-sm leading-6 text-amber-100">
        Species submissions are community-reviewed before becoming public.
        Please submit only information you believe is accurate and helpful.
      </div>

      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Link
          href="/isopedia"
          className="rounded-2xl border border-white/10 bg-[#07130c] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#102016]"
        >
          Cancel
        </Link>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Submitting..." : "Submit for Review"}
        </button>
      </div>
    </form>
  );
}

function DifficultyField() {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
        Difficulty
      </span>

      <select
        name="difficulty"
        defaultValue=""
        className="rounded-2xl border border-white/10 bg-[#102016] px-4 py-3 text-white outline-none transition focus:border-emerald-400/40"
      >
        <option value="" className="bg-[#102016] text-white">
          Select difficulty
        </option>
        {DIFFICULTY_OPTIONS.map((option) => (
          <option key={option} value={option} className="bg-[#102016] text-white">
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ImageUploadField() {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
        Upload Image Optional
      </span>

      <input
        type="file"
        name="image_file"
        accept="image/*"
        className="rounded-2xl border border-white/10 bg-[#102016] px-4 py-3 text-white outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-400 file:px-4 file:py-2 file:text-sm file:font-black file:text-slate-950 hover:file:bg-emerald-300"
      />

      <span className="text-xs text-emerald-50/45">
        Optional. JPG, PNG, WEBP, or GIF. Max 10MB.
      </span>
    </label>
  );
}

function Field({
  label,
  name,
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
        {label}
      </span>

      <input
        name={name}
        required={required}
        placeholder={placeholder}
        className="rounded-2xl border border-white/10 bg-[#102016] px-4 py-3 text-white outline-none transition placeholder:text-emerald-50/30 focus:border-emerald-400/40"
      />
    </label>
  );
}
