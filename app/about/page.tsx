import type { Metadata } from "next";
import MainSiteShell from "@/app/components/MainSiteShell";

const title = "About / Q&A | Crested Critters";
const description =
  "Learn about Crested Critters, shipping policies, returns, and compliance for live isopod and springtail shipments.";

const complianceText =
  "Yes, Crested Critters follows all Federal and State laws, and has obtained and keeps all applicable permits needed. Crested Critters strives to stay up to date with all permits and laws and regulations. We will include the USDA Awareness letter in all live shipments. If we do not currently have an active PPQ-526 permit to ship live to a certain state it will not allow the order to go through to that address.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: {
    canonical: "https://crestedcritters.com/about/",
  },
  openGraph: {
    title,
    description,
    url: "https://crestedcritters.com/about/",
    siteName: "Crested Critters",
  },
};

const questions = [
  {
    title: "Do you ship isopods or springtails?",
    body: "Currently, Crested Critters does not ship live isopods or springtails. At this time, all isopods and springtails are available for in-person purchase only within the Northwest Indiana region. We do have plans to offer shipping in the future once we are confident we can maintain the same high standards of animal health and safe delivery.",
  },
  {
    title: "Do you ship other items?",
    body: "Yes. Non-live items such as botanicals and 3D printed accessories may be shipped. All shipments are sent through USPS Ground Advantage unless otherwise specified. Processing times may vary depending on product availability and preparation requirements.",
  },
  {
    title: "What is your live arrival / DOA policy?",
    body: "Because live isopods and springtails are currently sold in person only, live arrival issues related to shipping do not apply at this time. When live shipping becomes available in the future, Crested Critters will implement a clear and fair live arrival guarantee to ensure customer confidence and animal welfare.",
  },
  {
    title: "What is your return policy?",
    body: "Crested Critters generally does not offer returns, and all sales are considered final. However, we stand behind the quality of our products and customer experience. If you believe there is an issue with your purchase, we encourage you to reach out through the Contact page. We review each situation individually and will make every reasonable effort to resolve legitimate concerns fairly.",
  },
  {
    title: "What is Crested Critters' overall policy philosophy?",
    body: "Our goal is to provide healthy cultures, high-quality supplies, and an honest buying experience. We take pride in our products and our reputation within the hobby community. If a problem arises, we are committed to working with you in good faith to find an appropriate solution.",
  },
  {
    title: "Does Crested Critters follow all applicable laws?",
    body: complianceText,
    href: "/usda-awareness-letter.pdf",
    linkLabel: "View USDA Awareness Letter",
  },
];

export default function AboutPage() {
  return (
    <MainSiteShell>
      <section className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d6c06f]">
          Crested Critters
        </p>
        <h1 className="mt-2 text-4xl font-black leading-tight text-white md:text-5xl">
          About / Q&amp;A
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-[#a8b0b8]">
          Crested Critters was officially established in 2025 to provide premium
          isopods, botanicals, and accessories designed to support thriving
          bioactive enclosures. If you have any questions beyond what is listed
          below please do not hesitate to reach out via the Contact page.
        </p>

        <div className="mt-8 rounded-md border border-white/[0.08] bg-[#111315] p-5">
          <h2 className="text-xl font-black text-white">What we focus on</h2>
          <ul className="mt-4 grid gap-3 text-sm font-bold text-[#d7ead0] sm:grid-cols-3">
            <li className="rounded-md border border-[#7fb069]/20 bg-[#7fb069]/10 px-4 py-3">
              Healthy cultures and enclosure-safe materials
            </li>
            <li className="rounded-md border border-[#7fb069]/20 bg-[#7fb069]/10 px-4 py-3">
              Supplies built for real keepers
            </li>
            <li className="rounded-md border border-[#7fb069]/20 bg-[#7fb069]/10 px-4 py-3">
              Fair pricing
            </li>
          </ul>
        </div>

        <div className="mt-6 grid gap-4">
          {questions.map((question) => (
            <article
              key={question.title}
              className="rounded-md border border-white/[0.08] bg-[#111315] p-5"
            >
              <h2 className="text-lg font-black text-white">{question.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#a8b0b8]">{question.body}</p>
              {question.href && (
                <a
                  href={question.href}
                  className="mt-4 inline-flex rounded-md border border-[#7fb069]/35 px-4 py-2 text-sm font-black text-[#d7ead0] hover:bg-[#7fb069]/10"
                >
                  {question.linkLabel}
                </a>
              )}
            </article>
          ))}
        </div>
      </section>
    </MainSiteShell>
  );
}
