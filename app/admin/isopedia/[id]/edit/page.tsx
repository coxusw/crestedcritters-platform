import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../../../../lib/supabase-server";
import SpeciesForm from "../../SpeciesForm";
import { updateSpecies } from "../../actions";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditSpeciesPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/admin/login");

  const { data: species, error } = await supabase
    .from("isopedia_species")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !species) notFound();

  const boundUpdate = updateSpecies.bind(null, String(species.id), species.slug);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <Link
          href="/admin/isopedia"
          className="text-sm font-semibold text-emerald-700"
        >
          ← Back to Isopedia Admin
        </Link>

        <h1 className="mt-3 text-3xl font-bold">Edit Species</h1>
      </div>

      <SpeciesForm
        species={species}
        action={boundUpdate}
        submitLabel="Save Changes"
      />
    </main>
  );
}