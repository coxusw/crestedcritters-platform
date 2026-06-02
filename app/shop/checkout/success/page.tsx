import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { formatShopMoney } from "@/lib/shop";
import { reconcilePaidShopOrderById } from "@/lib/shop-order-fulfillment";

export const dynamic = "force-dynamic";

export default async function ShopCheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const params = await searchParams;
  const orderId = params.order || "";
  const order = orderId
    ? await reconcilePaidShopOrderById(orderId).catch(() => getOrder(orderId))
    : null;
  const isPaid = order?.status === "paid";

  return (
    <main className="min-h-screen bg-[#f5f1e8] px-4 py-8 text-[#172018]">
      <div className="mx-auto max-w-2xl rounded-lg border border-[#172018]/15 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#47715b]">
          Crested Critters Shop
        </p>
        <h1 className="mt-2 text-3xl font-black">Thank you for your order.</h1>
        <p className="mt-3 leading-7 text-[#405545]">
          {isPaid
            ? "Your payment was received. A confirmation email has been sent to the email entered at checkout."
            : "We received your order and Square is confirming the payment. We will send updates using the email entered at checkout."}
        </p>

        {order && (
          <div className="mt-5 rounded-md bg-[#f5f1e8] p-4">
            <div className="flex justify-between gap-3 text-sm">
              <span className="font-bold text-[#526355]">Order status</span>
              <span
                className={`font-black uppercase ${
                  isPaid ? "text-[#21633f]" : "text-[#8a5a00]"
                }`}
              >
                {order.status}
              </span>
            </div>
            <div className="mt-2 flex justify-between gap-3 text-sm">
              <span className="font-bold text-[#526355]">Total</span>
              <span className="font-black">{formatShopMoney(order.total_cents || 0)}</span>
            </div>
          </div>
        )}

        <Link
          href="/"
          className="mt-6 inline-flex rounded-md bg-[#22c58b] px-5 py-3 font-black text-[#07130c] hover:bg-[#31dda0]"
        >
          Back to Shop
        </Link>
      </div>
    </main>
  );
}

async function getOrder(id: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("shop_orders")
    .select("status,total_cents")
    .eq("id", id)
    .maybeSingle();

  return data;
}
