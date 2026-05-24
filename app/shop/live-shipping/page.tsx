import ShopShell from "../ShopShell";

const restrictedStates = ["Alaska", "Hawaii", "Florida", "California", "Oregon"];

const sections = [
  {
    title: "Live shipping basics",
    body: [
      "Live products are isopods and springtails. If a cart contains any live product, checkout will only show UPS Next Day Air and UPS 2nd Day Air.",
      "Crested Critters begins live shipping the last week of March and ships live orders through November when weather allows.",
      "Live orders are not available from December through the last week of March. If your cart contains isopods or springtails during that window, checkout will not continue with the live order.",
    ],
  },
  {
    title: "Weather holds",
    body: [
      "Weather holds are used when temperatures or transit conditions are not safe for live animals.",
      "Crested Critters may hold a live order during heat, cold, storms, carrier delays, holidays, or any condition that could put the shipment at risk.",
      "Safe arrival matters more than rushing a box into unsafe conditions. If a hold is needed, the order will ship when conditions are safer.",
    ],
  },
  {
    title: "Restricted states",
    body: [
      `Live isopods and springtails cannot currently ship to ${restrictedStates.join(", ")}.`,
      "These states are restricted because of permitting, live-animal movement rules, or state-level compliance concerns.",
      "Non-live products can still be ordered to those states as long as the cart does not contain isopods or springtails.",
    ],
  },
  {
    title: "Permit compliance",
    body: [
      "Crested Critters is working to keep live shipping compliant with federal and state requirements.",
      "Some species and some destination states may require permits, approvals, or restrictions before live animals can be shipped.",
      "If a destination cannot be shipped legally or safely, Crested Critters will not process the live shipment.",
    ],
  },
  {
    title: "Live arrival terms",
    body: [
      "The live arrival guarantee applies to live orders shipped with the required UPS air service and delivered on the first delivery attempt.",
      "Please be available for delivery and bring the package inside quickly. Heat, cold, missed deliveries, and packages left outside can affect the guarantee.",
      "If there is a problem with a live shipment, contact Crested Critters on the delivery day with your order number, clear photos of the unopened containers, and photos of the shipping box and packing materials.",
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
    title: "Before placing a live order",
    body: [
      "Review your shipping address, local weather, and delivery schedule before checkout.",
      "Live orders should ship to an address where someone can receive the package on the first delivery attempt.",
      "If your cart has live items, checkout will ask you to confirm that you reviewed this page before payment.",
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

export default function LiveShippingPage() {
  return (
    <ShopShell>
      <section className="mx-auto max-w-5xl">
        <div className="mb-5 rounded-md border border-[#d6c06f]/25 bg-[#d6c06f]/10 p-5">
          <h2 className="text-2xl font-black text-white">Live Shipping</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#e6dcad]">
            Live isopods and springtails need faster shipping, safe weather windows, and state compliance review.
            Please read this page before placing a live order.
          </p>
        </div>

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
