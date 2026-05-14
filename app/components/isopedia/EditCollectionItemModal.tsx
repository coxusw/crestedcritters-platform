"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Props = {
  itemId: string;
  initialQuantity: string | null;
  initialPrice: string | null;
  initialPriceIsNa: boolean;
  initialNotes: string | null;
  initialPublic: boolean;
  initialFavorite: boolean;
  initialMostWanted: boolean;
};

export default function EditCollectionItemModal({
  itemId,
  initialQuantity,
  initialPrice,
  initialPriceIsNa,
  initialNotes,
  initialPublic,
  initialFavorite,
  initialMostWanted,
}: Props) {
  const [open, setOpen] = useState(false);

  const [quantity, setQuantity] = useState(initialQuantity || "");
  const [price, setPrice] = useState(initialPrice || "");
  const [priceIsNa, setPriceIsNa] = useState(initialPriceIsNa);
  const [notes, setNotes] = useState(initialNotes || "");
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [isMostWanted, setIsMostWanted] = useState(initialMostWanted);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveChanges() {
    setSaving(true);
    setError("");

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase
        .from("isopedia_user_species")
        .update({
          quantity: quantity.trim() || null,
          price: priceIsNa ? null : price.trim() || null,
          price_is_na: priceIsNa,
          notes: notes.trim() || null,
          is_public: isPublic,
          is_favorite: isFavorite,
          is_most_wanted: isMostWanted,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }

      window.location.reload();
    } catch {
      setError("Failed to save collection item.");
    }

    setSaving(false);
  }

  async function removeItem() {
    const confirmed = window.confirm(
      "Remove this species from your collection?"
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase
        .from("isopedia_user_species")
        .delete()
        .eq("id", itemId);

      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }

      window.location.reload();
    } catch {
      setError("Failed to remove item.");
    }

    setSaving(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-white/10 bg-black/25 px-4 py-2 text-sm font-bold text-white transition hover:bg-black/40"
      >
        Edit Collection
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
          <div className="my-8 w-full max-w-lg rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-2xl shadow-black/40">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
                  Collection Item
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  Edit Details
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm font-bold text-white hover:bg-black/40"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-100/50">
                  Quantity
                </span>

                <input
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="Example: 10 count, starter colony, 2 bins"
                  className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
                />
              </label>

              <div className="grid gap-3">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-100/50">
                    Price
                  </span>

                  <input
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    disabled={priceIsNa}
                    placeholder="Example: $25 / 10 count"
                    className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40 disabled:opacity-50"
                  />
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b140d] p-4">
                  <input
                    type="checkbox"
                    checked={priceIsNa}
                    onChange={(event) => setPriceIsNa(event.target.checked)}
                    className="h-4 w-4"
                  />

                  <span className="text-sm font-semibold text-emerald-50/80">
                    Price is not available / not for sale
                  </span>
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-100/50">
                  Notes
                </span>

                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Private or public notes about this species..."
                  className="min-h-[120px] rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
                />
              </label>

              <div className="grid gap-3">
                <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#0b140d] p-4">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(event) => setIsPublic(event.target.checked)}
                    className="mt-1 h-4 w-4"
                  />

                  <span>
                    <span className="block text-sm font-bold text-white">
                      Public
                    </span>

                    <span className="mt-1 block text-sm text-emerald-50/55">
                      Show this item on your public collection page.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4">
                  <input
                    type="checkbox"
                    checked={isFavorite}
                    onChange={(event) => setIsFavorite(event.target.checked)}
                    className="mt-1 h-4 w-4"
                  />

                  <span>
                    <span className="block text-sm font-bold text-rose-100">
                      Favorite Species
                    </span>

                    <span className="mt-1 block text-sm text-rose-50/65">
                      Highlight this as one of your favorites.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                  <input
                    type="checkbox"
                    checked={isMostWanted}
                    onChange={(event) => setIsMostWanted(event.target.checked)}
                    className="mt-1 h-4 w-4"
                  />

                  <span>
                    <span className="block text-sm font-bold text-amber-100">
                      Most Wanted
                    </span>

                    <span className="mt-1 block text-sm text-amber-50/65">
                      Highlight this as a high-priority wishlist species.
                    </span>
                  </span>
                </label>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div className="flex flex-wrap justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={removeItem}
                  disabled={saving}
                  className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-3 text-sm font-black text-red-200 transition hover:bg-red-400/20 disabled:opacity-50"
                >
                  Remove
                </button>

                <button
                  type="button"
                  onClick={saveChanges}
                  disabled={saving}
                  className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}