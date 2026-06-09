"use client";

import { useMemo, useState } from "react";
import type { LegalDocument, LegalDocumentKey } from "@/lib/isopedia-legal";

export default function LegalDocumentViewer({
  documents,
  initialKey = "terms",
}: {
  documents: LegalDocument[];
  initialKey?: LegalDocumentKey;
}) {
  const [activeKey, setActiveKey] = useState<LegalDocumentKey>(initialKey);
  const activeDocument = useMemo(
    () => documents.find((document) => document.key === activeKey) || documents[0],
    [activeKey, documents]
  );

  return (
    <div className="rounded-3xl border border-white/10 bg-[#102016] p-4 shadow-2xl shadow-black/25 sm:p-6">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#07130c] p-2">
        {documents.map((document) => (
          <button
            key={document.key}
            type="button"
            onClick={() => setActiveKey(document.key)}
            className={`rounded-xl px-4 py-2 text-sm font-black transition ${
              activeKey === document.key
                ? "bg-emerald-400 text-slate-950"
                : "border border-white/10 bg-[#102016] text-white hover:bg-[#18291d]"
            }`}
          >
            {document.title}
          </button>
        ))}
      </div>

      <article className="mt-6">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">
          Version {activeDocument.version}
        </p>
        <h1 className="mt-2 text-3xl font-black text-white">
          {activeDocument.title}
        </h1>
        <p className="mt-2 text-sm font-bold text-emerald-50/50">
          Updated {activeDocument.updatedLabel}
        </p>

        <div className="mt-6 grid gap-5">
          {activeDocument.sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-white/10 bg-black/20 p-5"
            >
              <h2 className="text-xl font-black text-emerald-100">
                {section.title}
              </h2>
              <div className="mt-3 grid gap-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-emerald-50/75">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
