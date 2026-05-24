import ShopShell from "../ShopShell";
import { unsubscribeShopEmailAction } from "./actions";

type PageProps = {
  searchParams?: Promise<{
    email?: string;
    token?: string;
    status?: string;
  }>;
};

export default async function ShopUnsubscribePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const email = String(params?.email || "");
  const token = String(params?.token || "");
  const status = String(params?.status || "");

  return (
    <ShopShell>
      <section className="mx-auto max-w-2xl rounded-md border border-white/[0.08] bg-[#111315] p-6">
        <h2 className="text-2xl font-black text-white">Unsubscribe</h2>
        {status === "done" ? (
          <p className="mt-4 leading-7 text-[#a8b0b8]">
            You have been unsubscribed from Crested Critters updates.
          </p>
        ) : status === "invalid" ? (
          <p className="mt-4 rounded-md border border-red-300/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            This unsubscribe link is invalid or expired.
          </p>
        ) : (
          <>
            <p className="mt-3 leading-7 text-[#a8b0b8]">
              You can unsubscribe from Crested Critters updates here. Your email stays on our order contact list,
              but it will no longer receive marketing updates.
            </p>

            {status === "error" && (
              <p className="mt-4 rounded-md border border-red-300/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
                Something went wrong while unsubscribing. Please try again.
              </p>
            )}

            <form action={unsubscribeShopEmailAction} className="mt-5 grid gap-4">
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="token" value={token} />
              <label className="block text-sm font-bold text-[#a8b0b8]">
                Email
                <input
                  value={email}
                  readOnly
                  className="mt-1 w-full rounded-md border border-white/[0.08] bg-[#0b0c0d] px-3 py-2 text-[#e9ecef]"
                />
              </label>
              <label className="block text-sm font-bold text-[#a8b0b8]">
                Reason, optional
                <textarea
                  name="reason"
                  rows={4}
                  placeholder="Optional"
                  className="mt-1 w-full rounded-md border border-white/[0.08] bg-[#0b0c0d] px-3 py-2 text-[#e9ecef] placeholder:text-[#6f7780]"
                />
              </label>
              <button className="w-fit rounded-md bg-[#7fb069] px-5 py-3 font-black text-[#0b0d0b] hover:bg-[#92c37d]">
                Unsubscribe
              </button>
            </form>
          </>
        )}
      </section>
    </ShopShell>
  );
}
