"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

export type SpeciesCarouselImage = {
  id: string;
  imageUrl: string;
  alt: string;
  caption?: string | null;
  creditName?: string | null;
  isPrimary?: boolean;
};

export default function SpeciesImageCarousel({
  images,
  speciesName,
}: {
  images: SpeciesCarouselImage[];
  speciesName: string;
}) {
  const cleanImages = useMemo(
    () => images.filter((image) => Boolean(image.imageUrl)),
    [images]
  );

  const [activeIndex, setActiveIndex] = useState(0);

  if (cleanImages.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-black/20">
        <div className="px-6 text-center text-sm text-emerald-50/45">
          No image has been added yet.
        </div>
      </div>
    );
  }

  const activeImage = cleanImages[Math.min(activeIndex, cleanImages.length - 1)];

  function goPrevious() {
    setActiveIndex((current) =>
      current === 0 ? cleanImages.length - 1 : current - 1
    );
  }

  function goNext() {
    setActiveIndex((current) =>
      current === cleanImages.length - 1 ? 0 : current + 1
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-black/20">
        <Image
          src={activeImage.imageUrl}
          alt={activeImage.alt || speciesName}
          fill
          priority={activeImage.isPrimary}
          sizes="(min-width: 1024px) 420px, 100vw"
          className="object-contain"
        />
        <span className="pointer-events-none absolute right-3 top-3 z-10 select-none text-sm font-black text-white/75 [text-shadow:0_1px_2px_rgba(0,0,0,0.85),0_0_7px_rgba(0,0,0,0.5)]">
          Isopedia
        </span>

        {cleanImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrevious}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/55 text-2xl font-black text-white shadow-lg transition hover:bg-black/75"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={goNext}
              aria-label="Next image"
              className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/55 text-2xl font-black text-white shadow-lg transition hover:bg-black/75"
            >
              ›
            </button>

            <div className="absolute bottom-3 right-3 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs font-black text-white">
              {activeIndex + 1} / {cleanImages.length}
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#102016] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-300">
              {activeImage.isPrimary ? "Primary Image" : "Gallery Image"}
            </p>

            <p className="mt-2 text-sm leading-6 text-emerald-50/75">
              {activeImage.caption || "No caption provided."}
            </p>
          </div>

          {activeImage.creditName && (
            <p className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-200">
              Credit: {activeImage.creditName}
            </p>
          )}
        </div>
      </div>

      {cleanImages.length > 1 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {cleanImages.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`relative overflow-hidden rounded-xl border p-1 transition ${
                index === activeIndex
                  ? "border-emerald-300 bg-emerald-300/10"
                  : "border-white/10 bg-black/20 hover:border-emerald-300/40"
              }`}
              aria-label={`View image ${index + 1}`}
            >
              <Image
                src={image.imageUrl}
                alt={image.alt || speciesName}
                width={96}
                height={96}
                sizes="96px"
                className="aspect-square w-full object-cover"
              />
              <span className="pointer-events-none absolute right-1.5 top-1.5 z-10 select-none text-[11px] font-black leading-none text-white/75 [text-shadow:0_1px_2px_rgba(0,0,0,0.85)]">
                Isopedia
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
