import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCommunityCategories } from "@/lib/community";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import CommunityDiscussionForm from "@/app/community/CommunityDiscussionForm";
import { createCommunityDiscussion } from "@/app/community/actions";

export const metadata = {
  title: "Start a Discussion | Isopedia Community",
};

export default async function NewCommunityDiscussionPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; species?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/community/new");

  const [categories, speciesResult] = await Promise.all([
    getCommunityCategories(supabase),
    supabase
      .from("isopedia_species")
      .select("id, common_name, scientific_name")
      .order("common_name", { ascending: true })
      .returns<Array<{ id: number; common_name: string; scientific_name: string | null }>>(),
  ]);

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-4xl">
        <IsopediaNav active="community" />
        <div className="mb-4">
          <Link href="/community" className="text-sm text-emerald-300 underline">
            Back to Community
          </Link>
        </div>
        <section className="rounded-lg border border-white/10 bg-[#102016] p-5 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
            Community
          </p>
          <h1 className="mt-3 text-3xl font-black text-white">Start a Discussion</h1>
          <p className="mt-3 text-sm leading-6 text-emerald-50/70">
            Choose the best category, add useful details, and tag related species
            so other keepers can find and help with your post.
          </p>
          <div className="mt-6">
            <CommunityDiscussionForm
              action={createCommunityDiscussion}
              categories={categories}
              species={speciesResult.data || []}
              selectedCategorySlug={params.category || ""}
              selectedSpeciesId={params.species || ""}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
