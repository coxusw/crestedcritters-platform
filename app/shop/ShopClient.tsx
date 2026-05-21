"use client";

import { useEffect, useMemo, useState } from "react";
import type { ShopProduct } from "@/lib/shop";
import { formatShopMoney } from "@/lib/shop";

type CartLine = {
  productId: string;
  quantity: number;
};

type CheckoutPayload = {
  checkoutUrl?: string;
  error?: string;
};

function isUnavailable(product: ShopProduct) {
  return product.sold_out || product.inventory <= 0;
}

export default function ShopClient({ products }: { products: ShopProduct[] }) {
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((product) => product.category))).sort()],
    [products]
  );
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("crested-shop-cart");
      if (saved) setCart(JSON.parse(saved) as CartLine[]);
    } catch {
      setCart([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("crested-shop-cart", JSON.stringify(cart));
  }, [cart]);

  const visibleProducts = useMemo(() => {
    return products.filter((product) => category === "All" || product.category === category);
  }, [category, products]);

  const cartProducts = useMemo(() => {
    return cart
      .map((line) => {
        const product = products.find((item) => item.id === line.productId);
        if (!product) return null;
        const quantity = Math.min(line.quantity, Math.max(0, product.inventory));
        return { product, quantity };
      })
      .filter((line): line is { product: ShopProduct; quantity: number } => Boolean(line && line.quantity > 0));
  }, [cart, products]);

  const subtotalCents = cartProducts.reduce(
    (total, line) => total + line.product.price_cents * line.quantity,
    0
  );
  const shippingCents = cartProducts.reduce(
    (total, line) => total + line.product.shipping_cents * line.quantity,
    0
  );

  function addToCart(product: ShopProduct) {
    setError("");
    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        return current.map((line) =>
          line.productId === product.id
            ? { ...line, quantity: Math.min(product.inventory, line.quantity + 1) }
            : line
        );
      }
      return [...current, { productId: product.id, quantity: 1 }];
    });
  }

  function updateQuantity(product: ShopProduct, quantity: number) {
    setCart((current) => {
      if (quantity <= 0) return current.filter((line) => line.productId !== product.id);
      return current.map((line) =>
        line.productId === product.id
          ? { ...line, quantity: Math.min(product.inventory, quantity) }
          : line
      );
    });
  }

  async function checkout() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: email,
          items: cartProducts.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
          })),
        }),
      });
      const payload = (await response.json()) as CheckoutPayload;

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || "Could not start checkout.");
      }

      window.localStorage.removeItem("crested-shop-cart");
      window.location.href = payload.checkoutUrl;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        <div className="flex gap-2 overflow-x-auto border-b border-[#172018]/10 pb-3">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`shrink-0 rounded-md px-4 py-2 text-sm font-black transition ${
                category === item
                  ? "bg-[#172018] text-white"
                  : "border border-[#172018]/15 bg-white text-[#314638] hover:border-[#47715b]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {products.length === 0 ? (
          <div className="rounded-lg border border-[#172018]/15 bg-white p-6 text-[#405545]">
            No shop products are active yet. Add products from the shop admin panel.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleProducts.map((product) => (
              <article
                key={product.id}
                className="flex min-h-[430px] flex-col overflow-hidden rounded-lg border border-[#172018]/12 bg-white shadow-sm"
              >
                <div className="relative aspect-[4/3] bg-[#e5ddce]">
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm font-bold text-[#657564]">
                      No image
                    </div>
                  )}
                  {isUnavailable(product) ? (
                    <span className="absolute left-3 top-3 rounded-md bg-[#5f1f1f] px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
                      Sold Out
                    </span>
                  ) : product.inventory <= 4 ? (
                    <span className="absolute left-3 top-3 rounded-md bg-[#c77f1b] px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
                      Low stock: {product.inventory}
                    </span>
                  ) : (
                    <span className="absolute left-3 top-3 rounded-md bg-[#2f6e4d] px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
                      {product.inventory} in stock
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#628065]">
                        {product.category}
                      </p>
                      <h2 className="mt-1 text-xl font-black leading-tight">{product.name}</h2>
                    </div>
                    <div className="text-lg font-black">{formatShopMoney(product.price_cents)}</div>
                  </div>

                  <p className="mt-3 flex-1 text-sm leading-6 text-[#526355]">
                    {product.description || "Product details coming soon."}
                  </p>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#657564]">
                      {product.shipping_mode === "contact"
                        ? "Shipping coordinated"
                        : product.shipping_cents > 0
                          ? `${formatShopMoney(product.shipping_cents)} shipping`
                          : "Shipping set at checkout"}
                    </p>
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      disabled={isUnavailable(product)}
                      className="rounded-md bg-[#22c58b] px-4 py-2 text-sm font-black text-[#07130c] transition hover:bg-[#31dda0] disabled:cursor-not-allowed disabled:bg-[#aab4aa] disabled:text-[#536153]"
                    >
                      {isUnavailable(product) ? "Sold Out" : "Add"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className="h-fit rounded-lg border border-[#172018]/15 bg-[#172018] p-4 text-white shadow-xl lg:sticky lg:top-5">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8be0ba]">
              Cart
            </p>
            <h2 className="text-2xl font-black">{cartProducts.length} item{cartProducts.length === 1 ? "" : "s"}</h2>
          </div>
          {cartProducts.length > 0 && (
            <button
              type="button"
              onClick={() => setCart([])}
              className="rounded-md border border-white/15 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/10"
            >
              Clear
            </button>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {cartProducts.length === 0 ? (
            <p className="rounded-md bg-white/8 p-4 text-sm leading-6 text-white/70">
              Add products to build a Square checkout with multiple items.
            </p>
          ) : (
            cartProducts.map(({ product, quantity }) => (
              <div key={product.id} className="rounded-md bg-white/8 p-3">
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-black">{product.name}</h3>
                    <p className="mt-1 text-sm text-white/60">
                      {formatShopMoney(product.price_cents)} each
                    </p>
                  </div>
                  <div className="font-black">
                    {formatShopMoney(product.price_cents * quantity)}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateQuantity(product, quantity - 1)}
                    className="h-9 w-9 rounded-md border border-white/15 font-black hover:bg-white/10"
                  >
                    -
                  </button>
                  <input
                    aria-label={`${product.name} quantity`}
                    value={quantity}
                    onChange={(event) => updateQuantity(product, Number(event.target.value))}
                    className="h-9 w-16 rounded-md border border-white/15 bg-black/20 text-center font-black text-white"
                  />
                  <button
                    type="button"
                    onClick={() => updateQuantity(product, quantity + 1)}
                    className="h-9 w-9 rounded-md border border-white/15 font-black hover:bg-white/10"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => updateQuantity(product, 0)}
                    className="ml-auto rounded-md px-2 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-white/60">Subtotal</span>
            <span className="font-black">{formatShopMoney(subtotalCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Shipping</span>
            <span className="font-black">
              {shippingCents > 0 ? formatShopMoney(shippingCents) : "Handled in order notes"}
            </span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-3 text-lg">
            <span className="font-black">Total</span>
            <span className="font-black">{formatShopMoney(subtotalCents + shippingCents)}</span>
          </div>
        </div>

        <label className="mt-4 block text-sm font-bold text-white/70">
          Email for order updates
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="mt-2 w-full rounded-md border border-white/15 bg-black/20 px-3 py-3 text-white placeholder:text-white/35"
          />
        </label>

        {error && (
          <p className="mt-3 rounded-md border border-red-300/30 bg-red-500/15 p-3 text-sm text-red-100">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={checkout}
          disabled={busy || cartProducts.length === 0}
          className="mt-4 w-full rounded-md bg-[#22c58b] px-5 py-3 font-black text-[#07130c] transition hover:bg-[#31dda0] disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/45"
        >
          {busy ? "Opening Square..." : "Checkout with Square"}
        </button>
      </aside>
    </div>
  );
}
