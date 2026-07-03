import type { Metadata } from "next";
import MainSiteShell from "@/app/components/MainSiteShell";

export const metadata: Metadata = {
  title: { absolute: "Crested Critters | Premium Bioactive Supplies" },
  description:
    "Premium bioactive supplies, isopods, springtails, botanicals, accessories, and keeper tools from Crested Critters.",
  alternates: {
    canonical: "https://crestedcritters.com/",
  },
};

const categories = [
  {
    title: "Isopods",
    description: "Hardy cleanup crews and cultures for bioactive builds.",
    href: "https://shop.crestedcritters.com/#isopods",
    image: "/assets/images/dairy-cow-isopods.jpg",
  },
  {
    title: "Botanicals",
    description: "Leaf litter, seed pods, and natural decor for enrichment.",
    href: "https://shop.crestedcritters.com/#botanicals",
    image: "/assets/images/leaf-3.png",
  },
  {
    title: "3D Printed Accessories",
    description: "Functional prints made for reptile and invert setups.",
    href: "https://shop.crestedcritters.com/#3d-printed-accessories",
    image: "/assets/images/3d-prints.jpeg",
  },
  {
    title: "Merch",
    description: "Get your swag and handmade crocheted isopods.",
    href: "https://shop.crestedcritters.com/#merch",
    image: "/assets/images/thechalkinwildchild-logo.jpeg",
  },
];

const testimonials = [
  "The dairy cows came in active and healthy. You can tell these are well cared for cultures.",
  "Shipping was fast and everything was packed really well. My bioactive setup looks way better now.",
  "Count was accurate with extra actually and checkout was simple. Appreciate that a lot.",
];

export default function MainHomePage() {
  return (
    <MainSiteShell>
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d6c06f]">
            Crested Critters
          </p>
          <h1 className="mt-3 text-5xl font-black leading-tight text-white md:text-6xl">
            Premium Bioactive Supplies
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[#a8b0b8]">
            Isopods, botanicals, and 3D printed accessories for thriving
            enclosures.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://shop.crestedcritters.com"
              className="rounded-md bg-[#7fb069] px-5 py-3 text-sm font-black text-[#0b0d0b] hover:bg-[#92c37d]"
            >
              Shop Now
            </a>
            <a
              href="https://shop.crestedcritters.com/#3d-printed-accessories"
              className="rounded-md border border-white/[0.12] px-5 py-3 text-sm font-black text-white hover:border-white/[0.22]"
            >
              3D Printed
            </a>
            <a
              href="https://shop.crestedcritters.com/#botanicals"
              className="rounded-md border border-white/[0.12] px-5 py-3 text-sm font-black text-white hover:border-white/[0.22]"
            >
              Botanicals
            </a>
          </div>
        </div>

        <div className="rounded-md border border-white/[0.08] bg-[radial-gradient(circle_at_30%_20%,rgba(127,176,105,0.18),transparent),radial-gradient(circle_at_80%_70%,rgba(214,192,111,0.12),transparent)] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/images/logo.png"
            alt="Crested Critters"
            className="aspect-[4/3] w-full rounded-md object-contain"
          />
        </div>
      </section>

      <section className="px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6">
            <h2 className="text-3xl font-black text-white">Shop by Category</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <a
                key={category.title}
                href={category.href}
                className="overflow-hidden rounded-md border border-white/[0.08] bg-[#141618] shadow-[0_10px_40px_rgba(0,0,0,0.35)] hover:border-[#7fb069]/35"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={category.image}
                  alt={category.title}
                  className="h-44 w-full object-cover"
                />
                <div className="p-4">
                  <h3 className="font-black text-white">{category.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#a8b0b8]">
                    {category.description}
                  </p>
                  <span className="mt-3 inline-block text-sm font-black text-[#d6c06f]">
                    Shop
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white/[0.02] px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-black text-white">What Keepers Are Saying</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {testimonials.map((quote) => (
              <div
                key={quote}
                className="rounded-md border border-white/[0.08] bg-[#141618] p-5 text-sm font-bold leading-7 text-[#e9ecef]"
              >
                &ldquo;{quote}&rdquo;
              </div>
            ))}
          </div>
        </div>
      </section>
    </MainSiteShell>
  );
}
