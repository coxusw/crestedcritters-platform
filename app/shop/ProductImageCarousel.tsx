"use client";

import { useMemo, useState } from "react";

export default function ProductImageCarousel({
  images,
  productName,
  compact = false,
}: {
  images: string[];
  productName: string;
  compact?: boolean;
}) {
  const cleanImages = useMemo(
    () => images.map((image) => image.trim()).filter(Boolean),
    [images]
  );
  const [activeIndex, setActiveIndex] = useState(0);

  if (cleanImages.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm font-bold text-[#a8b0b8]">
        No image
      </div>
    );
  }

  const activeImage = cleanImages[Math.min(activeIndex, cleanImages.length - 1)];

  function goPrevious() {
    setActiveIndex((current) => (current === 0 ? cleanImages.length - 1 : current - 1));
  }

  function goNext() {
    setActiveIndex((current) => (current === cleanImages.length - 1 ? 0 : current + 1));
  }

  const buttonClass = compact
    ? "absolute top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/55 text-sm font-black text-white shadow-lg transition hover:bg-black/75"
    : "absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/55 text-lg font-black text-white shadow-lg transition hover:bg-black/75";

  return (
    <div className="relative h-full w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={activeImage}
        alt={productName}
        className={`h-full w-full object-contain object-center ${compact ? "p-3" : "p-4"}`}
      />

      {cleanImages.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrevious}
            aria-label="Previous product image"
            className={`${buttonClass} ${compact ? "left-2" : "left-3"}`}
          >
            {"<"}
          </button>

          <button
            type="button"
            onClick={goNext}
            aria-label="Next product image"
            className={`${buttonClass} ${compact ? "right-2" : "right-3"}`}
          >
            {">"}
          </button>

          <div
            className={`absolute bottom-3 right-3 rounded-full border border-white/15 bg-black/60 px-3 py-1 font-black text-white ${
              compact ? "text-[10px]" : "text-xs"
            }`}
          >
            {activeIndex + 1} / {cleanImages.length}
          </div>
        </>
      )}
    </div>
  );
}
