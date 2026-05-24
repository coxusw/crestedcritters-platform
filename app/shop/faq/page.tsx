import ShopShell from "../ShopShell";

const sections = [
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
    title: "Source",
    body: [
      "All products are from Crested Critters' own stock unless otherwise stated.",
      "Some products may come from other sources, and the product listing will state this.",
    ],
  },
  {
    title: "Live products",
    body: [
      "Live isopods and springtails have separate shipping rules because weather, transit time, and state restrictions matter.",
      "Please review the Live Shipping page before placing a live order.",
    ],
    href: "/live-shipping",
    linkLabel: "View Live Shipping",
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
