import type { ReactNode } from "react";

export default function ShopShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0e0f10] text-[#e9ecef]">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0b0c0d]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-5 px-4 py-3">
          <a href="/" aria-label="Crested Critters Shop" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://crestedcritters.com/assets/images/logo.png"
              alt="Crested Critters"
              className="h-14 w-14 object-contain"
            />
          </a>
          <nav className="flex flex-wrap items-center justify-end gap-4 text-sm font-bold text-[#a8b0b8]">
            <a href="/" className="hover:text-[#7fb069]">Shop</a>
            <a href="/cart" className="hover:text-[#7fb069]">Cart</a>
            <a href="/faq" className="hover:text-[#7fb069]">FAQ</a>
            <a href="https://crestedcritters.com/contact/" className="hover:text-[#7fb069]">Contact</a>
            <a href="https://isopedia.crestedcritters.com/" className="hover:text-[#7fb069]">Isopedia</a>
            <a href="https://randomizer.crestedcritters.com/" className="hover:text-[#7fb069]">Randomizer</a>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
        <header className="flex flex-col gap-4 border-b border-white/[0.08] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d6c06f]">
              Crested Critters
            </p>
            <h1 className="mt-2 text-4xl font-black leading-tight md:text-5xl">Shop</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#a8b0b8]">
              Isopods, springtails, botanicals, accessories, and merch from Crested Critters.
            </p>
          </div>
          <div className="rounded-md border border-white/[0.08] bg-[#141618] px-4 py-3 text-sm font-bold text-[#a8b0b8] shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
            Secure checkout powered by Square
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
