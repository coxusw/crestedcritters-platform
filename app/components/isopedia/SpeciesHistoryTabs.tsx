"use client";

import Link from "next/link";
import { useState } from "react";

type ContributorProfile = {
  username: string | null;
  display_name: string | null;
  business_name: string | null;
};

type ContributorCredit = {
  id: string;
  profiles: ContributorProfile | null;
};

type SpeciesInfo = {
  organism_type: string | null;
  common_name: string;
  scientific_name: string | null;
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
};

export type SpeciesChangeHistoryItem = {
  id: string;
  fieldLabel: string;
  currentValue: string;
  proposedValue: string;
  editReason: string | null;
  sourceInfo: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  suggestedProfile: ContributorProfile | null;
  verifiedProfile: ContributorProfile | null;
};

export default function SpeciesHistoryTabs({
  species,
  speciesSubmitterCredits,
  fieldSuggestedCredits,
  changes,
}: {
  species: SpeciesInfo;
  speciesSubmitterCredits: ContributorCredit[];
  fieldSuggestedCredits: Record<string, ContributorCredit[]>;
  changes: SpeciesChangeHistoryItem[];
}) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="p-5 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.3em] text-emerald-300 sm:text-sm">
            {species.organism_type || "Isopedia Species Profile"}
          </p>

          <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
            {species.common_name}
          </h1>

          {species.scientific_name && (
            <p className="mt-3 text-lg italic text-emerald-50/70">
              {species.scientific_name}
            </p>
          )}

          {speciesSubmitterCredits.length > 0 && (
            <div className="mt-4 text-xs leading-5 text-emerald-50/45">
              <span className="font-black uppercase tracking-[0.18em] text-emerald-100/50">
                Community credit:
              </span>{" "}
              Species submitted by{" "}
              <ContributorLinks credits={speciesSubmitterCredits} />.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowHistory((value) => !value)}
          className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/20"
        >
          {showHistory ? "Species Info" : "History"}
        </button>
      </div>

      {showHistory ? (
        <ChangeHistory changes={changes} />
      ) : (
        <SpeciesInfoCards
          species={species}
          fieldSuggestedCredits={fieldSuggestedCredits}
        />
      )}
    </div>
  );
}

function SpeciesInfoCards({
  species,
  fieldSuggestedCredits,
}: {
  species: SpeciesInfo;
  fieldSuggestedCredits: Record<string, ContributorCredit[]>;
}) {
  return (
    <>
      <div className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
        <h2 className="mb-3 text-lg font-black text-white">Taxonomy / ID</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard
            label="Type"
            value={species.organism_type}
            suggestedBy={fieldSuggestedCredits.organism_type}
          />
          <InfoCard
            label="Genus"
            value={species.genus}
            suggestedBy={fieldSuggestedCredits.genus}
          />
          <InfoCard
            label="Species"
            value={species.species}
            suggestedBy={fieldSuggestedCredits.species}
          />
          <InfoCard
            label="Morph"
            value={species.morph}
            suggestedBy={fieldSuggestedCredits.morph}
          />
          <InfoCard
            label="Trade Names"
            value={species.trade_names}
            suggestedBy={fieldSuggestedCredits.trade_names}
            className="sm:col-span-2 sm:mx-auto sm:w-[calc(50%-0.5rem)]"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <InfoCard
          label="Difficulty"
          value={species.difficulty}
          suggestedBy={fieldSuggestedCredits.difficulty}
        />
        <InfoCard
          label="Origin"
          value={species.origin}
          suggestedBy={fieldSuggestedCredits.origin}
        />
        <InfoCard
          label="Temperature"
          value={species.temperature}
          suggestedBy={fieldSuggestedCredits.temperature}
        />
        <InfoCard
          label="Humidity"
          value={species.humidity}
          suggestedBy={fieldSuggestedCredits.humidity}
        />
        <InfoCard
          label="Diet"
          value={species.diet}
          suggestedBy={fieldSuggestedCredits.diet}
        />
        <InfoCard
          label="Substrate"
          value={species.substrate}
          suggestedBy={fieldSuggestedCredits.substrate}
        />
      </div>
    </>
  );
}

