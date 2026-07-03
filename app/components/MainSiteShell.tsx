import Link from "next/link";
import type { ReactNode } from "react";

export default function MainSiteShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0e0f10] text-[#e9ecef]">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0b0c0d]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-4 py-3">
          <Link href="/" aria-label="Crested Critters Home" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/images/logo.png"
              alt="Crested Critters"
              className="h-16 w-16 object-contain"
            />
          </Link>

          <nav className="flex flex-wrap items-center justify-end gap-4 text-sm font-bold text-[#a8b0b8]">
            <Link href="/" className="hover:text-[#7fb069]">
              Home
            </Link>
            <a href="https://shop.crestedcritters.com" className="hover:text-[#7fb069]">
              Shop
            </a>
            <Link href="/about" className="hover:text-[#7fb069]">
              About
            </Link>
            <Link href="/contact" className="hover:text-[#7fb069]">
              Contact
            </Link>
            <a href="https://isopedia.crestedcritters.com/" className="hover:text-[#7fb069]">
              Isopedia
            </a>
            <a href="https://randomizer.crestedcritters.com/" className="hover:text-[#7fb069]">
              Randomizer
            </a>
          </nav>
        </div>
      </header>

      {children}

      <footer className="mt-20 border-t border-white/[0.06] bg-[#0b0c0d] px-4 py-8 text-center text-sm text-[#a8b0b8]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4">
          <a
            href="https://www.facebook.com/people/Crested-Critters/61576805665752/"
            target="_blank"
            rel="noopener"
            className="font-black text-[#d7ead0] hover:text-[#7fb069]"
          >
            Check Us Out On FB
          </a>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-2 font-black">
            <span className="h-2.5 w-2.5 rounded-full bg-[#7fb069]" />
            Secure checkout powered by Square
          </div>
          <p>Crested Critters - Bioactive supplies for reptiles & inverts.</p>
        </div>
      </footer>
    </main>
  );
}
