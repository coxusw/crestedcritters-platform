import ShopShell from "../ShopShell";

const liveStates = ["Alaska", "Hawaii", "Florida", "California", "Oregon"];

const sections = [
  {
    title: "How shop shipping works",
    body: [
      "Live products are isopods and springtails. If a cart contains any live product, checkout will only show UPS Next Day Air and UPS 2nd Day Air.",
      "Non-live orders use USPS Ground Advantage. This includes supplies, botanicals, accessories, 3D prints, and merch when no live product is in the cart.",
      "Shipping is calculated at checkout after you enter your shipping state and ZIP code.",
    ],
  },
  {
    title: "Live shipping season",
    body: [
      "Crested Critters begins live shipping the last week of March and ships live orders through November when weather allows.",
      "Live orders are not available from December through the last week of March. If your cart contains isopods or springtails during that window, checkout will not continue with the live order.",
      "We may hold live orders during unsafe weather. Safe arrival matters more than rushing a box into conditions that are not good for the animals.",
    ],
  },
  {
    title: "Seasonal live packaging",
    body: [
      "Live shipments require extra packaging to ensure safe arrival especially with seasonal weather.",
      "From the last week of March - June, live orders include a $5 packaging charge.",
      "July - September includes a $10 temperature-control packaging charge.",
      "October live orders include a $5 packaging charge.",
      "November includes a $10 temperature-control packaging charge.",
      "These charges are added only to live orders, and are to help cover the actual packaging needed for safe and live transit.",
    ],
  },
  {
    title: "States currently excluded for live shipping",
    body: [
      `Live isopods and springtails cannot currently ship to ${liveStates.join(", ")}.`,
      "These states are currently excluded because of permitting and live-animal shipping restrictions.",
      "Non-live products can still be ordered to those states as long as the cart does not contain isopods or springtails.",
    ],
  },
  {
    title: "Live arrival guarantee",
    body: [
      "Our live arrival guarantee applies to live orders shipped with the required UPS air service and delivered on the first delivery attempt.",
      "Please be available for delivery and bring the package inside quickly. Heat, cold, missed deliveries, and packages left outside can affect the guarantee.",
      "If there is a problem with a live shipment, contact us on the delivery day with your order number, clear photos of the unopened containers, and photos of the shipping box and packing materials.",
    ],
  },
  {
    title: "Before placing a live order",
    body: [
      "Please review your shipping address, weather, and delivery schedule before checkout. Live orders should ship to an address where someone can receive the package.",
      "If your cart has live items, checkout will ask you to confirm that you reviewed this page before payment.",
      "For questions about timing, weather holds, or state restrictions, contact us before placing your order.",
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
            </article>
          ))}
        </div>
      </section>
    </ShopShell>
  );
}
