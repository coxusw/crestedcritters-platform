"use client";

import Link from "next/link";
import { useState } from "react";

export type SpeciesChangeHistoryItem = {
  id: string;
  fieldLabel: string;
  currentValue: string;
  proposedValue: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  suggestedProfile: {
    username: string | null;
    display_name: string | null;
    business_name: string | null;
  } | null;
  verifiedProfile: {
    username: string | null;
    display_name: string | null;
    business_name: string | null;
  } | null;
};

export default function SpeciesHistoryTabs({
  canonicalSlug,
  safeNotesHtml,
  changes,
}: {
  canonicalSlug: string;
  safeNotesHtml: string;
  changes: SpeciesChangeHistoryItem[];
}) {
  const [activeTab, setActiveTab] = useState<"care" | "history">("care");

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-[#102016] p-3 shadow-xl shadow-black/20 sm:p-4">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#07130c] p-2">
        <button
          type="button"
          onClick={() => setActiveTab("care")}
          className={`rounded-xl px-4 py-2 text-sm font-black transition ${
            activeTab === "care"
              ? "bg-emerald-400 text-slate-950"
              : "border border-white/10 bg-[#102016] text-white hover:bg-[#18291d]"
          }`}
        >
          Care Notes
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`rounded-xl px-4 py-2 text-sm font-black transition ${
            activeTab === "history"
              ? "bg-emerald-400 text-slate-950"
              : "border border-white/10 bg-[#102016] text-white hover:bg-[#18291d]"
          }`}
        >
          Change History
        </button>
      </div>

      <div className="p-3 sm:p-4">
        {activeTab === "care" ? (
          <CareNotes canonicalSlug={canonicalSlug} safeNotesHtml={safeNotesHtml} />
        ) : (
          <ChangeHistory changes={changes} />
        )}
      </div>
    </section>
  );
}

function CareNotes({
  canonicalSlug,
  safeNotesHtml,
}: {
  canonicalSlug: string;
  safeNotesHtml: string;
}) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-black text-white">Care Notes</h2>
        <Link
          href={`/${canonicalSlug}/suggest-edit`}
          className="text-sm font-bold text-emerald-300 hover:text-emerald-200"
        >
          Suggest an improvement
        </Link>
      </div>

      {safeNotesHtml ? (
        <div
          className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-emerald-50/75 prose-a:text-emerald-300 prose-strong:text-white prose-li:text-emerald-50/75"
          dangerouslySetInnerHTML={{ __html: safeNotesHtml }}
        />
      ) : (
        <p className="text-emerald-50/55">No care notes have been added yet.</p>
      )}
    </div>
  );
}

function ChangeHistory({ changes }: { changes: SpeciesChangeHistoryItem[] }) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-black text-white">Change History</h2>
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
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full border-collapse text-left text-sm">
              <thead className="bg-[#07130c] text-xs font-black uppercase tracking-[0.16em] text-emerald-100/50">
                <tr>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Field</th>
                  <th className="px-4 py-3">Original</th>
                  <th className="px-4 py-3">Suggested Change</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-black/20">
                {changes.map((change) => (
                  <tr key={change.id} className="align-top">
                    <td className="px-4 py-4 text-emerald-50/65">
                      <div className="font-bold text-white">{formatDate(change.createdAt)}</div>
                      <div className="mt-1 text-xs text-emerald-50/45">
                        Reviewed {formatDate(change.updatedAt)}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-black text-emerald-100">
                      {change.fieldLabel}
                    </td>
                    <td className="px-4 py-4 text-emerald-50/70">
                      <HistoryValue value={change.currentValue} />
                    </td>
                    <td className="px-4 py-4 text-emerald-50/85">
                      <HistoryValue value={change.proposedValue} />
                    </td>
                    <td className="px-4 py-4">
                      <span className={statusClass(change.status)}>{change.status}</span>
                    </td>
                    <td className="px-4 py-4 text-emerald-50/70">
                      <div>
                        <span className="text-emerald-50/45">Suggested by </span>
                        <ProfileLink profile={change.suggestedProfile} />
                      </div>
                      {change.verifiedProfile && (
                        <div className="mt-2">
                          <span className="text-emerald-50/45">Verified by </span>
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

function ProfileLink({
  profile,
}: {
  profile: SpeciesChangeHistoryItem["suggestedProfile"];
}) {
  const name =
    profile?.display_name ||
    profile?.business_name ||
    profile?.username ||
    "Community contributor";

  if (!profile?.username) return <span>{name}</span>;

  return (
    <Link href={`/profile/${profile.username}`} className="font-bold text-emerald-300 hover:text-emerald-200">
      @{profile.username}
    </Link>
  );
}

function HistoryValue({ value }: { value: string }) {
  if (!value) return <span className="text-emerald-50/35">Not listed</span>;

  const looksLikeUrl = /^https?:\/\//i.test(value);

  if (looksLikeUrl) {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-300 underline">
        Open value
      </a>
    );
  }

  return <span className="line-clamp-5 whitespace-pre-wrap break-words">{value}</span>;
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
  const base = "inline-flex rounded-full px-3 py-1 text-xs font-black capitalize";
  if (status === "verified") return `${base} bg-emerald-400/15 text-emerald-200`;
  if (status === "rejected") return `${base} bg-red-400/15 text-red-200`;
  return `${base} bg-amber-300/15 text-amber-100`;
}
