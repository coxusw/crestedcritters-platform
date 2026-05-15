import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";

type Profile = {
  id: string;
  username: string | null;
};

async function submitSpecies(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/isopedia/submit");
  }

  const organismType = String(formData.get("organism_type") || "").trim();
  const genus = String(formData.get("genus") || "").trim();
  const species = String(formData.get("species") || "").trim();
  const morph = String(formData.get("morph") || "").trim();
  const commonName = String(formData.get("common_name") || "").trim();
  const scientificName = String(formData.get("scientific_name") || "").trim();
  const tradeNames = String(formData.get("trade_names") || "").trim();
  const difficulty = String(formData.get("difficulty") || "").trim();
  const origin = String(formData.get("origin") || "").trim();
  const temperature = String(formData.get("temperature") || "").trim();
  const humidity = String(formData.get("humidity") || "").trim();
  const diet = String(formData.get("diet") || "").trim();
  const substrate = String(formData.get("substrate") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const imageUrl = String(formData.get("image_url") || "").trim();

  if (!commonName) {
    throw new Error("Common name is required.");
  }

  const { error } = await supabase.from("isopedia_submissions").insert({
    organism_type: organismType || null,
    genus: genus || null,
    species: species || null,
    morph: morph || null,
    common_name: commonName,
    scientific_name: scientificName || null,
    trade_names: tradeNames || null,
    difficulty: difficulty || null,
    origin: origin || null,
    temperature: temperature || null,
    humidity: humidity || null,
    diet: diet || null,
    substrate: substrate || null,
    notes: notes || null,
    image_url: imageUrl || null,
    submitted_by: user.id,
    status: "unverified",
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/isopedia?submitted=true");
}

export default async function SubmitSpeciesPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/isopedia/submit");
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

          <form action={submitSpecies} className="grid gap-6 p-6 sm:p-8">
            <section className="grid gap-5 rounded-3xl border border-white/10 bg-[#07130c]/70 p-5">
              <div className="text-center">
                <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
                  Identity
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  Species Information
                </h2>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Organism Type"
                  name="organism_type"
                  placeholder="Isopod, Springtail, Millipede, Beetle..."
                />

                <Field
                  label="Common Name"
                  name="common_name"
                  required
                  placeholder="Rubber Ducky, Dairy Cow, Orange Springtail..."
                />

                <Field
                  label="Scientific Name"
                  name="scientific_name"
                  placeholder="Cubaris sp., Porcellio laevis..."
                />

                <Field
                  label="Trade Names"
                  name="trade_names"
                  placeholder="Other hobby names, line names, aliases..."
                />

                <Field label="Genus" name="genus" placeholder="Cubaris" />

                <Field
                  label="Species"
                  name="species"
                  placeholder="sp., murina, laevis..."
                />

                <Field
                  label="Morph"
                  name="morph"
                  placeholder="Rubber Ducky, Dairy Cow, Orange..."
                />

                <Field
                  label="Difficulty"
                  name="difficulty"
                  placeholder="Beginner, Intermediate, Advanced..."
                />
              </div>
            </section>

            <section className="grid gap-5 rounded-3xl border border-white/10 bg-[#07130c]/70 p-5">
              <div className="text-center">
                <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
                  Care
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  Husbandry Details
                </h2>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Origin"
                  name="origin"
                  placeholder="Country/region if known"
                />

                <Field
                  label="Temperature"
                  name="temperature"
                  placeholder="Example: 70–76°F"
                />

                <Field
                  label="Humidity"
                  name="humidity"
                  placeholder="Example: Moist gradient, 60–80%"
                />

                <Field
                  label="Diet"
                  name="diet"
                  placeholder="Leaf litter, protein, vegetables..."
                />

                <Field
                  label="Substrate"
                  name="substrate"
                  placeholder="Organic soil, leaf litter, rotting wood..."
                />

                <Field
                  label="Image URL Optional"
                  name="image_url"
                  placeholder="Optional image URL for review"
                />
              </div>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
                  Notes
                </span>

                <textarea
                  name="notes"
                  rows={8}
                  placeholder="Care notes, breeding notes, behavior, warnings, keeper observations..."
                  className="rounded-2xl border border-white/10 bg-[#102016] px-4 py-3 text-white outline-none transition placeholder:text-emerald-50/30 focus:border-emerald-400/40"
                />
              </label>
            </section>

            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-center text-sm leading-6 text-amber-100">
              Species submissions are community-reviewed before becoming public.
              Please submit only information you believe is accurate and helpful.
            </div>

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link
                href="/isopedia"
                className="rounded-2xl border border-white/10 bg-[#07130c] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#102016]"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Submit for Review
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
        {label}
      </span>

      <input
        name={name}
        required={required}
        placeholder={placeholder}
        className="rounded-2xl border border-white/10 bg-[#102016] px-4 py-3 text-white outline-none transition placeholder:text-emerald-50/30 focus:border-emerald-400/40"
      />
    </label>
  );
}