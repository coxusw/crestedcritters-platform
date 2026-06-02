import Link from "next/link";
import { absoluteRandomizerUrl } from "@/lib/randomizer-site";
import VerifyResultClient from "./VerifyResultClient";

export const metadata = {
  title: { absolute: "Verify Randomizer Result" },
  description: "Verify an official Crested Critters Randomizer result by code.",
  alternates: {
    canonical: absoluteRandomizerUrl("/verify"),
  },
  openGraph: {
    title: "Verify Randomizer Result",
    description: "Verify an official Crested Critters Randomizer result by code.",
    url: absoluteRandomizerUrl("/verify"),
    images: [absoluteRandomizerUrl("/randomizer-preview.svg")],
  },
};

export default function VerifyRandomizerResultPage() {
  return (
    <main className="min-h-screen bg-[#07130c] px-4 py-8 text-white">
      <div className="mx-auto max-w-xl">
        <header className="mb-6 rounded-2xl border border-white/10 bg-white/[0.06] p-6 text-center shadow-2xl shadow-black/20">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-300">
            Randomizer
          </p>
          <h1 className="mt-2 text-4xl font-black">Verify Result</h1>
          <p className="mt-3 leading-7 text-emerald-50/70">
            Enter the public verification code from an official Randomizer result.
          </p>
        </header>

        <VerifyResultClient />

        <div className="mt-5 text-center">
          <Link className="font-black text-emerald-300 hover:text-emerald-200" href="/randomizer">
            Back to Randomizer
          </Link>
        </div>
      </div>
    </main>
  );
}
