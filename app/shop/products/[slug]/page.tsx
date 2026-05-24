import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { ShopProduct } from "@/lib/shop";
import {
  shopBaseUrl,
  shopProductCardDescription,
  shopProductFullDescription,
} from "@/lib/shop";
import ShopShell from "../../ShopShell";
import ProductDetailClient from "./ProductDetailClient";

export const dynamic = "force-dynamic";

async function getProduct(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("shop_products")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as ShopProduct;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) {
    return {
      title: "Product Not Found | Crested Critters Shop",
    };
  }

  const description =
    shopProductCardDescription(product) ||
    shopProductFullDescription(product) ||
    "Shop Crested Critters products.";
  const url = `${shopBaseUrl()}/products/${product.slug}`;

  return {
    title: `${product.name} | Crested Critters Shop`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${product.name} | Crested Critters Shop`,
      description,
      url,
      siteName: "Crested Critters Shop",
      images: product.image_url ? [{ url: product.image_url, alt: product.name }] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const fullDescription = shopProductFullDescription(product);

  return (
    <ShopShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#a8b0b8]">
          <Link href="/" className="hover:text-[#7fb069]">Shop</Link>
          <span>/</span>
          <span>{product.category}</span>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#141618] shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
            <div className="aspect-[4/3] bg-[#101214]">
              {product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-full w-full object-contain object-center p-4"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-bold text-[#a8b0b8]">
                  No image
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#d6c06f]">
                {product.category}
              </p>
              <h2 className="mt-2 text-3xl font-black leading-tight md:text-4xl">
                {product.name}
              </h2>
              {shopProductCardDescription(product) && (
                <p className="mt-3 text-base leading-7 text-[#a8b0b8]">
                  {shopProductCardDescription(product)}
                </p>
              )}
            </div>

            <ProductDetailClient product={product} />
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <article className="rounded-lg border border-white/[0.08] bg-[#141618] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
            <h2 className="text-2xl font-black">Product Details</h2>
            <div className="mt-4 whitespace-pre-line text-sm leading-7 text-[#c4c8cc]">
              {fullDescription || "Full product details are coming soon."}
            </div>
          </article>

          <aside className="rounded-lg border border-white/[0.08] bg-[#141618] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
            <h2 className="text-xl font-black">Source</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#a8b0b8]">
              {product.source_note || "From Crested Critters stock unless otherwise stated."}
            </p>
          </aside>
        </section>
      </div>
    </ShopShell>
  );
}
