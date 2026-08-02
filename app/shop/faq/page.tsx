import { shopBaseUrl } from "@/lib/shop";
import ShopShell from "../ShopShell";

const title = "Shop FAQ | Crested Critters Shop";
const description = "Shipping, checkout, product source, and responsible keeping details for Crested Critters Shop orders.";

export const metadata = {
  title: { absolute: title },
  description,
  alternates: {
    canonical: `${shopBaseUrl()}/faq`,
  },
  openGraph: {
    title,
    description,
    url: `${shopBaseUrl()}/faq`,
    siteName: "Crested Critters Shop",
  },
};

const sections = [
  {
    title: "Does Crested Critters ship live isopods and other live cultures?",
    body: [
      "Yes. Crested Critters now accepts eligible live-animal orders for shipping to approved destinations within the contiguous United States. Availability varies by species and destination state, so the shop will ask you to select your state and will identify which live products are currently eligible for shipment.",
    ],
  },
  {
    title: "Why are some live products greyed out?",
    body: [
      "Live-animal movement rules and permit coverage differ by state and species. Products shown in grey are not currently available for shipment to your selected state. They remain visible so customers can learn about our available cultures and contact us regarding possible local or in-person availability.",
    ],
  },
  {
    title: "Can I order a restricted product for local pickup or an in-person sale?",
    body: [
      "Local or in-person availability may be possible depending on applicable laws, permit conditions, inventory, and scheduling. Use our contact form to ask about a specific product. Contacting us does not guarantee that a sale or transfer will be available.",
    ],
  },
  {
    title: "Why do I need to select my state?",
    body: [
      "Your state helps us apply the correct live-shipping eligibility rules before you add live products to your cart. Your checkout shipping address will be used for the final compliance check.",
    ],
  },
  {
    title: "Can I change my selected state?",
    body: [
      "Yes. Use the Shipping to selector in the shop. If your checkout address is in a different state, product eligibility will be recalculated automatically.",
    ],
  },
  {
    title: "Do restrictions affect dry goods and supplies?",
    body: [
      "No. State-based live-animal restrictions apply only to affected live products. Dry goods, habitat supplies, decor, and other non-live products remain available unless otherwise stated.",
    ],
  },
  {
    title: "Do you ship to Alaska or Hawaii?",
    body: [
      "Crested Critters does not currently offer live-animal shipping to Alaska or Hawaii.",
    ],
  },
  {
    title: "How checkout works",
    body: [
      "Add the items you want to your cart, enter your shipping address, choose an available shipping option, then complete payment through Square.",
      "If something in your cart is no longer available, checkout will stop and ask you to update the cart before payment.",
      "After payment, Crested Critters receives the order details and the shipping address you entered at checkout.",
    ],
  },
  {
    title: "Non-live shipping",
    body: [
      "Non-live products include supplies, botanicals, accessories, 3D prints, and merch when no live products are in the cart.",
      "Non-live orders ship using USPS Ground Advantage.",
      "Shipping is calculated at checkout after you enter your shipping address.",
    ],
  },
  {
    title: "Botanicals",
    body: [
      "All botanicals are sanitized by Crested Critters for safe delivery.",
      "It is still advised that all shipments be sanitized before use.",
    ],
  },
  {
    title: "Does Crested Critters follow all applicable laws?",
    body: [
      "Yes, Crested Critters follows all Federal and State laws, and has obtained and keeps all applicable permits needed. Crested Critters strives to stay up to date with all permits and laws and regulations. We will include the USDA Awareness letter in all live shipments. If we do not currently have an active PPQ-526 permit to ship live to a certain state it will not allow the order to go through to that address.",
    ],
    href: "/usda-awareness-letter.pdf",
    linkLabel: "View USDA Awareness Letter",
  },
  {
    title: "Source",
    body: [
      "All products are from Crested Critters' own stock unless otherwise stated.",
      "Some products may come from other sources, and the product listing will state this.",
    ],
  },
  {
    title: "Order questions",
    body: [
      "If you have a question about an order, shipping timing, product availability, or live shipping, contact Crested Critters before placing the order.",
      "For paid orders, include the email used at checkout so the order can be found faster.",
    ],
  },
  {
    title: "Responsible keeping and disposal",
    body: [
      "Please never release isopods, springtails, or enclosure material outdoors. Even small cleanup crews can become invasive when introduced outside of their proper environment.",
      "Used substrate, leaf litter, cork, moss, and any other enclosure material should be frozen for at least 72 hours before disposal.",
      "This helps prevent accidental introduction of non-native species and protects local ecosystems.",
    ],
  },
  {
    title: "Live products",
    body: [
      "Live isopods and springtails have separate shipping rules because weather, transit time, exact species, and destination-state restrictions matter.",
      "Please review the Live Shipping page before placing a live order.",
    ],
    href: "/live-shipping",
    linkLabel: "View Live Shipping",
  },
];

export default function ShopFaqPage() {
  return (
    <ShopShell>
      <section className="mx-auto max-w-5xl">
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <article
              key={section.title}
              className="rounded-md border border-white/[0.08] bg-[#111315] p-5"
            >
              <h3 className="text-lg font-black text-white">{section.title}</h3>
              <div className="mt-3 space-y-3 text-sm leading-7 text-[#a8b0b8]">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {section.href && (
                <a
                  href={section.href}
                  className="mt-4 inline-flex rounded-md border border-[#7fb069]/35 px-4 py-2 text-sm font-black text-[#d7ead0] hover:bg-[#7fb069]/10"
                >
                  {section.linkLabel}
                </a>
              )}
            </article>
          ))}
        </div>
      </section>
    </ShopShell>
  );
}
