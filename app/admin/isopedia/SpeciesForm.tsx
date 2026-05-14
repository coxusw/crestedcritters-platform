"use client";

import { useState } from "react";
import RichTextEditor from "@/app/components/isopedia/RichTextEditor";

type Species = {
  id?: number;

  organism_type?: string | null;
  genus?: string | null;
  species?: string | null;
  morph?: string | null;
  trade_names?: string | null;

  common_name?: string | null;
  scientific_name?: string | null;
  slug?: string | null;
  difficulty?: string | null;
  origin?: string | null;
  temperature?: string | null;
  humidity?: string | null;
  diet?: string | null;
  substrate?: string | null;
  notes?: string | null;
  image_url?: string | null;
};

type Props = {
  action: (formData: FormData) => void;
  submitLabel: string;
  species?: Species;
};

const ORGANISM_TYPES = [
  "Isopod",
  "Springtail",
  "Millipede",
  "Beetle",
];

export default function SpeciesForm({
  action,
  submitLabel,
  species,
}: Props) {
  const [organismType, setOrganismType] = useState(
    species?.organism_type || "Isopod"
  );

  return (
    <form action={action} className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-xl shadow-black/20">
        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
            Taxonomy / Identification
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
            Species Information
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Field>
            <Label>Organism Type</Label>

            <select
              name="organism_type"
              value={organismType}
              onChange={(e) => setOrganismType(e.target.value)}
              className={inputClass}
            >
              {ORGANISM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>

          <Field>
            <Label>Genus</Label>

            <input
              name="genus"
              defaultValue={species?.genus || ""}
              className={inputClass}
              placeholder="Cubaris"
            />
          </Field>

          <Field>
            <Label>Species</Label>

            <input
              name="species"
              defaultValue={species?.species || ""}
              className={inputClass}
              placeholder="sp."
            />
          </Field>

          <Field>
            <Label>Morph</Label>

            <input
              name="morph"
              defaultValue={species?.morph || ""}
              className={inputClass}
              placeholder="Rubber Ducky"
            />
          </Field>

          <Field className="md:col-span-2">
            <Label>Trade Names</Label>

            <input
              name="trade_names"
              defaultValue={species?.trade_names || ""}
              className={inputClass}
              placeholder="Ducky, Yellow Ducky, Rubber Duck"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-xl shadow-black/20">
        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
            Display Information
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
            Public Species Page
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field>
            <Label>Common Name *</Label>

            <input
              required
              name="common_name"
              defaultValue={species?.common_name || ""}
              className={inputClass}
              placeholder="Rubber Ducky"
            />
          </Field>

          <Field>
            <Label>Scientific Name</Label>

            <input
              name="scientific_name"
              defaultValue={species?.scientific_name || ""}
              className={inputClass}
              placeholder="Cubaris sp."
            />
          </Field>

          <Field>
            <Label>Slug</Label>

            <input
              name="slug"
              defaultValue={species?.slug || ""}
              className={inputClass}
              placeholder="rubber-ducky"
            />
          </Field>

          <Field>
            <Label>Difficulty</Label>

            <select
              name="difficulty"
              defaultValue={species?.difficulty || ""}
              className={inputClass}
            >
              <option value="">Select difficulty</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </Field>

          <Field className="md:col-span-2">
            <Label>Image URL</Label>

            <input
              name="image_url"
              defaultValue={species?.image_url || ""}
              className={inputClass}
              placeholder="https://..."
            />
          </Field>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-xl shadow-black/20">
        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
            Husbandry
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
            Care Information
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Field>
            <Label>Origin</Label>

            <input
              name="origin"
              defaultValue={species?.origin || ""}
              className={inputClass}
              placeholder="Thailand"
            />
          </Field>

          <Field>
            <Label>Temperature</Label>

            <input
              name="temperature"
              defaultValue={species?.temperature || ""}
              className={inputClass}
              placeholder="72-78°F"
            />
          </Field>

          <Field>
            <Label>Humidity</Label>

            <input
              name="humidity"
              defaultValue={species?.humidity || ""}
              className={inputClass}
              placeholder="High humidity"
            />
          </Field>

          <Field>
            <Label>Diet</Label>

            <input
              name="diet"
              defaultValue={species?.diet || ""}
              className={inputClass}
              placeholder="Leaf litter, protein, vegetables"
            />
          </Field>

          <Field>
            <Label>Substrate</Label>

            <input
              name="substrate"
              defaultValue={species?.substrate || ""}
              className={inputClass}
              placeholder="Deep organic substrate"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-xl shadow-black/20">
        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
            Rich Text Care Guide
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
            Notes / Care Guide
          </h2>
        </div>

        <RichTextEditor
          name="notes"
          defaultValue={species?.notes || ""}
        />
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-2xl bg-emerald-400 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`grid gap-2 ${className}`}>{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-bold uppercase tracking-widest text-emerald-100/60">
      {children}
    </label>
  );
}

const inputClass =
  "rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 placeholder:text-slate-500 focus:ring-4";