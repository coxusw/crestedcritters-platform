import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import GuideSubmitForm from "@/app/isopedia/guides/submit/GuideSubmitForm";

export default async function SubmitGuidePage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/guides/submit");
  }

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <IsopediaNav active="guides" />

        <div className="mb-5">
          <Link
            href="/guides"
            className="text-sm font-bold text-emerald-300 hover:text-emerald-200"
          >
            Back to Guides
          </Link>
        </div>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#102016] shadow-2xl shadow-black/30">
          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_36%),linear-gradient(135deg,rgba(6,78,59,0.44),rgba(7,19,12,0.96))] p-5 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
              Community Guides
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
              Add Guide
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50/70 sm:text-base">
              Guides publish immediately and credit your public profile name.
            </p>
          </div>

          <GuideSubmitForm />
        </section>
      </div>
    </main>
  );
}
