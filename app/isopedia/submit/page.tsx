import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import { createSubmissionReviewAlertPost } from "@/lib/content-agent/isopedia";

type Profile = {
  id: string;
  username: string | null;
};

const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Expert"] as const;

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function slugifyFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getSafeImageExtension(file: File) {
  const nameExtension = file.name.split(".").pop()?.toLowerCase() || "";
  const mimeExtension = file.type.split("/").pop()?.toLowerCase() || "";

  const extension = nameExtension || mimeExtension || "jpg";

  if (extension === "jpeg") return "jpg";

  if (["jpg", "png", "webp", "gif"].includes(extension)) {
    return extension;
  }

  return "jpg";
}

async function uploadSubmissionImage({
  supabase,
  userId,
  commonName,
  imageFile,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  commonName: string;
  imageFile: File;
}) {
  if (!imageFile || imageFile.size === 0) return null;

  if (!imageFile.type.startsWith("image/")) {
    throw new Error("Uploaded file must be an image.");
  }

  const maxBytes = 10 * 1024 * 1024;

  if (imageFile.size > maxBytes) {
    throw new Error("Image must be under 10MB.");
  }

  const extension = getSafeImageExtension(imageFile);
  const safeName = slugifyFilePart(commonName) || "species-submission";
  const filePath = `species-submissions/${userId}/${Date.now()}-${safeName}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("isopedia-images")
    .upload(filePath, imageFile, {
      cacheControl: "3600",
      upsert: false,
      contentType: imageFile.type || "image/jpeg",
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrlData } = supabase.storage
    .from("isopedia-images")
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl || null;
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

  const organismType = cleanText(formData.get("organism_type"));
  const genus = cleanText(formData.get("genus"));
  const species = cleanText(formData.get("species"));
  const morph = cleanText(formData.get("morph"));
  const commonName = cleanText(formData.get("common_name"));
  const scientificName = cleanText(formData.get("scientific_name"));
  const tradeNames = cleanText(formData.get("trade_names"));
  const difficulty = cleanText(formData.get("difficulty"));
  const origin = cleanText(formData.get("origin"));
  const temperature = cleanText(formData.get("temperature"));
  const humidity = cleanText(formData.get("humidity"));
  const diet = cleanText(formData.get("diet"));
  const substrate = cleanText(formData.get("substrate"));
  const notes = cleanText(formData.get("notes"));
  const imageFile = formData.get("image_file");

  if (!commonName) {
    throw new Error("Common name is required.");
  }

  if (
    difficulty &&
    !DIFFICULTY_OPTIONS.includes(difficulty as (typeof DIFFICULTY_OPTIONS)[number])
  ) {
    throw new Error("Difficulty must be Beginner, Intermediate, or Expert.");
  }

  let imageUrl: string | null = null;

  if (imageFile instanceof File && imageFile.size > 0) {
    imageUrl = await uploadSubmissionImage({
      supabase,
      userId: user.id,
      commonName,
      imageFile,
    });
  }

  const submissionId = crypto.randomUUID();

  const { error } = await supabase.from("isopedia_submissions").insert({
    id: submissionId,
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
    image_url: imageUrl,
    submitted_by: user.id,
    status: "unverified",
  });

  if (error) {
    throw new Error(error.message);
  }

  try {
    await createSubmissionReviewAlertPost(submissionId);
  } catch (autoPostError) {
    console.error("Failed to auto-create Isopedia submission review alert:", autoPostError);
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

          <form
            action={submitSpecies}
            encType="multipart/form-data"
            className="grid gap-6 p-6 sm:p-8"
          >
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

                <DifficultyField />
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

                <ImageUploadField />
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

function DifficultyField() {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
        Difficulty
      </span>

      <select
        name="difficulty"
        defaultValue=""
        className="rounded-2xl border border-white/10 bg-[#102016] px-4 py-3 text-white outline-none transition focus:border-emerald-400/40"
      >
        <option value="" className="bg-[#102016] text-white">
          Select difficulty
        </option>
        {DIFFICULTY_OPTIONS.map((option) => (
          <option key={option} value={option} className="bg-[#102016] text-white">
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ImageUploadField() {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
        Upload Image Optional
      </span>

      <input
        type="file"
        name="image_file"
        accept="image/*"
        className="rounded-2xl border border-white/10 bg-[#102016] px-4 py-3 text-white outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-400 file:px-4 file:py-2 file:text-sm file:font-black file:text-slate-950 hover:file:bg-emerald-300"
      />

      <span className="text-xs text-emerald-50/45">
        Optional. JPG, PNG, WEBP, or GIF. Max 10MB.
      </span>
    </label>
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
