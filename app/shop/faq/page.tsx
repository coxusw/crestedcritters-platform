import ShopShell from "../ShopShell";

const liveStates = ["Alaska", "Hawaii", "Florida", "California", "Oregon"];

const sections = [
  {
    title: "How shop shipping works",
    body: [
      "Live products are isopods and springtails. If a cart contains any live product, checkout will only show UPS Next Day Air and UPS 2nd Day Air.",
      "Non-live orders use USPS Ground Advantage. This includes supplies, botanicals, accessories, 3D prints, and merch when no live product is in the cart.",
      "Shipping rates are calculated during checkout using the shipping address and the package settings Crested Critters has configured for the shop.",
    ],
  },
  {
    title: "Live shipping season",
    body: [
      "Crested Critters live shipping starts the last week of March and runs through November when weather allows.",
      "Live checkout is blocked from December through the last week of March. If a cart contains isopods or springtails during that window, checkout will not process the live order.",
      "Orders may be held during unsafe weather. Safe arrival matters more than rushing a box into conditions that are not good for live animals.",
    ],
  },
  {
    title: "Seasonal live packaging",
    body: [
      "Live shipments include seasonal packing when needed. From the last week of March through June, live orders include a $5 packaging charge.",
      "July through September includes a $10 temperature-control packaging charge. October includes a $5 charge, and November includes a $10 temperature-control packaging charge.",
      "These charges are added only to live orders and are meant to cover the actual packaging needed for safe transit.",
    ],
  },
  {
    title: "States currently excluded for live shipping",
    body: [
      `Live isopods and springtails cannot currently ship to ${liveStates.join(", ")}.`,
      "Those states are excluded because of permitting and live-animal shipping restrictions. If Crested Critters obtains the needed permits later, individual states can be reopened in the shop settings.",
      "Non-live products can still be ordered to those states as long as the cart does not contain isopods or springtails.",
    ],
  },
  {
    title: "Live arrival guarantee",
    body: [
      "The live arrival guarantee applies to eligible live orders shipped with the required UPS air service and delivered on the first delivery attempt.",
      "Please be available for delivery and bring the package inside quickly. Heat, cold, missed deliveries, and packages left outside can affect live arrival coverage.",
      "If there is an issue, contact Crested Critters on the delivery day with the order number, clear photos of the unopened containers, and photos of the shipping box and packing materials.",
    ],
  },
  {
    title: "Before placing a live order",
    body: [
      "Review your shipping address, weather, and delivery schedule before checkout. Live orders should ship to an address where someone can receive the package.",
      "If your cart has live items, checkout will ask you to confirm that you reviewed this page before payment.",
      "For questions about timing, holds, or a state restriction, contact Crested Critters before placing the order.",
    ],
  },
];

export default function ShopFaqPage() {
  return (
    <ShopShell>
      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-md border border-white/[0.08] bg-[#141618] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d6c06f]">
            Shipping FAQ
          </p>
          <h2 className="mt-3 text-3xl font-black leading-tight text-white">
            Live shipping, checkout rules, and order policies
          </h2>
          <p className="mt-4 text-sm leading-7 text-[#a8b0b8]">
            Use this page to understand which shipping methods are available, why
            some states are blocked for live products, and what to do if a live
            shipment needs help.
          </p>
          <div className="mt-5 rounded-md border border-[#7fb069]/25 bg-[#7fb069]/10 p-4 text-sm font-bold leading-6 text-[#d7ead0]">
            Live carts only show UPS Next Day Air and UPS 2nd Day Air. Non-live
            carts use USPS Ground Advantage.
          </div>
        </div>

        <div className="grid gap-4">
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
