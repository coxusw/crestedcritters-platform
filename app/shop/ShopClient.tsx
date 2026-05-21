"use client";

import { useEffect, useMemo, useState } from "react";
import type { ShopProduct, ShopProductOption } from "@/lib/shop";
import {
  formatOrderItemName,
  formatProductPrice,
  formatShopMoney,
  getProductOption,
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

type CartProductLine = {
  product: ShopProduct;
  option: ShopProductOption | null;
  quantity: number;
  unitPriceCents: number;
  availableQuantity: number;
  lineKey: string;
};

type CheckoutPayload = {
  checkoutUrl?: string;
  error?: string;
};

type ShippingOption = {
  serviceKey: string;
  serviceName: string;
  carrier: string;
  baseCents: number;
  surchargeCents: number;
  totalCents: number;
  deliveryDays: number | null;
};

type ShippingOptionsPayload = {
  options?: ShippingOption[];
  blocked?: boolean;
  blockedReason?: string;
  liveWarning?: string;
  hasLiveItems?: boolean;
  error?: string;
};

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

function isUnavailable(product: ShopProduct) {
  return product.sold_out || product.inventory <= 0;
}

function isLiveProduct(product: Pick<ShopProduct, "category">) {
  const category = product.category.toLowerCase();
  return category.includes("isopod") || category.includes("springtail") || category.includes("spring tail");
}

function cartLineKey(productId: string, optionId?: string) {
  return `${productId}:${optionId || ""}`;
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
  const [shippingState, setShippingState] = useState("");
  const [shippingPostalCode, setShippingPostalCode] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShippingKey, setSelectedShippingKey] = useState("");
  const [shippingBusy, setShippingBusy] = useState(false);
  const [liveWarning, setLiveWarning] = useState("");
  const [reviewedLiveShipping, setReviewedLiveShipping] = useState(false);
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
        const productOptions = normalizeProductOptions(product);
        const option = productOptions.length > 0 ? getProductOption(product, line.optionId) : null;
        const availableQuantity = productOptions.length > 0 && !option
          ? 0
          : productAvailableQuantity(product, option);
        const quantity = Math.min(line.quantity, Math.max(0, availableQuantity));

        return {
          product,
          option,
          quantity,
          unitPriceCents: productUnitPrice(product, option),
          availableQuantity,
          lineKey: cartLineKey(product.id, option?.id || line.optionId),
        };
      })
      .filter((line): line is CartProductLine => Boolean(line && line.quantity > 0));
  }, [cart, products]);

  const itemCount = cartProducts.reduce((total, line) => total + line.quantity, 0);
  const subtotalCents = cartProducts.reduce(
    (total, line) => total + line.unitPriceCents * line.quantity,
    0
  );
  const hasLiveItems = cartProducts.some((line) => isLiveProduct(line.product));
  const selectedShipping = shippingOptions.find(
    (option) => option.serviceKey === selectedShippingKey
  );
  const shippingCents = selectedShipping?.totalCents || 0;

  useEffect(() => {
    setShippingOptions([]);
    setSelectedShippingKey("");
    setLiveWarning("");
  }, [shippingState, shippingPostalCode, cartProducts.length]);

  function addToCart(product: ShopProduct, option?: ShopProductOption | null) {
    setError("");
    setCart((current) => {
      const key = cartLineKey(product.id, option?.id);
      const availableQuantity = productAvailableQuantity(product, option);
      const existing = current.find((line) => cartLineKey(line.productId, line.optionId) === key);
      if (existing) {
        return current.map((line) =>
          cartLineKey(line.productId, line.optionId) === key
            ? {
                ...line,
                slug: product.slug,
                name: product.name,
                optionId: option?.id || "",
                optionLabel: option?.label || "",
                quantity: Math.min(availableQuantity, line.quantity + 1),
              }
            : line
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          optionId: option?.id || "",
          optionLabel: option?.label || "",
          quantity: 1,
        },
      ];
    });
  }

  function updateQuantity(lineKey: string, quantity: number, availableQuantity: number) {
    setCart((current) => {
      if (quantity <= 0) {
        return current.filter((line) => cartLineKey(line.productId, line.optionId) !== lineKey);
      }
      return current.map((line) =>
        cartLineKey(line.productId, line.optionId) === lineKey
          ? { ...line, quantity: Math.min(availableQuantity, quantity) }
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
          marketingOptIn,
          shippingState,
          shippingPostalCode,
          shippingServiceKey: selectedShippingKey,
          reviewedLiveShipping,
          items: cartProducts.map((line) => ({
            productId: line.product.id,
            slug: line.product.slug,
            name: line.product.name,
            optionId: line.option?.id || "",
            optionLabel: line.option?.label || "",
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

  async function loadShippingOptions() {
    setShippingBusy(true);
    setError("");
    setShippingOptions([]);
    setSelectedShippingKey("");
    setLiveWarning("");

    try {
      const response = await fetch("/api/shop/shipping-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingState,
          shippingPostalCode,
          items: cartProducts.map((line) => ({
            productId: line.product.id,
            slug: line.product.slug,
            name: line.product.name,
            quantity: line.quantity,
          })),
        }),
      });
      const payload = (await response.json()) as ShippingOptionsPayload;

      if (!response.ok || payload.blocked || payload.error) {
        throw new Error(payload.blockedReason || payload.error || "Could not load shipping options.");
      }

      const options = payload.options || [];
      setShippingOptions(options);
      setLiveWarning(payload.liveWarning || "");
      setSelectedShippingKey(options[0]?.serviceKey || "");
    } catch (shippingError) {
      setError(shippingError instanceof Error ? shippingError.message : "Could not load shipping options.");
    } finally {
      setShippingBusy(false);
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
        selectedShipping={selectedShipping}
        shippingOptions={shippingOptions}
        selectedShippingKey={selectedShippingKey}
        setSelectedShippingKey={setSelectedShippingKey}
        shippingState={shippingState}
        setShippingState={setShippingState}
        shippingPostalCode={shippingPostalCode}
        setShippingPostalCode={setShippingPostalCode}
        marketingOptIn={marketingOptIn}
        setMarketingOptIn={setMarketingOptIn}
        shippingBusy={shippingBusy}
        loadShippingOptions={loadShippingOptions}
        hasLiveItems={hasLiveItems}
        liveWarning={liveWarning}
        reviewedLiveShipping={reviewedLiveShipping}
        setReviewedLiveShipping={setReviewedLiveShipping}
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
            The shop is being stocked. Please check back soon.
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
  addToCart: (product: ShopProduct, option?: ShopProductOption | null) => void;
}) {
  const productOptions = normalizeProductOptions(product);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const selectedOption = productOptions.find((option) => option.id === selectedOptionId) || null;
  const requiresOption = productOptions.length > 0;
  const availableQuantity = productAvailableQuantity(product, selectedOption);
  const unavailable = isUnavailable(product) || (requiresOption && selectedOption ? availableQuantity <= 0 : false);
  const canAdd = !unavailable && (!requiresOption || Boolean(selectedOption));

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
          <div className="text-lg font-black text-[#d6c06f]">{formatProductPrice(product)}</div>
        </div>

        <p className="mt-3 flex-1 text-sm leading-6 text-[#a8b0b8]">
          {product.description || "Product details coming soon."}
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
          <p className="text-xs font-bold uppercase tracking-wide text-[#a8b0b8]">
            {product.shipping_mode === "contact"
              ? "Contact us for shipping"
              : product.shipping_cents > 0
                ? `${formatShopMoney(product.shipping_cents)} shipping`
                : "Shipping calculated at checkout"}
          </p>
          <button
            type="button"
            onClick={() => addToCart(product, selectedOption)}
            disabled={!canAdd}
            className="inline-flex w-full items-center justify-center rounded-md bg-[#7fb069] px-4 py-3 text-sm font-black text-[#0b0d0b] transition hover:bg-[#92c37d] disabled:cursor-not-allowed disabled:border disabled:border-white/[0.08] disabled:bg-transparent disabled:text-[#a8b0b8]"
          >
            {unavailable ? "Sold Out" : requiresOption && !selectedOption ? `Choose ${product.option_name || "Option"}` : "Add to Cart"}
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
  selectedShipping,
  shippingOptions,
  selectedShippingKey,
  setSelectedShippingKey,
  shippingState,
  setShippingState,
  shippingPostalCode,
  setShippingPostalCode,
  marketingOptIn,
  setMarketingOptIn,
  shippingBusy,
  loadShippingOptions,
  hasLiveItems,
  liveWarning,
  reviewedLiveShipping,
  setReviewedLiveShipping,
  updateQuantity,
  clearCart,
  checkout,
}: {
  cartProducts: CartProductLine[];
  email: string;
  setEmail: (value: string) => void;
  busy: boolean;
  error: string;
  subtotalCents: number;
  shippingCents: number;
  selectedShipping?: ShippingOption;
  shippingOptions: ShippingOption[];
  selectedShippingKey: string;
  setSelectedShippingKey: (value: string) => void;
  shippingState: string;
  setShippingState: (value: string) => void;
  shippingPostalCode: string;
  setShippingPostalCode: (value: string) => void;
  marketingOptIn: boolean;
  setMarketingOptIn: (value: boolean) => void;
  shippingBusy: boolean;
  loadShippingOptions: () => void;
  hasLiveItems: boolean;
  liveWarning: string;
  reviewedLiveShipping: boolean;
  setReviewedLiveShipping: (value: boolean) => void;
  updateQuantity: (lineKey: string, quantity: number, availableQuantity: number) => void;
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
            cartProducts.map(({ product, option, quantity, unitPriceCents, availableQuantity, lineKey }) => (
              <div
                key={lineKey}
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
                  <h3 className="mt-1 font-black text-[#e9ecef]">
                    {formatOrderItemName({
                      name: product.name,
                      optionName: option ? product.option_name || "Option" : null,
                      optionLabel: option?.label || null,
                    })}
                  </h3>
                  <p className="mt-1 text-sm text-[#a8b0b8]">
                    {formatShopMoney(unitPriceCents)} each
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(lineKey, quantity - 1, availableQuantity)}
                      className="h-9 w-9 rounded-md border border-white/[0.12] font-black hover:bg-white/10"
                    >
                      -
                    </button>
                    <input
                      aria-label={`${product.name} quantity`}
                      value={quantity}
                      onChange={(event) => updateQuantity(lineKey, Number(event.target.value), availableQuantity)}
                      className="h-9 w-16 rounded-md border border-white/[0.12] bg-black/20 text-center font-black text-white"
                    />
                    <button
                      type="button"
                      onClick={() => updateQuantity(lineKey, quantity + 1, availableQuantity)}
                      className="h-9 w-9 rounded-md border border-white/[0.12] font-black hover:bg-white/10"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => updateQuantity(lineKey, 0, availableQuantity)}
                      className="rounded-md px-2 py-2 text-xs font-bold text-[#a8b0b8] hover:bg-white/10 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="text-right text-lg font-black text-[#d6c06f]">
                  {formatShopMoney(unitPriceCents * quantity)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <aside className="h-fit rounded-lg border border-white/[0.08] bg-[#141618] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)] lg:sticky lg:top-24">
        <h2 className="text-xl font-black">Order Summary</h2>
        <div className="mt-4 rounded-md border border-white/[0.08] bg-[#101214] p-3">
          <h3 className="font-black">Shipping</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-[110px_1fr] lg:grid-cols-1">
            <label className="block text-sm font-bold text-[#a8b0b8]">
              State
              <select
                value={shippingState}
                onChange={(event) => setShippingState(event.target.value)}
                className="mt-1 w-full rounded-md border border-white/[0.12] bg-[#101214] px-3 py-2 text-[#e9ecef] [color-scheme:dark]"
              >
                <option value="" className="bg-[#101214] text-[#e9ecef]">
                  Select
                </option>
                {US_STATES.map((state) => (
                  <option key={state} value={state} className="bg-[#101214] text-[#e9ecef]">
                    {state}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold text-[#a8b0b8]">
              ZIP code
              <input
                value={shippingPostalCode}
                onChange={(event) => setShippingPostalCode(event.target.value.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric"
                placeholder="46341"
                className="mt-1 w-full rounded-md border border-white/[0.12] bg-black/20 px-3 py-2 text-white placeholder:text-white/35"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={loadShippingOptions}
            disabled={shippingBusy || cartProducts.length === 0}
            className="mt-3 w-full rounded-md border border-[#7fb069]/35 px-4 py-2 text-sm font-black text-[#e9ecef] hover:bg-[#7fb069]/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {shippingBusy ? "Loading rates..." : "Load Shipping Rates"}
          </button>

          {liveWarning && (
            <div className="mt-3 rounded-md border border-[#d6c06f]/35 bg-[#d6c06f]/10 p-3 text-sm leading-6 text-[#f0e4ac]">
              {liveWarning}
              <label className="mt-3 flex items-start gap-2 font-bold text-[#e9ecef]">
                <input
                  type="checkbox"
                  checked={reviewedLiveShipping}
                  onChange={(event) => setReviewedLiveShipping(event.target.checked)}
                  className="mt-1"
                />
                I reviewed Live Shipping FAQ.
              </label>
            </div>
          )}

          {shippingOptions.length > 0 && (
            <div className="mt-3 space-y-2">
              {shippingOptions.map((option) => (
                <label
                  key={option.serviceKey}
                  className={`flex cursor-pointer items-start justify-between gap-3 rounded-md border p-3 text-sm ${
                    selectedShippingKey === option.serviceKey
                      ? "border-[#7fb069]/50 bg-[#7fb069]/10"
                      : "border-white/[0.08] bg-black/15"
                  }`}
                >
                  <span className="flex gap-2">
                    <input
                      type="radio"
                      name="shippingOption"
                      checked={selectedShippingKey === option.serviceKey}
                      onChange={() => setSelectedShippingKey(option.serviceKey)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-black text-[#e9ecef]">{option.serviceName}</span>
                      {option.surchargeCents > 0 && (
                        <span className="mt-1 block text-xs text-[#a8b0b8]">
                          Includes {formatShopMoney(option.surchargeCents)} Live packaging fee.
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="font-black text-[#d6c06f]">{formatShopMoney(option.totalCents)}</span>
                </label>
              ))}
            </div>
          )}

          {hasLiveItems && !liveWarning && (
            <p className="mt-3 text-xs leading-5 text-[#a8b0b8]">
              Live items ship by UPS Next Day Air or UPS 2nd Day Air.
            </p>
          )}
        </div>
        <div className="mt-4 space-y-2 border-y border-white/[0.08] py-4 text-sm">
          <div className="flex justify-between">
            <span className="text-[#a8b0b8]">Subtotal</span>
            <span className="font-black">{formatShopMoney(subtotalCents)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#a8b0b8]">Shipping</span>
            <span className="text-right font-black">
              {selectedShipping ? formatShopMoney(shippingCents) : "Select rate"}
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

        <label className="mt-3 flex items-start gap-2 rounded-md border border-white/[0.08] bg-[#101214] p-3 text-sm font-bold text-[#a8b0b8]">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(event) => setMarketingOptIn(event.target.checked)}
            className="mt-1"
          />
          Email me future Crested Critters sales and shop updates.
        </label>

        {error && (
          <p className="mt-3 rounded-md border border-red-300/30 bg-red-500/15 p-3 text-sm text-red-100">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={checkout}
          disabled={
            busy ||
            cartProducts.length === 0 ||
            !selectedShipping ||
            (hasLiveItems && !reviewedLiveShipping)
          }
          className="mt-4 w-full rounded-md bg-[#7fb069] px-5 py-3 font-black text-[#0b0d0b] transition hover:bg-[#92c37d] disabled:cursor-not-allowed disabled:border disabled:border-white/[0.08] disabled:bg-transparent disabled:text-[#a8b0b8]"
        >
          {busy ? "Opening Square..." : "Checkout with Square"}
        </button>
      </aside>
    </section>
  );
}
