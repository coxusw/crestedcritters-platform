import type { Metadata } from "next";
import MainSiteShell from "@/app/components/MainSiteShell";

export const metadata: Metadata = {
  title: { absolute: "Contact | Crested Critters" },
  description:
    "Contact Crested Critters with questions about bioactive builds, isopods, shop orders, and keeper tools.",
  alternates: {
    canonical: "https://crestedcritters.com/contact/",
  },
};

export default function MainContactPage() {
  return (
    <MainSiteShell>
      <section className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d6c06f]">
          Contact
        </p>
        <h1 className="mt-3 text-4xl font-black leading-tight text-white md:text-5xl">
          Contact Crested Critters
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-[#a8b0b8]">
          Questions about builds, species, or orders? Reach out through the shop
          or social channels and we will get back to you as soon as possible.
        </p>

        <div className="mt-8 rounded-md border border-white/[0.08] bg-[#141618] p-5">
          <h2 className="text-xl font-black text-white">How to reach us</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-7 text-[#a8b0b8]">
            <li>
              Shop questions:{" "}
              <a
                href="https://shop.crestedcritters.com/faq"
                className="font-black text-[#d7ead0] hover:text-[#7fb069]"
              >
                View Shop FAQ
              </a>
            </li>
            <li>
              Facebook:{" "}
              <a
                href="https://www.facebook.com/people/Crested-Critters/61576805665752/"
                target="_blank"
                rel="noopener"
                className="font-black text-[#d7ead0] hover:text-[#7fb069]"
              >
                Crested Critters
              </a>
            </li>
          </ul>
        </div>
      </section>
    </MainSiteShell>
  );
}
