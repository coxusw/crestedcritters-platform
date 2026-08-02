"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const MAX_COMMUNITY_IMAGE_FILES = 5;
const ACCEPTED_COMMUNITY_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";

type ImageSlot = {
  id: string;
  fileName: string;
  caption: string;
  previewUrl: string;
};

function createSlot(): ImageSlot {
  return {
    id: crypto.randomUUID(),
    fileName: "",
    caption: "",
    previewUrl: "",
  };
}

export default function CommunityImageUploadFields({
  label = "Images",
  helperText = "Add up to 5 JPG, PNG, WEBP, or GIF images. Each image must be under 10MB.",
  maxFiles = MAX_COMMUNITY_IMAGE_FILES,
}: {
  label?: string;
  helperText?: string;
  maxFiles?: number;
}) {
  const [slots, setSlots] = useState<ImageSlot[]>(() => [createSlot()]);
  const slotsRef = useRef(slots);

  const activeSlots = slots.filter((slot) => Boolean(slot.fileName));
  const lastSlot = slots[slots.length - 1];
  const canAddSlot =
    slots.length < maxFiles &&
    Boolean(lastSlot?.fileName && lastSlot.caption.trim());
  const captionPayload = useMemo(
    () => activeSlots.map((slot) => slot.caption.trim()).join("\n"),
    [activeSlots]
  );

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(() => {
    return () => {
      for (const slot of slotsRef.current) {
        if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
      }
    };
  }, []);

  function updateSlot(slotId: string, next: Partial<ImageSlot>) {
    setSlots((current) =>
      current.map((slot) => {
        if (slot.id !== slotId) return slot;
        if (next.previewUrl && slot.previewUrl && slot.previewUrl !== next.previewUrl) {
          URL.revokeObjectURL(slot.previewUrl);
        }
        return { ...slot, ...next };
      })
    );
  }

  function removeSlot(slotId: string) {
    setSlots((current) => {
      const slotToRemove = current.find((slot) => slot.id === slotId);
      if (slotToRemove?.previewUrl) URL.revokeObjectURL(slotToRemove.previewUrl);

      const nextSlots = current.filter((slot) => slot.id !== slotId);
      return nextSlots.length ? nextSlots : [createSlot()];
    });
  }

  return (
    <fieldset className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <legend className="px-2 text-sm font-black text-emerald-50/80">
        {label}
      </legend>

      <input type="hidden" name="new_image_captions" value={captionPayload} readOnly />

      <p className="text-xs leading-5 text-emerald-50/45">{helperText}</p>

      <div className="grid gap-3">
        {slots.map((slot, index) => (
          <div
            key={slot.id}
            className="grid gap-3 rounded-lg border border-white/10 bg-[#07130c] p-3 sm:grid-cols-[140px_1fr]"
          >
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-emerald-50/55">
                  Photo {index + 1}
                </span>
                {slots.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSlot(slot.id)}
                    className="rounded-md border border-red-300/20 px-2 py-1 text-[11px] font-black text-red-100 hover:bg-red-400/10"
                  >
                    Remove
                  </button>
                )}
              </div>

              <label className="grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-lg border border-dashed border-emerald-300/25 bg-black/20 text-center text-xs font-bold text-emerald-50/50 hover:border-emerald-300/45 hover:bg-emerald-300/5">
                {slot.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slot.previewUrl}
                    alt={slot.fileName || `Selected community upload ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="px-3">Select photo</span>
                )}
                <input
                  name="image_files"
                  type="file"
                  accept={ACCEPTED_COMMUNITY_IMAGE_TYPES}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    updateSlot(slot.id, {
                      fileName: file?.name || "",
                      previewUrl: file ? URL.createObjectURL(file) : "",
                    });
                  }}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="grid content-start gap-2">
              <label className="grid gap-2">
                <span className="text-sm font-black text-emerald-50/80">
                  Caption for photo {index + 1}
                </span>
                <input
                  value={slot.caption}
                  onChange={(event) => updateSlot(slot.id, { caption: event.target.value })}
                  required={Boolean(slot.fileName)}
                  disabled={!slot.fileName}
                  maxLength={180}
                  className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none ring-emerald-400/30 placeholder:text-emerald-50/30 focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder={
                    slot.fileName
                      ? "Required caption for this photo"
                      : "Select a photo first"
                  }
                />
              </label>

              <p className="min-h-5 truncate text-xs text-emerald-50/45">
                {slot.fileName || "No photo selected yet."}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {slots.length < maxFiles && (
          <button
            type="button"
            onClick={() => setSlots((current) => [...current, createSlot()])}
            disabled={!canAddSlot}
            className="rounded-lg border border-emerald-400/25 px-4 py-2 text-sm font-black text-emerald-100 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Add another photo
          </button>
        )}

        <span className="text-xs text-emerald-50/45">
          {activeSlots.length} of {maxFiles} photos selected
        </span>
      </div>
    </fieldset>
  );
}
