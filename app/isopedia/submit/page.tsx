import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import RichTextEditor from "@/app/components/isopedia/RichTextEditor";
import SpeciesImageUpload from "@/app/components/isopedia/SpeciesImageUpload";

type Profile = {
  id: string;
  username: string | null;
};

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function submitSpecies(formData: FormData) {
  "use server";

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

  const organism_type = cleanText(formData.get("organism_type")) || "Isopod";
  const genus = cleanText(formData.get("genus"));
  const species = cleanText(formData.get("species"));
  const morph = cleanText(formData.get("morph"));
  const trade_names = cleanText(formData.get("trade_names"));

  const common_name = cleanText(formData.get("common_name"));
  const scientific_name = cleanText(formData.get("scientific_name"));
  const difficulty = cleanText(formData.get("difficulty"));
  const origin = cleanText(formData.get("origin"));
  const temperature = cleanText(formData.get("temperature"));
  const humidity = cleanText(formData.get("humidity"));
  const diet = cleanText(formData.get("diet"));
  const substrate = cleanText(formData.get("substrate"));
  const notes = cleanText(formData.get("notes"));
  const image_url = cleanText(formData.get("image_url"));

  if (!common_name) {
    redirect("/isopedia/submit?error=common-name-required");
  }

  const slugBase = [genus, species, morph, common_name]
    .filter(Boolean)
    .join(" ");

  const slug = makeSlug(slugBase || common_name);

  const { error } = await supabase.from("isopedia_submissions").insert({
    submitted_by: user.id,

    organism_type,
    genus,
    species,
    morph,
    trade_names,

    common_name,
    scientific_name,
    slug,
    difficulty,
    origin,
    temperature,
    humidity,
    diet,
    substrate,
    notes,
    image_url,
    status: "unverified",
    updated_at: new Date().toISOString(),
  });

  if (error) {
    redirect("/isopedia/submit?error=save-failed");
  }

  revalidatePath("/isopedia");
  redirect("/isopedia/submit?submitted=true");
}

export default async function SubmitSpeciesPage({
  searchParams,
}: {
  searchParams: Promise<{
    submitted?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
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
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link
            href="/isopedia"
            className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
          >
            ← Back to Isopedia
          </Link>
        </div>

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
            Community Submission
          </p>
          <h1 className="mt-2 text-4xl font-bold text-white">
            Submit Species Information
          </h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Your submission will be saved as unverified until a different
            logged-in contributor verifies it. Your profile will receive credit
            for the submission.
          </p>
        </div>

        {params.submitted === "true" && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
            Submission saved. It is now waiting for another contributor to
            verify it.
          </div>
        )}

        {params.error === "common-name-required" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Common name is required.
          </div>
        )}

        {params.error === "save-failed" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            Submission could not be saved. Please try again.
          </div>
        )}

        <form
          action={submitSpecies}
          className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-xl shadow-black/20"
        >
          <div className="grid gap-8">
            <section className="grid gap-5">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Taxonomy / ID
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Keep this practical for keepers: type, genus, species, morph,
                  and trade names.
                </p>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-200">
                  Organism Type *
                </span>
                <select
                  name="organism_type"
                  defaultValue="Isopod"
                  className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                  required
                >
                  <option value="Isopod">Isopod</option>
                  <option value="Springtail">Springtail</option>
                  <option value="Millipede">Millipede</option>
                  <option value="Beetle">Beetle</option>
                </select>
              </label>

              <div className="grid gap-5 sm:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    Genus
                  </span>
                  <input
                    name="genus"
                    placeholder="Example: Cubaris"
                    className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    Species
                  </span>
                  <input
                    name="species"
                    placeholder="Example: sp."
                    className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    Morph
                  </span>
                  <input
                    name="morph"
                    placeholder="Example: Rubber Ducky"
                    className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-200">
                  Trade Names / Search Names
                </span>
                <input
                  name="trade_names"
                  placeholder="Example: Ducky, Rubber Duckies, Yellow Ducky"
                  className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                />
              </label>
            </section>

            <section className="grid gap-5">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Public Display Info
                </h2>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-200">
                  Common Name *
                </span>
                <input
                  name="common_name"
                  placeholder="Example: Rubber Ducky"
                  className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                  required
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-200">
                  Scientific Name
                </span>
                <input
                  name="scientific_name"
                  placeholder="Example: Cubaris sp."
                  className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                />
              </label>

              <SpeciesImageUpload />
            </section>

            <section className="grid gap-5">
              <div>
                <h2 className="text-2xl font-bold text-white">Care Info</h2>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    Difficulty
                  </span>
                  <input
                    name="difficulty"
                    placeholder="Beginner, Intermediate, Advanced"
                    className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    Origin
                  </span>
                  <input
                    name="origin"
                    placeholder="Example: Thailand"
                    className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                  />
                </label>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    Temperature
                  </span>
                  <input
                    name="temperature"
                    placeholder="Example: 72–78°F"
                    className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    Humidity
                  </span>
                  <input
                    name="humidity"
                    placeholder="Example: Medium-high humidity"
                    className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-200">
                  Diet
                </span>
                <textarea
                  name="diet"
                  rows={3}
                  placeholder="Foods, supplements, protein, calcium, botanicals, etc."
                  className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-200">
                  Substrate
                </span>
                <textarea
                  name="substrate"
                  rows={3}
                  placeholder="Substrate depth, leaf litter, moss, bark, ventilation, etc."
                  className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                />
              </label>

              <div className="grid gap-2">
                <span className="text-sm font-medium text-slate-200">
                  Care Notes
                </span>
                <RichTextEditor name="notes" defaultValue="" />
              </div>
            </section>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-400">
              Submitting as{" "}
              <Link
                href={`/isopedia/profile/${profile.username}`}
                className="font-semibold text-emerald-300 hover:text-emerald-200"
              >
                @{profile.username}
              </Link>
            </p>

            <button
              type="submit"
              className="rounded-xl bg-emerald-400 px-6 py-3 font-bold text-slate-950 transition hover:bg-emerald-300"
            >
              Submit for Verification
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}