import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { deleteExpo } from "@/app/admin/isopedia/expos/actions";

type ExpoRow = {
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
  created_at: string;
  submitted_by_profile: {
    username: string | null;
    display_name: string | null;
    business_name: string | null;
  } | null;
};

type PageProps = {
  searchParams?: Promise<{
    updated?: string;
    deleted?: string;
  }>;
};

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

    supabase
      .from("admin_profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const canModerate =
    Boolean(adminProfile) ||
    profile?.role === "admin" ||
    profile?.role === "moderator";

  if (!canModerate) redirect("/admin/isopedia");

  return { supabase, user };
}

async function approveExpo(formData: FormData) {
  "use server";

  const { supabase, user } = await requireModerator();

  const expoId = String(formData.get("expo_id") || "");

  if (!expoId) throw new Error("Missing expo id.");

  const { error } = await supabase
    .from("isopedia_expos")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", expoId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/isopedia/expos");
  revalidatePath("/admin/isopedia");
  revalidatePath("/isopedia/expos");
}

async function rejectExpo(formData: FormData) {
  "use server";

  const { supabase, user } = await requireModerator();

  const expoId = String(formData.get("expo_id") || "");

  if (!expoId) throw new Error("Missing expo id.");

  const { error } = await supabase
    .from("isopedia_expos")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", expoId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/isopedia/expos");
  revalidatePath("/admin/isopedia");
  revalidatePath("/isopedia/expos");
}

function displayName(
  profile:
    | {
        username: string | null;
        display_name: string | null;
        business_name: string | null;
      }
    | null
) {
  return (
    profile?.display_name ||
    profile?.business_name ||
    profile?.username ||
    "Unknown user"
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusClasses(status: ExpoRow["status"]) {
  if (status === "approved") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "rejected") {
    return "border-red-400/30 bg-red-400/10 text-red-200";
  }

  return "border-amber-400/30 bg-amber-400/10 text-amber-200";
}

export default async function AdminExpoReviewPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const { supabase } = await requireModerator();

  const { data: expos, error } = await supabase
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
      status,
      created_at,
      submitted_by_profile:submitted_by (
        username,
        display_name,
        business_name
      )
    `
    )
    .order("created_at", { ascending: false })
    .returns<ExpoRow[]>();

  if (error) throw new Error(error.message);

  const allExpos = expos || [];
  const pending = allExpos.filter((expo) => expo.status === "pending");
  const approved = allExpos.filter((expo) => expo.status === "approved");
  const rejected = allExpos.filter((expo) => expo.status === "rejected");

  return (
    <main className="min-h-screen bg-[#0c1710] px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-3xl border border-white/10 bg-[#142318] p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
                Isopedia Admin
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
                Expo Manager
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/65">
                Approve, reject, edit, delete, and manage community-submitted
                expo calendar entries.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/isopedia"
                className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-3 text-sm font-bold text-emerald-200 transition hover:bg-[#18291d]"
              >
                ← Admin Dashboard
              </Link>

              <Link
                href="/isopedia/expos"
                className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Public Calendar
              </Link>
            </div>
          </div>
        </div>

        {params?.updated === "true" && (
          <Notice text="Expo updated successfully." type="success" />
        )}

        {params?.deleted === "true" && (
          <Notice text="Expo deleted successfully." type="success" />
        )}

        <section className="mb-8 grid gap-4 sm:grid-cols-4">
          <StatCard label="Total" value={allExpos.length} />
          <StatCard label="Pending" value={pending.length} />
          <StatCard label="Approved" value={approved.length} />
          <StatCard label="Rejected" value={rejected.length} />
        </section>

        <section className="grid gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
              All Expo Entries
            </p>

            <h2 className="mt-2 text-3xl font-black text-white">
              Expo Management
            </h2>
          </div>

          {allExpos.length > 0 ? (
            allExpos.map((expo) => (
              <ExpoCard key={expo.id} expo={expo} />
            ))
          ) : (
            <EmptyCard text="No expo submissions yet." />
          )}
        </section>
      </div>
    </main>
  );
}

function ExpoCard({ expo }: { expo: ExpoRow }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-[#142318] shadow-xl shadow-black/20">
      {expo.flyer_image_url && (
        <div className="border-b border-white/10 bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={expo.flyer_image_url}
            alt={`${expo.name} flyer`}
            className="max-h-[420px] w-full object-contain"
          />
        </div>
      )}

      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-2xl font-black text-white">{expo.name}</h3>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-black ${statusClasses(
                  expo.status
                )}`}
              >
                {expo.status}
              </span>
            </div>

            <p className="mt-2 text-sm text-emerald-50/60">
              {expo.city}, {expo.state}
              {expo.venue ? ` · ${expo.venue}` : ""}
            </p>

            <p className="mt-2 text-sm text-emerald-50/60">
              Starts: {formatDateTime(expo.starts_at)}
            </p>

            {expo.ends_at && (
              <p className="mt-1 text-sm text-emerald-50/60">
                Ends: {formatDateTime(expo.ends_at)}
              </p>
            )}

            <p className="mt-2 text-sm text-emerald-50/50">
              Submitted by {displayName(expo.submitted_by_profile)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {expo.status === "approved" && (
              <Link
                href={`/isopedia/expos/${expo.slug}`}
                className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-2 text-sm font-bold text-emerald-200 transition hover:bg-[#18291d]"
              >
                View
              </Link>
            )}

            <Link
              href={`/admin/isopedia/expos/${expo.id}/edit`}
              className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#18291d]"
            >
              Edit
            </Link>
          </div>
        </div>

        {expo.description && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#0b140d] p-4">
            <p className="whitespace-pre-wrap text-sm leading-7 text-emerald-50/70">
              {expo.description}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {expo.status !== "approved" && (
            <form action={approveExpo}>
              <input type="hidden" name="expo_id" value={expo.id} />

              <button
                type="submit"
                className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-200 transition hover:bg-emerald-400/20"
              >
                Approve
              </button>
            </form>
          )}

          {expo.status !== "rejected" && (
            <form action={rejectExpo}>
              <input type="hidden" name="expo_id" value={expo.id} />

              <button
                type="submit"
                className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-black text-red-200 transition hover:bg-red-400/20"
              >
                Reject
              </button>
            </form>
          )}

          <form action={deleteExpo}>
            <input type="hidden" name="expo_id" value={expo.id} />

            <button
              type="submit"
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-black text-red-100 transition hover:bg-red-500/20"
            >
              Delete Expo
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#142318] p-5 shadow-xl shadow-black/20">
      <p className="text-xs font-black uppercase tracking-widest text-emerald-100/40">
        {label}
      </p>

      <p className="mt-3 text-4xl font-black text-white">{value}</p>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#142318] p-8 text-center shadow-xl shadow-black/20">
      <p className="text-emerald-50/60">{text}</p>
    </div>
  );
}

function Notice({ text, type }: { text: string; type: "success" | "error" }) {
  return (
    <div
      className={`mb-6 rounded-2xl border p-4 text-sm font-bold ${
        type === "success"
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          : "border-red-400/30 bg-red-400/10 text-red-200"
      }`}
    >
      {text}
    </div>
  );
}