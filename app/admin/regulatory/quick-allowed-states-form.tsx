"use client";

import { useMemo, useState } from "react";
import { saveQuickAllowedStatesAction } from "./actions";

type ProductOption = {
  id: string;
  label: string;
  mappingStatus: string | null;
  allowedStates: string[];
};

type StateOption = {
  code: string;
  name: string;
};

export function QuickAllowedStatesForm({
  products,
  states,
}: {
  products: ProductOption[];
  states: StateOption[];
}) {
  const [productId, setProductId] = useState(products[0]?.id || "");
  const selectedProduct = products.find((product) => product.id === productId) || null;
  const initialAllowed = useMemo(
    () => new Set(selectedProduct?.allowedStates || []),
    [selectedProduct]
  );
  const [checkedStates, setCheckedStates] = useState<Set<string>>(initialAllowed);

  function chooseProduct(nextProductId: string) {
    const nextProduct = products.find((product) => product.id === nextProductId) || null;
    setProductId(nextProductId);
    setCheckedStates(new Set(nextProduct?.allowedStates || []));
  }

  function toggleState(code: string) {
    setCheckedStates((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <form action={saveQuickAllowedStatesAction} className="grid gap-5">
      <label className="grid gap-2 text-sm font-bold text-slate-200">
        Live shop item
        <select
          name="product_id"
          value={productId}
          onChange={(event) => chooseProduct(event.target.value)}
          required
          className="rounded-md border border-white/10 bg-black/20 px-3 py-3 text-white [color-scheme:dark]"
        >
          {products.length === 0 && <option value="">No verified live products yet</option>}
          {products.map((product) => (
            <option key={product.id} value={product.id} className="bg-[#111827] text-white">
              {product.label}
            </option>
          ))}
        </select>
      </label>

      {selectedProduct?.mappingStatus !== "verified" && (
        <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm font-bold text-amber-100">
          This item needs a verified taxon mapping before the quick state list can make it shippable.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-100">
          Allowed states: {checkedStates.size}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCheckedStates(new Set(states.map((state) => state.code)))}
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={() => setCheckedStates(new Set())}
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {states.map((state) => {
          const checked = checkedStates.has(state.code);
          return (
            <label
              key={state.code}
              className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm font-bold ${
                checked
                  ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-50"
                  : "border-white/10 bg-black/20 text-slate-300"
              }`}
            >
              <input
                type="checkbox"
                name="allowed_states"
                value={state.code}
                checked={checked}
                onChange={() => toggleState(state.code)}
              />
              <span>{state.name}</span>
            </label>
          );
        })}
      </div>

      <button
        className="rounded-md bg-emerald-300 px-4 py-3 text-sm font-black text-slate-950 hover:bg-emerald-200"
        disabled={!productId}
      >
        Save Allowed States
      </button>
    </form>
  );
}
