import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { updateExpo } from "@/app/admin/isopedia/expos/actions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Expo = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  venue: string | null;
  starts_at: string;
  ends_at: string | null;
  description: string | null;
  flyer_image_url: string | null;
  status: "pending" | "approved" | "rejected";
};

const STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

async function requireModerator() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const [{ data: profile }, { data: adminProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role: string | null }>(),

    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
  ]);

  const canModerate =
    Boolean(adminProfile) ||
    profile?.role === "admin" ||
    profile?.role === "moderator";

  if (!canModerate) redirect("/admin/isopedia");

  return supabase;
}

function toDatetimeLocal(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);

  return local.toISOString().slice(0, 16);
}

export default async function EditExpoPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await requireModerator();

  const { data: expo, error } = await supabase
    .from("isopedia_expos")
    .select(
      `
      id,
      name,
      slug,
      city,
      state,
      venue,
      starts_at,
      ends_at,
      description,
      flyer_image_url,
      status
    `
    )
    .eq("id", id)
    .maybeSingle<Expo>();

  if (error || !expo) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#0c1710] px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/isopedia/expos"
            className="text-sm font-bold text-emerald-300 hover:text-emerald-200"
          >
            ← Back to Expo Manager
          </Link>

          {expo.status === "approved" && (
            <Link
              href={`/isopedia/expos/${expo.slug}`}
              className="rounded-xl border border-white/10 bg-[#142318] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#18291d]"
            >
              View Public Page
            </Link>
          )}
        </div>

        <section className="rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-2xl shadow-black/30 sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
            Expo Manager
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
            Edit Expo
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/65">
            Update expo details, replace flyer image, or change approval status.
          </p>

          {expo.flyer_image_url && (
            <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={expo.flyer_image_url}
                alt={`${expo.name} flyer`}
                className="max-h-[560px] w-full object-contain"
              />
            </div>
          )}

          <form action={updateExpo} className="mt-8 grid gap-5">
            <input type="hidden" name="expo_id" value={expo.id} />
            <input
              type="hidden"
              name="current_flyer_url"
              value={expo.flyer_image_url || ""}
            />

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
                Expo Name
              </span>

              <input
                name="name"
                required
                minLength={3}
                maxLength={160}
                defaultValue={expo.name}
                className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-[1fr_180px]">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
                  City / Town
                </span>

                <input
                  name="city"
                  required
                  maxLength={120}
                  defaultValue={expo.city}
                  className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
                  State
                </span>

                <select
                  name="state"
                  required
                  defaultValue={expo.state}
                  className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
                >
                  {STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
                Venue Optional
              </span>

              <input
                name="venue"
                maxLength={180}
                defaultValue={expo.venue || ""}
                className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
                  Start Date / Time
                </span>

                <input
                  type="datetime-local"
                  name="starts_at"
                  required
                  defaultValue={toDatetimeLocal(expo.starts_at)}
                  className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
                  End Date / Time Optional
                </span>

                <input
                  type="datetime-local"
                  name="ends_at"
                  defaultValue={toDatetimeLocal(expo.ends_at)}
                  className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
                Status
              </span>

              <select
                name="status"
                required
                defaultValue={expo.status}
                className="rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>

            <div className="grid gap-3 rounded-3xl border border-white/10 bg-[#0b140d] p-5">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
                  Replace Flyer Optional
                </span>

                <input
                  type="file"
                  name="flyer_image"
                  accept="image/jpeg,image/png,image/webp"
                  className="rounded-2xl border border-white/10 bg-[#142318] px-4 py-3 text-sm text-white outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-400 file:px-4 file:py-2 file:text-sm file:font-black file:text-slate-950 hover:file:bg-emerald-300"
                />

                <span className="text-xs leading-5 text-emerald-50/45">
                  Optional JPG, PNG, or WEBP. Maximum 5MB.
                </span>
              </label>

              {expo.flyer_image_url && (
                <label className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-4">
                  <input
                    type="checkbox"
                    name="remove_flyer"
                    className="mt-1 h-4 w-4"
                  />

                  <span>
                    <span className="block text-sm font-bold text-red-100">
                      Remove current flyer
                    </span>

                    <span className="mt-1 block text-sm text-red-50/65">
                      This removes the flyer URL from the expo entry.
                    </span>
                  </span>
                </label>
              )}
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-100/50">
                Description
              </span>

              <textarea
                name="description"
                maxLength={4000}
                defaultValue={expo.description || ""}
                className="min-h-[180px] rounded-2xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none focus:border-emerald-400/40"
              />
            </label>

            <div className="flex flex-wrap justify-between gap-3 pt-3">
              <Link
                href="/admin/isopedia/expos"
                className="rounded-2xl border border-white/10 bg-[#0b140d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#18291d]"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Save Expo Changes
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}