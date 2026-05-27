import type { Metadata } from "next";
import Link from "next/link";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import { absoluteIsopediaUrl } from "@/lib/isopedia-site";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type ShopItem = {
  id: string;
  name: string;
  description: string | null;
  item_type: string;
  price: number;
  active: boolean;
};

export const metadata: Metadata = {
  title: "IsoToken Store | Isopedia",
  description:
    "A coming soon Isopedia store where contributors will spend IsoTokens on profile unlocks, limited badges, themes, and future community features.",
  alternates: {
    canonical: absoluteIsopediaUrl("/isotoken-store"),
  },
  openGraph: {
    title: "IsoToken Store | Isopedia",
    description:
      "Spend IsoTokens earned from Isopedia contributions on future profile unlocks and community rewards.",
    url: absoluteIsopediaUrl("/isotoken-store"),
    siteName: "Isopedia",
    images: [
      {
        url: absoluteIsopediaUrl("/isopedia-social-preview.jpg"),
        width: 1200,
        height: 630,
        alt: "Isopedia IsoToken Store",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "IsoToken Store | Isopedia",
    description:
      "Spend IsoTokens earned from Isopedia contributions on future profile unlocks and community rewards.",
    images: [absoluteIsopediaUrl("/isopedia-social-preview.jpg")],
  },
};

export default async function IsoTokenStorePage() {
  const supabase = await createSupabaseServerClient();
  const { data: items } = await supabase
    .from("isotoken_shop_items")
    .select("id, name, description, item_type, price, active")
    .eq("active", true)
    .order("price", { ascending: true })
    .limit(12)
    .returns<ShopItem[]>();

  const displayItems =
    items && items.length > 0
      ? items
      : [
          {
            id: "limited-badges",
            name: "Limited Badges",
            description:
              "Collect limited profile badges with IsoTokens earned from contributions.",
            item_type: "badge",
            price: 100,
            active: true,
          },
          {
            id: "profile-banner",
            name: "Profile Banner Unlock",
            description:
              "Unlock a larger profile banner area for future profile customization.",
            item_type: "profile_banner",
            price: 150,
            active: true,
          },
          {
            id: "profile-themes",
            name: "Profile Theme Options",
            description:
              "Use IsoTokens for future profile color and theme customizations.",
            item_type: "profile_theme",
            price: 200,
            active: true,
          },
          {
            id: "username-change",
            name: "Username Change",
            description:
              "A future unlock for changing your public Isopedia username.",
            item_type: "username_change",
            price: 250,
            active: true,
          },
        ];

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <IsopediaNav active="store" />

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#102016] shadow-2xl shadow-black/30">
          <div className="bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_40%),linear-gradient(135deg,rgba(6,78,59,0.55),rgba(7,19,12,0.96))] p-6 sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
              Coming Soon
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-6xl">
              IsoToken Store
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-emerald-50/75 sm:text-lg">
              The IsoToken Store will be where Isopedia contributors spend the
              IsoTokens they earn from helping the site grow: discussion posts,
              quality likes, submissions, edits, images, and future community
              contributions.
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {displayItems.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-white/10 bg-[#102016] p-5 shadow-xl shadow-black/20"
            >
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300/80">
                {item.item_type.replace(/_/g, " ")}
              </p>
              <h2 className="mt-2 text-xl font-black text-white">{item.name}</h2>
              <p className="mt-3 min-h-20 text-sm leading-6 text-emerald-50/60">
                {item.description || "More details coming soon."}
              </p>
              <div className="mt-5 flex items-center justify-between gap-3">
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200">
                  {item.price} IsoTokens
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-black text-emerald-50/45">
                  Soon
                </span>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-[#102016] p-5 text-sm leading-7 text-emerald-50/65 shadow-xl shadow-black/20 sm:p-6">
          <p>
            Purchases are intentionally disabled for now while the shop is being
            filled out and tested. The first planned unlocks are limited badges,
            profile banners, username changes, profile themes, and future
            profile upgrades.
          </p>
          <Link
            href="/account"
            className="mt-4 inline-flex rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-black text-emerald-200 transition hover:bg-black/30"
          >
            View your profile
          </Link>
        </section>
      </div>
    </main>
  );
}
