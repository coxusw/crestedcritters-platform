"use client";

import { useMemo, useState } from "react";
import type { ShopProduct } from "@/lib/shop";
import {
  formatProductPrice,
  formatShopMoney,
  normalizeProductOptions,
  productAvailableQuantity,
  productUnitPrice,
} from "@/lib/shop";

type CartLine = {
  productId: string;
  slug?: string;
  name?: string;
  optionId?: string;
  optionLabel?: string;
  quantity: number;
};

function isUnavailable(product: ShopProduct) {
  return product.sold_out || product.inventory <= 0;
}

function cartLineKey(productId: string, optionId?: string) {
  return `${productId}:${optionId || ""}`;
}

export default function ProductDetailClient({ product }: { product: ShopProduct }) {
  const productOptions = useMemo(() => normalizeProductOptions(product), [product]);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  const selectedOption = productOptions.find((option) => option.id === selectedOptionId) || null;
  const requiresOption = productOptions.length > 0;
  const availableQuantity = productAvailableQuantity(product, selectedOption);
  const unavailable = isUnavailable(product) || (requiresOption && selectedOption ? availableQuantity <= 0 : false);
  const canAdd = !unavailable && (!requiresOption || Boolean(selectedOption));
  const unitPrice = productUnitPrice(product, selectedOption);
  const safeQuantity = Math.max(1, Math.min(quantity, Math.max(1, availableQuantity)));

  function addToCart() {
    if (!canAdd) return;

    try {
      const saved = window.localStorage.getItem("crested-shop-cart");
      const current = saved ? (JSON.parse(saved) as CartLine[]) : [];
      const key = cartLineKey(product.id, selectedOption?.id);
      const existing = current.find((line) => cartLineKey(line.productId, line.optionId) === key);
      const next = existing
        ? current.map((line) =>
            cartLineKey(line.productId, line.optionId) === key
              ? {
                  ...line,
                  slug: product.slug,
                  name: product.name,
                  optionId: selectedOption?.id || "",
                  optionLabel: selectedOption?.label || "",
                  quantity: Math.min(availableQuantity, line.quantity + safeQuantity),
                }
              : line
          )
        : [
            ...current,
            {
              productId: product.id,
              slug: product.slug,
              name: product.name,
              optionId: selectedOption?.id || "",
              optionLabel: selectedOption?.label || "",
              quantity: safeQuantity,
            },
          ];

      window.localStorage.setItem("crested-shop-cart", JSON.stringify(next));
      setNotice(`${product.name} added to cart.`);
    } catch {
      setNotice("Could not update the cart. Please try again.");
    }
  }

  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#141618] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <p className="text-sm font-bold uppercase tracking-wide text-[#a8b0b8]">
        {formatProductPrice(product)}
      </p>

      <div className="mt-4 space-y-3">
        {productOptions.length > 0 && (
          <label className="block text-sm font-bold text-[#a8b0b8]">
            {product.option_name || "Option"}
            <select
              value={selectedOptionId}
              onChange={(event) => setSelectedOptionId(event.target.value)}
              className="mt-1 w-full rounded-md border border-white/[0.12] bg-[#101214] px-3 py-2 text-[#e9ecef] [color-scheme:dark]"
            >
              <option value="" className="bg-[#101214] text-[#e9ecef]">
                Choose {product.option_name?.toLowerCase() || "option"}
              </option>
              {productOptions.map((option) => {
                const optionPrice = productUnitPrice(product, option);
                const optionInventory = productAvailableQuantity(product, option);
                return (
                  <option key={option.id} value={option.id} className="bg-[#101214] text-[#e9ecef]">
                    {option.label}
                    {optionPrice !== product.price_cents ? ` - ${formatShopMoney(optionPrice)}` : ""}
                    {optionInventory <= 0 ? " - Sold out" : ""}
                  </option>
                );
              })}
            </select>
          </label>
        )}

        <label className="block text-sm font-bold text-[#a8b0b8]">
          Quantity
          <input
            type="number"
            min="1"
            max={Math.max(1, availableQuantity)}
            value={safeQuantity}
            onChange={(event) => setQuantity(Number(event.target.value) || 1)}
            className="mt-1 w-full rounded-md border border-white/[0.12] bg-black/20 px-3 py-2 text-white"
          />
        </label>

        <div className="rounded-md border border-white/[0.08] bg-[#101214] p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-[#a8b0b8]">Unit price</span>
            <span className="font-black text-[#d6c06f]">{formatShopMoney(unitPrice)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span className="text-[#a8b0b8]">Available</span>
            <span className="font-black text-[#e9ecef]">
              {isUnavailable(product) ? "Sold out" : availableQuantity}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={addToCart}
          disabled={!canAdd}
          className="inline-flex w-full items-center justify-center rounded-md bg-[#7fb069] px-4 py-3 text-sm font-black text-[#0b0d0b] transition hover:bg-[#92c37d] disabled:cursor-not-allowed disabled:border disabled:border-white/[0.08] disabled:bg-transparent disabled:text-[#a8b0b8]"
        >
          {unavailable ? "Sold Out" : requiresOption && !selectedOption ? `Choose ${product.option_name || "Option"}` : "Add to Cart"}
        </button>

        <a
          href="/cart"
          className="inline-flex w-full items-center justify-center rounded-md border border-white/[0.1] px-4 py-3 text-sm font-black text-[#e9ecef] transition hover:border-[#d6c06f]/35 hover:bg-white/[0.04]"
        >
          View Cart
        </a>

        {notice && (
          <p className="rounded-md border border-[#7fb069]/30 bg-[#7fb069]/10 p-3 text-sm font-bold text-[#d8f2cf]">
            {notice}
          </p>
        )}
      </div>
    </div>
  );
}
