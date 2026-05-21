"use client";

import { useEffect, useMemo, useState } from "react";
import type { ShopProduct } from "@/lib/shop";
import { formatShopMoney } from "@/lib/shop";

type CartLine = {
  productId: string;
  slug?: string;
  name?: string;
  quantity: number;
};

type CheckoutPayload = {
  checkoutUrl?: string;
  error?: string;
};

function isUnavailable(product: ShopProduct) {
  return product.sold_out || product.inventory <= 0;
}

export default function ShopClient({
  products,
  view = "shop",
}: {
  products: ShopProduct[];
  view?: "shop" | "cart";
}) {
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
        const product = products.find(
          (item) => item.id === line.productId || (line.slug && item.slug === line.slug)
        );
        if (!product) return null;
        const quantity = Math.min(line.quantity, Math.max(0, product.inventory));
        return { product, quantity };
      })
      .filter((line): line is { product: ShopProduct; quantity: number } => Boolean(line && line.quantity > 0));
  }, [cart, products]);

  const itemCount = cartProducts.reduce((total, line) => total + line.quantity, 0);
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
            ? {
                ...line,
                slug: product.slug,
                name: product.name,
                quantity: Math.min(product.inventory, line.quantity + 1),
              }
            : line
        );
      }
      return [
        ...current,
        { productId: product.id, slug: product.slug, name: product.name, quantity: 1 },
      ];
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
            slug: line.product.slug,
            name: line.product.name,
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

  if (view === "cart") {
    return (
      <CartPage
        cartProducts={cartProducts}
        email={email}
        setEmail={setEmail}
        busy={busy}
        error={error}
        subtotalCents={subtotalCents}
        shippingCents={shippingCents}
        updateQuantity={updateQuantity}
        clearCart={() => setCart([])}
        checkout={checkout}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-white/[0.08] bg-[#141618] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-[#e9ecef]">
            {itemCount} item{itemCount === 1 ? "" : "s"} in cart
          </p>
          <p className="mt-1 text-sm text-[#a8b0b8]">
            Total so far: <span className="font-black text-[#d6c06f]">{formatShopMoney(subtotalCents + shippingCents)}</span>
          </p>
        </div>
        <a
          href="/cart"
          className="inline-flex items-center justify-center rounded-md bg-[#7fb069] px-5 py-3 text-sm font-black text-[#0b0d0b] transition hover:bg-[#92c37d]"
        >
          View Cart
        </a>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`rounded-full px-4 py-2 text-sm font-black transition ${
                category === item
                  ? "border border-[#7fb069]/40 bg-[#7fb069]/20 text-[#e9ecef]"
                  : "border border-white/[0.08] bg-[#141618] text-[#a8b0b8] hover:border-white/20 hover:text-[#e9ecef]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {products.length === 0 ? (
          <div className="rounded-lg border border-white/[0.08] bg-[#141618] p-6 text-[#a8b0b8]">
            No shop products are active yet. Add products from the shop admin panel.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} addToCart={addToCart} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProductCard({
  product,
  addToCart,
}: {
  product: ShopProduct;
  addToCart: (product: ShopProduct) => void;
}) {
  return (
    <article className="flex min-h-[430px] flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-[#141618] shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition hover:-translate-y-1 hover:border-[#d6c06f]/30">
      <div className="relative aspect-[4/3] bg-[#101214]">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-bold text-[#a8b0b8]">
            No image
          </div>
        )}
        {isUnavailable(product) ? (
          <span className="absolute bottom-3 left-3 rounded-full border border-white/15 bg-red-900/35 px-3 py-1 text-xs font-black text-white backdrop-blur">
            Sold Out
          </span>
        ) : product.inventory <= 4 ? (
          <span className="absolute bottom-3 left-3 rounded-full border border-[#d6c06f]/40 bg-[#d6c06f]/20 px-3 py-1 text-xs font-black text-[#e9ecef] backdrop-blur">
            Low stock: {product.inventory}
          </span>
        ) : (
          <span className="absolute bottom-3 left-3 rounded-full border border-white/15 bg-[#7fb069]/20 px-3 py-1 text-xs font-black text-[#e9ecef] backdrop-blur">
            {product.inventory} in stock
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[#a8b0b8]">{product.category}</p>
            <h2 className="mt-1 text-lg font-black leading-tight text-[#e9ecef]">{product.name}</h2>
          </div>
          <div className="text-lg font-black text-[#d6c06f]">{formatShopMoney(product.price_cents)}</div>
        </div>

        <p className="mt-3 flex-1 text-sm leading-6 text-[#a8b0b8]">
          {product.description || "Product details coming soon."}
        </p>

        <div className="mt-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[#a8b0b8]">
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
            className="inline-flex w-full items-center justify-center rounded-md bg-[#7fb069] px-4 py-3 text-sm font-black text-[#0b0d0b] transition hover:bg-[#92c37d] disabled:cursor-not-allowed disabled:border disabled:border-white/[0.08] disabled:bg-transparent disabled:text-[#a8b0b8]"
          >
            {isUnavailable(product) ? "Sold Out" : "Add to Cart"}
          </button>
        </div>
      </div>
    </article>
  );
}

function CartPage({
  cartProducts,
  email,
  setEmail,
  busy,
  error,
  subtotalCents,
  shippingCents,
  updateQuantity,
  clearCart,
  checkout,
}: {
  cartProducts: Array<{ product: ShopProduct; quantity: number }>;
  email: string;
  setEmail: (value: string) => void;
  busy: boolean;
  error: string;
  subtotalCents: number;
  shippingCents: number;
  updateQuantity: (product: ShopProduct, quantity: number) => void;
  clearCart: () => void;
  checkout: () => void;
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="rounded-lg border border-white/[0.08] bg-[#141618] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-3 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d6c06f]">
              Cart
            </p>
            <h2 className="mt-1 text-2xl font-black">Review Your Cart</h2>
          </div>
          <div className="flex gap-2">
            <a
              href="/"
              className="rounded-md border border-white/[0.08] px-4 py-2 text-sm font-bold text-[#a8b0b8] hover:border-white/20 hover:text-[#e9ecef]"
            >
              Continue Shopping
            </a>
            {cartProducts.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="rounded-md border border-red-300/25 px-4 py-2 text-sm font-bold text-red-100 hover:bg-red-400/10"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {cartProducts.length === 0 ? (
            <p className="rounded-md bg-[#101214] p-5 text-sm leading-6 text-[#a8b0b8]">
              Your cart is empty.
            </p>
          ) : (
            cartProducts.map(({ product, quantity }) => (
              <div
                key={product.id}
                className="grid gap-4 rounded-md border border-white/[0.08] bg-[#101214] p-4 md:grid-cols-[88px_1fr_auto]"
              >
                <div className="h-20 w-20 overflow-hidden rounded-md bg-black/30">
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div>
                  <p className="text-sm text-[#a8b0b8]">{product.category}</p>
                  <h3 className="mt-1 font-black text-[#e9ecef]">{product.name}</h3>
                  <p className="mt-1 text-sm text-[#a8b0b8]">
                    {formatShopMoney(product.price_cents)} each
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(product, quantity - 1)}
                      className="h-9 w-9 rounded-md border border-white/[0.12] font-black hover:bg-white/10"
                    >
                      -
                    </button>
                    <input
                      aria-label={`${product.name} quantity`}
                      value={quantity}
                      onChange={(event) => updateQuantity(product, Number(event.target.value))}
                      className="h-9 w-16 rounded-md border border-white/[0.12] bg-black/20 text-center font-black text-white"
                    />
                    <button
                      type="button"
                      onClick={() => updateQuantity(product, quantity + 1)}
                      className="h-9 w-9 rounded-md border border-white/[0.12] font-black hover:bg-white/10"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => updateQuantity(product, 0)}
                      className="rounded-md px-2 py-2 text-xs font-bold text-[#a8b0b8] hover:bg-white/10 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="text-right text-lg font-black text-[#d6c06f]">
                  {formatShopMoney(product.price_cents * quantity)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <aside className="h-fit rounded-lg border border-white/[0.08] bg-[#141618] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)] lg:sticky lg:top-24">
        <h2 className="text-xl font-black">Order Summary</h2>
        <div className="mt-4 space-y-2 border-y border-white/[0.08] py-4 text-sm">
          <div className="flex justify-between">
            <span className="text-[#a8b0b8]">Subtotal</span>
            <span className="font-black">{formatShopMoney(subtotalCents)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#a8b0b8]">Shipping</span>
            <span className="text-right font-black">
              {shippingCents > 0 ? formatShopMoney(shippingCents) : "Handled in order notes"}
            </span>
          </div>
          <div className="flex justify-between border-t border-white/[0.08] pt-3 text-lg">
            <span className="font-black">Total</span>
            <span className="font-black text-[#d6c06f]">{formatShopMoney(subtotalCents + shippingCents)}</span>
          </div>
        </div>

        <label className="mt-4 block text-sm font-bold text-[#a8b0b8]">
          Email for order updates
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="mt-2 w-full rounded-md border border-white/[0.12] bg-[#101214] px-3 py-3 text-white placeholder:text-white/35"
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
          className="mt-4 w-full rounded-md bg-[#7fb069] px-5 py-3 font-black text-[#0b0d0b] transition hover:bg-[#92c37d] disabled:cursor-not-allowed disabled:border disabled:border-white/[0.08] disabled:bg-transparent disabled:text-[#a8b0b8]"
        >
          {busy ? "Opening Square..." : "Checkout with Square"}
        </button>
      </aside>
    </section>
  );
}