function ChangeHistory({ changes }: { changes: SpeciesChangeHistoryItem[] }) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-black text-white">Change History</h2>
        <p className="mt-2 text-sm leading-6 text-emerald-50/60">
          Suggested edits are preserved here so contributors and reviewers stay
          credited as the species page improves.
        </p>
      </div>

      {changes.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-emerald-50/55">
          No suggested edits have been recorded for this species yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div>
            <table className="w-full table-fixed border-collapse text-left text-xs sm:text-sm">
              <colgroup>
                <col className="w-[19%]" />
                <col className="w-[16%]" />
                <col className="w-[15%]" />
                <col className="w-[16%]" />
                <col className="w-[13%]" />
                <col className="w-[21%]" />
              </colgroup>
              <thead className="bg-[#07130c] text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/50">
                <tr>
                  <th className="px-2 py-3 sm:px-3">Dates</th>
                  <th className="px-2 py-3 sm:px-3">Field</th>
                  <th className="px-2 py-3 sm:px-3">Original</th>
                  <th className="px-2 py-3 sm:px-3">Suggested Change</th>
                  <th className="px-2 py-3 sm:px-3">Status</th>
                  <th className="px-2 py-3 sm:px-3">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-black/20">
                {changes.map((change) => (
                  <tr key={change.id} className="align-top">
                    <td className="break-words px-2 py-4 text-emerald-50/65 sm:px-3">
                      <div className="font-bold text-white">
                        {formatDate(change.createdAt)}
                      </div>
                      <div className="mt-1 text-[11px] text-emerald-50/45">
                        Reviewed {formatDate(change.updatedAt)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-4 font-black text-emerald-100 sm:px-3">
                      {change.fieldLabel}
                    </td>
                    <td className="break-words px-2 py-4 text-emerald-50/70 sm:px-3">
                      <HistoryValue value={change.currentValue} fieldLabel={change.fieldLabel} />
                    </td>
                    <td className="break-words px-2 py-4 text-emerald-50/85 sm:px-3">
                      <HistoryValue value={change.proposedValue} fieldLabel={change.fieldLabel} />
                      <ChangeContext
                        editReason={change.editReason}
                        sourceInfo={change.sourceInfo}
                      />
                    </td>
                    <td className="px-2 py-4 sm:px-3">
                      <span className={statusClass(change.status)}>
                        {change.status}
                      </span>
                    </td>
                    <td className="px-2 py-4 text-xs leading-5 text-emerald-50/70 sm:px-3">
                      <div className="min-w-0">
                        <span className="block text-emerald-50/45">Suggested by</span>
                        <ProfileLink profile={change.suggestedProfile} />
                      </div>
                      {change.verifiedProfile && (
                        <div className="mt-2 min-w-0">
                          <span className="block text-emerald-50/45">Verified by</span>
                          <ProfileLink profile={change.verifiedProfile} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ChangeContext({
  editReason,
  sourceInfo,
}: {
  editReason: string | null;
  sourceInfo: string | null;
}) {
  if (!editReason && !sourceInfo) return null;

  return (
    <div className="mt-3 space-y-2 border-t border-white/10 pt-3 text-[11px] leading-4 text-emerald-50/55">
      {editReason && (
        <div>
          <span className="font-black uppercase tracking-[0.12em] text-emerald-100/45">
            Reason:
          </span>{" "}
          <span className="whitespace-pre-wrap break-words">{editReason}</span>
        </div>
      )}

      {sourceInfo && (
        <div>
          <span className="font-black uppercase tracking-[0.12em] text-emerald-100/45">
            Source:
          </span>{" "}
          <SourceInfo value={sourceInfo} />
        </div>
      )}
    </div>
  );
}

function InfoCard({
  label,
  value,
  suggestedBy = [],
  className = "",
}: {
  label: string;
  value: string | null;
  suggestedBy?: ContributorCredit[];
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-[#07130c]/70 p-4 ${className}`}>
      <p className="text-xs font-black uppercase tracking-widest text-emerald-100/40">
        {label}
      </p>

      <p className="mt-2 whitespace-pre-wrap text-base text-emerald-50/85">
        {value || "Not listed"}
      </p>

      {suggestedBy.length > 0 && (
        <p className="mt-3 text-[11px] leading-4 text-emerald-50/40">
          Suggested by <ContributorLinks credits={suggestedBy} compact />
        </p>
      )}
    </div>
  );
}

function ContributorLinks({
  credits,
  compact = false,
}: {
  credits: ContributorCredit[];
  compact?: boolean;
}) {
  return (
    <>
      {credits.map((credit, index) => {
        const name = contributorName(credit.profiles);
        const username = credit.profiles?.username;
        return (
          <span key={credit.id}>
            {index > 0 ? ", " : ""}
            {username ? (
              <Link
                href={`/profile/${username}`}
                className={
                  compact
                    ? "font-bold text-emerald-200/80 hover:text-emerald-100"
                    : "font-bold text-emerald-300 hover:text-emerald-200"
                }
              >
                @{username}
              </Link>
            ) : (
              name
            )}
          </span>
        );
      })}
    </>
  );
}

function ProfileLink({
  profile,
}: {
  profile: SpeciesChangeHistoryItem["suggestedProfile"];
}) {
  const name = contributorName(profile);

  if (!profile?.username) return <span>{name}</span>;

  return (
    <Link
      href={`/profile/${profile.username}`}
      className="whitespace-nowrap font-bold text-emerald-300 hover:text-emerald-200"
    >
      @{profile.username}
    </Link>
  );
}

function contributorName(profile: ContributorProfile | null) {
  return (
    profile?.display_name ||
    profile?.business_name ||
    profile?.username ||
    "Community contributor"
  );
}

function HistoryValue({
  value,
  fieldLabel,
}: {
  value: string;
  fieldLabel: string;
}) {
  if (!value) return <span className="text-emerald-50/35">Not listed</span>;

  const looksLikeUrl = /^https?:\/\//i.test(value);
  const isImageField = fieldLabel.toLowerCase().includes("image");

  if (looksLikeUrl) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold text-emerald-300 underline"
      >
        {isImageField ? "Uploaded image" : "Open value"}
      </a>
    );
  }

  return <span className="line-clamp-5 whitespace-pre-wrap break-words">{value}</span>;
}

function SourceInfo({ value }: { value: string }) {
  const looksLikeUrl = /^https?:\/\//i.test(value);

  if (!looksLikeUrl) {
    return <span className="whitespace-pre-wrap break-words">{value}</span>;
  }

  return (
    <a
      href={value}
      target="_blank"
      rel="noopener noreferrer"
      className="font-bold text-emerald-300 underline"
    >
      View source
    </a>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusClass(status: string) {
  const base = "inline-flex rounded-full px-2 py-1 text-[11px] font-black capitalize";
  if (status === "verified") return `${base} bg-emerald-400/15 text-emerald-200`;
  if (status === "rejected") return `${base} bg-red-400/15 text-red-200`;
  return `${base} bg-amber-300/15 text-amber-100`;
}
