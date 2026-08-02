"use client";

import Link from "next/link";
import { useState } from "react";
import { type CommunityCategory } from "@/lib/community";

export default function CommunityCategoryDropdown({
  categories,
}: {
  categories: CommunityCategory[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">
            Discussion Categories
          </p>
          <h2 className="mt-2 text-xl font-black text-white">
            Browse by category
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/60">
            Jump into the area that fits your post without scrolling through a
            stack of category cards.
          </p>
        </div>

        <div className="relative w-full lg:w-[420px]">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-emerald-400/25 bg-[#07130c] px-4 py-3 text-left font-black text-emerald-50 outline-none ring-emerald-400/30 hover:bg-emerald-400/10 focus:ring-4"
          >
            <span>Choose a discussion category</span>
            <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-emerald-100/70">
              {open ? "Close" : "Open"}
            </span>
          </button>

          {open && (
            <div className="absolute left-0 right-0 z-20 mt-2 max-h-[min(70vh,30rem)] overflow-y-auto rounded-lg border border-emerald-400/20 bg-[#07130c] p-2 shadow-2xl shadow-black/40">
              <div className="grid gap-1">
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/community/category/${category.slug}`}
                    onClick={() => setOpen(false)}
                    className="rounded-md border border-transparent p-3 hover:border-emerald-300/30 hover:bg-emerald-400/10"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.05] text-sm font-black text-emerald-200">
                        {category.icon || "Go"}
                      </span>
                      <div className="min-w-0">
                        <p className="font-black text-white">{category.name}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-emerald-50/55">
                          {category.description || "Browse this community category."}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
