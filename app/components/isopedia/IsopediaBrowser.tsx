"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Species = {
  id: number;
  organism_type: string | null;
  genus: string | null;
  species: string | null;
  morph: string | null;
  trade_names: string | null;
  common_name: string;
  scientific_name: string | null;
  slug: string;
  difficulty: string | null;
  temperature: string | null;
  humidity: string | null;
  image_url: string | null;
};

type Props = {
  species: Species[];
};

type FilterOption = {
  value: string;
  label: string;
};

function normalizeFilterValue(value: string | null) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function toDisplayLabel(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function uniqueValues(items: Species[], key: keyof Species): FilterOption[] {
  const map = new Map<string, string>();

  for (const item of items) {
    const rawValue = item[key];

    if (typeof rawValue !== "string") continue;

    const normalized = normalizeFilterValue(rawValue);

    if (!normalized) continue;

    if (!map.has(normalized)) {
      map.set(normalized, toDisplayLabel(rawValue));
    }
  }

  return Array.from(map.entries())
    .map(([value, label]) => ({
      value,
      label,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function matchesSearch(item: Species, search: string) {
  const query = search.toLowerCase().trim();

  if (!query) return true;

  const haystack = [
    item.common_name,
    item.scientific_name,
    item.organism_type,
    item.genus,
    item.species,
    item.morph,
    item.trade_names,
    item.difficulty,
    item.temperature,
    item.humidity,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export default function IsopediaBrowser({ species }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [genusFilter, setGenusFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");

  const typeOptions = useMemo(
    () => uniqueValues(species, "organism_type"),
    [species]
  );

  const genusOptions = useMemo(
    () => uniqueValues(species, "genus"),
    [species]
  );

  const difficultyOptions = useMemo(
    () => uniqueValues(species, "difficulty"),
    [species]
  );

  const filteredSpecies = useMemo(() => {
    return species.filter((item) => {
      const matchesType = typeFilter
        ? normalizeFilterValue(item.organism_type) === typeFilter
        : true;

      const matchesGenus = genusFilter
        ? normalizeFilterValue(item.genus) === genusFilter
        : true;

      const matchesDifficulty = difficultyFilter
        ? normalizeFilterValue(item.difficulty) === difficultyFilter
        : true;

      return (
        matchesSearch(item, search) &&
        matchesType &&
        matchesGenus &&
        matchesDifficulty
      );
    });
  }, [species, search, typeFilter, genusFilter, difficultyFilter]);

  function clearFilters() {
    setSearch("");
    setTypeFilter("");
    setGenusFilter("");
    setDifficultyFilter("");
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
            Browse Database
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">
            Verified Species
          </h2>
        </div>

        <p className="text-sm text-emerald-50/60">
          Showing {filteredSpecies.length} of {species.length} verified entr
          {species.length === 1 ? "y" : "ies"}
        </p>
      </div>

      <div className="mb-6 rounded-3xl border border-emerald-900/40 bg-[#142318] p-5 shadow-xl shadow-black/20">
        <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px_180px_auto]">
          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-100/50">
              Search
            </span>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, trade name, genus, morph..."
              className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none ring-emerald-400/30 placeholder:text-emerald-50/30 focus:ring-4"
            />
          </label>

          <FilterSelect
            label="Type"
            value={typeFilter}
            onChange={setTypeFilter}
            options={typeOptions}
            emptyLabel="All Types"
          />

          <FilterSelect
            label="Genus"
            value={genusFilter}
            onChange={setGenusFilter}
            options={genusOptions}
            emptyLabel="All Genus"
          />

          <FilterSelect
            label="Difficulty"
            value={difficultyFilter}
            onChange={setDifficultyFilter}
            options={difficultyOptions}
            emptyLabel="All Difficulty"
          />

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {filteredSpecies.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSpecies.map((item) => (
            <Link
              key={item.id}
              href={`/isopedia/${item.slug}`}
              className="group overflow-hidden rounded-3xl border border-emerald-900/40 bg-[#142318] shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-emerald-400/60 hover:bg-[#18291d]"
            >
              <div className="flex h-48 w-full items-center justify-center bg-[#0b140d] p-3">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.common_name}
                    className="h-full w-full object-contain transition group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-emerald-900/60 text-sm text-emerald-100/40">
                    No image
                  </div>
                )}
              </div>

              <div className="p-5">
                <div className="mb-3 flex flex-wrap gap-2">
                  {item.organism_type && (
                    <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
                      {toDisplayLabel(item.organism_type)}
                    </span>
                  )}

                  {item.difficulty && (
                    <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200">
                      {toDisplayLabel(item.difficulty)}
                    </span>
                  )}
                </div>

                <h3 className="text-2xl font-black text-white">
                  {item.common_name}
                </h3>

                {item.scientific_name && (
                  <p className="mt-1 italic text-emerald-50/70">
                    {item.scientific_name}
                  </p>
                )}

                <div className="mt-4 grid gap-2 text-sm text-emerald-50/70">
                  {(item.genus || item.species || item.morph) && (
                    <p>
                      {[item.genus, item.species, item.morph]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                  )}

                  {item.trade_names && (
                    <p className="line-clamp-2">
                      Also searched as: {item.trade_names}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 text-xs">
                    {item.temperature && (
                      <span className="rounded-full bg-black/25 px-3 py-1 text-emerald-50/75">
                        {item.temperature}
                      </span>
                    )}

                    {item.humidity && (
                      <span className="rounded-full bg-black/25 px-3 py-1 text-emerald-50/75">
                        {item.humidity}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-emerald-900/40 bg-[#142318] p-8 text-center shadow-xl shadow-black/20">
          <p className="text-emerald-50/70">
            No entries match your current search or filters.
          </p>

          <button
            type="button"
            onClick={clearFilters}
            className="mt-5 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
          >
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  emptyLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  emptyLabel: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-widest text-emerald-100/50">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
      >
        <option value="">{emptyLabel}</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}