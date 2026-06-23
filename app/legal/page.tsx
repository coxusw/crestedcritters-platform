import Link from "next/link";
import { acceptIsopediaLegalDocuments } from "@/app/legal/actions";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import LegalDocumentViewer from "@/app/components/legal/LegalDocumentViewer";
import {
  ISOPEDIA_CONTENT_LICENSE_ACKNOWLEDGMENT,
  isopediaLegalDocuments,
} from "@/lib/isopedia-legal";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const metadata = {
  title: "Legal Documents",
  description: "Isopedia Terms, Privacy Policy, Community Guidelines, and User Generated Content Policy.",
};

export default async function LegalPage({
  searchParams,
}: {
  searchParams: Promise<{ accepted?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-[#07130c] px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <IsopediaNav active="legal" />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="rounded-xl border border-white/10 bg-[#102016] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#18291d]">
            Back to Isopedia
          </Link>
          {user ? (
            <Link href="/account" className="rounded-xl border border-white/10 bg-[#102016] px-4 py-2 text-sm font-bold">
              My Account
            </Link>
          ) : (
            <Link href="/signup" className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950">
              Create Account
            </Link>
          )}
        </div>

        {params.accepted === "true" && (
          <div className="mb-5 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4 text-sm font-bold text-emerald-100">
            Legal documents accepted.
          </div>
        )}

        {params.error && (
          <div className="mb-5 rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {decodeURIComponent(params.error)}
          </div>
        )}

        <LegalDocumentViewer documents={isopediaLegalDocuments} />

        {user && (
          <form
            action={acceptIsopediaLegalDocuments}
            className="mt-6 rounded-3xl border border-white/10 bg-[#102016] p-5 shadow-xl shadow-black/20"
          >
            <h2 className="text-2xl font-black">Accept Legal Documents</h2>
            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-emerald-50/80">
              <input
                name="content_license_acknowledgment"
                type="checkbox"
                required
                className="mt-1 h-5 w-5 rounded border-white/20 bg-black"
              />
              <span>{ISOPEDIA_CONTENT_LICENSE_ACKNOWLEDGMENT}</span>
            </label>
            <button className="mt-4 rounded-2xl bg-emerald-400 px-5 py-3 font-black text-slate-950 hover:bg-emerald-300">
              Accept Legal Documents
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
