import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCommunityCategories, type MarketplaceDetails } from "@/lib/community";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import CommunityDiscussionForm from "@/app/community/CommunityDiscussionForm";
import { updateCommunityDiscussion } from "@/app/community/actions";

export const metadata = {
  title: "Edit Discussion | Isopedia Community",
};

export default async function EditCommunityDiscussionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ form_error?: string }>;
}) {
  const [{ slug }, pageParams] = await Promise.all([params, searchParams]);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/community/discussion/${slug}/edit`);

  const { data: discussion } = await supabase
    .from("community_discussions")
    .select("id, title, body, category_id, author_id, slug")
    .eq("slug", slug)
    .maybeSingle<{
      id: string;
      title: string;
      body: string;
      category_id: string;
      author_id: string | null;
      slug: string;
    }>();

  if (!discussion) notFound();

  const [
    { data: profile },
    { data: adminProfile },
    categories,
    speciesResult,
    { data: marketplaceDetails },
    { data: linkedSpecies },
  ] =
    await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: string | null }>(),
      supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
      getCommunityCategories(supabase),
      supabase
        .from("isopedia_species")
        .select("id, common_name, scientific_name")
        .order("common_name", { ascending: true })
        .returns<Array<{ id: number; common_name: string; scientific_name: string | null }>>(),
      supabase
        .from("marketplace_listing_details")
        .select(
          "discussion_id, listing_type, listing_status, species_or_product, quantity, price, location, state, shipping_available, local_pickup_available, expo_name, expiration_date, preferred_contact_method, permit_notes"
        )
        .eq("discussion_id", discussion.id)
        .maybeSingle<MarketplaceDetails>(),
      supabase
        .from("community_discussion_species")
        .select("species_id")
        .eq("discussion_id", discussion.id)
        .returns<Array<{ species_id: number }>>(),
    ]);

  const canEdit =
    discussion.author_id === user.id ||
    Boolean(adminProfile) ||
    profile?.role === "admin" ||
    profile?.role === "moderator";

  if (!canEdit) redirect(`/community/discussion/${discussion.slug}`);

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-4xl">
        <IsopediaNav active="community" />
        <div className="mb-4">
          <Link
            href={`/community/discussion/${discussion.slug}`}
            className="text-sm text-emerald-300 underline"
          >
            Back to Discussion
          </Link>
        </div>
        <section className="rounded-lg border border-white/10 bg-[#102016] p-5 sm:p-7">
          <h1 className="text-3xl font-black text-white">Edit Discussion</h1>
          <div className="mt-6">
            <CommunityDiscussionForm
              action={updateCommunityDiscussion}
              categories={categories}
              species={speciesResult.data || []}
              initialDiscussion={discussion}
              selectedSpeciesIds={(linkedSpecies || []).map((row) => String(row.species_id))}
              initialMarketplace={marketplaceDetails}
              formError={pageParams.form_error || ""}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
