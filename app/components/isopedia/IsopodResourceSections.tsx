import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { CommunityDiscussion } from "@/lib/community";
import type { ResourceSpecies } from "@/lib/isopod-resource-data";
import { publicSpeciesSlug } from "@/lib/isopedia-slugs";
import { DiscussionCard } from "@/app/community/CommunityCards";

export type FaqItem = {
  question: string;
  answer: string;
};

export function ResourceHero({
  kicker,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  imageUrl,
  imageAlt,
  visualNote,
}: {
  kicker: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  imageUrl: string | null;
  imageAlt: string;
  visualNote: string;
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
      <div className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_34%),#102016] p-6 shadow-2xl shadow-black/25 sm:p-9 lg:p-11">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
          {kicker}
        </p>
        <h1 className="mt-4 text-5xl font-black leading-none text-white sm:text-6xl lg:text-7xl">
          {title}
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-emerald-50/75 sm:text-lg">
          {description}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href={primaryHref}
            className="rounded-lg bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
          >
            {primaryLabel}
          </Link>
          <Link
            href={secondaryHref}
            className="rounded-lg border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
          >
            {secondaryLabel}
          </Link>
        </div>
      </div>

      <div className="relative min-h-72 overflow-hidden rounded-2xl border border-white/10 bg-[#0b140d] shadow-2xl shadow-black/25">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            sizes="(min-width: 1024px) 34vw, 100vw"
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full min-h-72 items-center justify-center p-7 text-center">
            <p className="text-sm font-bold leading-6 text-emerald-50/65">
              Verified Isopedia photos will appear here as the database grows.
            </p>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07130c] via-[#07130c]/80 to-transparent p-5">
          <p className="rounded-lg border border-emerald-400/20 bg-black/45 p-4 text-sm leading-6 text-emerald-50/78">
            {visualNote}
          </p>
        </div>
      </div>
    </section>
  );
}

export function ResourceBlock({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#102016] p-5 shadow-xl shadow-black/20 sm:p-7">
      <p className="text-xs font-black uppercase tracking-[0.26em] text-emerald-300">
        {kicker}
      </p>
      <h2 className="mt-3 text-3xl font-black leading-tight text-white">
        {title}
      </h2>
      <div className="mt-4 text-sm leading-7 text-emerald-50/75 sm:text-base">
        {children}
      </div>
    </section>
  );
}

export function SpeciesResourceGrid({ species }: { species: ResourceSpecies[] }) {
  if (!species.length) {
    return (
      <p className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm text-emerald-50/65">
        Verified isopod species will appear here as entries are added.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {species.map((entry) => (
        <Link
          key={entry.id}
          href={`/${publicSpeciesSlug(entry.slug)}`}
          className="group overflow-hidden rounded-2xl border border-white/10 bg-black/20 transition hover:-translate-y-1 hover:border-emerald-300/50 hover:bg-black/30"
        >
          <div className="relative flex h-40 items-center justify-center bg-[#08140d]">
            {entry.image_url ? (
              <Image
                src={entry.image_url}
                alt={entry.common_name}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover transition group-hover:scale-[1.03]"
              />
            ) : (
              <div className="mx-4 flex h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-emerald-400/20 text-center">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300/75">
                  Help grow the database
                </span>
                <span className="mt-2 text-sm font-black text-emerald-50/75">
                  Add a photo
                </span>
              </div>
            )}
          </div>
          <div className="p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge>{entry.organism_type || "Isopod"}</Badge>
              {entry.difficulty && <Badge tone="warm">{entry.difficulty}</Badge>}
            </div>
            <h3 className="text-xl font-black text-white">{entry.common_name}</h3>
            {entry.scientific_name && (
              <p className="mt-1 text-sm italic text-emerald-50/70">
                {entry.scientific_name}
              </p>
            )}
            <p className="mt-3 text-sm leading-6 text-emerald-50/65">
              {[entry.genus, entry.species, entry.morph].filter(Boolean).join(" ")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-emerald-50/70">
              {entry.temperature && (
                <span className="rounded-full bg-black/30 px-3 py-1">
                  {entry.temperature}
                </span>
              )}
              {entry.humidity && (
                <span className="rounded-full bg-black/30 px-3 py-1">
                  {entry.humidity}
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function SnapshotGrid({
  items,
}: {
  items: Array<{ title: string; body: string }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.title} className="rounded-xl border border-white/10 bg-black/20 p-4">
          <h3 className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">
            {item.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-emerald-50/70">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

export function FaqGrid({ faqs }: { faqs: FaqItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {faqs.map((item) => (
        <div key={item.question} className="rounded-xl border border-white/10 bg-black/20 p-4">
          <h3 className="text-sm font-black text-white">{item.question}</h3>
          <p className="mt-2 text-sm leading-6 text-emerald-50/70">{item.answer}</p>
        </div>
      ))}
    </div>
  );
}

export function SideCard({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="rounded-2xl border border-white/10 bg-[#102016] p-5 shadow-xl shadow-black/20">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">
        {kicker}
      </p>
      <h2 className="mt-3 text-xl font-black text-white">{title}</h2>
      <div className="mt-3 text-sm leading-7 text-emerald-50/72">{children}</div>
    </aside>
  );
}

export function DiscussionList({
  discussions,
  emptyText,
}: {
  discussions: CommunityDiscussion[];
  emptyText: string;
}) {
  if (!discussions.length) {
    return (
      <p className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm text-emerald-50/65">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {discussions.map((discussion) => (
        <DiscussionCard key={discussion.id} discussion={discussion} />
      ))}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "warm";
}) {
  return (
    <span
      className={
        tone === "warm"
          ? "rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200"
          : "rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200"
      }
    >
      {children}
    </span>
  );
}
