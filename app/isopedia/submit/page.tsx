import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import SubmitSpeciesForm from "./SubmitSpeciesForm";

type Profile = {
  id: string;
  username: string | null;
};

export default async function SubmitSpeciesPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/submit");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!profile?.username) {
    redirect("/account?error=profile-required");
  }

  return (
    <main className="min-h-screen bg-[#07130c] px-4 py-6 text-white sm:py-10">
      <div className="mx-auto max-w-7xl">
        <IsopediaNav active="submit" />

        <section className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#102016] shadow-2xl shadow-black/30">
          <div className="bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_36%),linear-gradient(135deg,rgba(6,78,59,0.48),rgba(7,19,12,0.95))] px-6 py-8 sm:px-10 sm:py-10">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-300 sm:text-sm">
                Community Submission
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-6xl">
                Submit a Species
              </h1>

              <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-emerald-50/80 sm:text-lg">
                Add a new species, morph, or bioactive cleanup crew entry to
                the community review queue. Submissions must be verified before
                becoming public.
              </p>
            </div>
          </div>

          <SubmitSpeciesForm userId={user.id} />
        </section>
      </div>
    </main>
  );
}
