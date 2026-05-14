"use client";

import Link from "next/link";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Props = {
  speciesId: number;
  isLoggedIn: boolean;
  initialOwned: boolean;
  initialWishlist: boolean;
};

export default function CollectionButtons({
  speciesId,
  isLoggedIn,
  initialOwned,
  initialWishlist,
}: Props) {
  const [owned, setOwned] = useState(initialOwned);
  const [wishlist, setWishlist] = useState(initialWishlist);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  async function toggleStatus(status: "owned" | "wishlist") {
    setError("");
    setSaving(status);

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        setError("Supabase environment variables are missing.");
        setSaving("");
        return;
      }

      const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please log in first.");
        setSaving("");
        return;
      }

      const currentlyActive = status === "owned" ? owned : wishlist;

      if (currentlyActive) {
        const { error: deleteError } = await supabase
          .from("isopedia_user_species")
          .delete()
          .eq("user_id", user.id)
          .eq("species_id", speciesId)
          .eq("status", status);

        if (deleteError) {
          setError(deleteError.message);
          setSaving("");
          return;
        }

        if (status === "owned") setOwned(false);
        if (status === "wishlist") setWishlist(false);
      } else {
        const { error: insertError } = await supabase
          .from("isopedia_user_species")
          .insert({
            user_id: user.id,
            species_id: speciesId,
            status,
            is_public: true,
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          setError(insertError.message);
          setSaving("");
          return;
        }

        if (status === "owned") setOwned(true);
        if (status === "wishlist") setWishlist(true);
      }
    } catch {
      setError("Collection update failed. Please try again.");
    }

    setSaving("");
  }

  if (!isLoggedIn) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <p className="text-sm text-slate-300">
          Log in to add this species to your owned list or wishlist.
        </p>

        <Link
          href={`/login?next=${encodeURIComponent(
            typeof window !== "undefined" ? window.location.pathname : "/isopedia"
          )}`}
          className="mt-3 inline-flex rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
        >
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-300">
        My Collection
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => toggleStatus("owned")}
          disabled={saving.length > 0}
          className={
            owned
              ? "rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60"
              : "rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-slate-800 disabled:opacity-60"
          }
        >
          {saving === "owned" ? "Saving..." : owned ? "✓ Owned" : "+ Owned"}
        </button>

        <button
          type="button"
          onClick={() => toggleStatus("wishlist")}
          disabled={saving.length > 0}
          className={
            wishlist
              ? "rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-200 disabled:opacity-60"
              : "rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-slate-800 disabled:opacity-60"
          }
        >
          {saving === "wishlist"
            ? "Saving..."
            : wishlist
              ? "🎁 Wishlist"
              : "🎁 Add Wishlist"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-red-300">{error}</p>}
    </div>
  );
}