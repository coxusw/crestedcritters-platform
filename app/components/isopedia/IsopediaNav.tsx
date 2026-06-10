import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { filterReviewableGalleryImages } from "@/lib/isopedia-gallery-review";

type Props = {
  active?:
    | "database"
    | "expos"
    | "guides"
    | "submit"
    | "review"
    | "store"
    | "raffles"
    | "contact"
    | "legal"
    | "profile"
    | "admin"
    | "none";
};

const mainNavItems = [
  {
    label: "Database",
    href: "/",
    key: "database",
  },
  {
    label: "Expos",
    href: "/expos",
    key: "expos",
  },
  {
    label: "Guides",
    href: "/guides",
    key: "guides",
  },
  {
    label: "Submit New Species",
    href: "/submit",
    key: "submit",
  },
  {
    label: "Needed Reviews",
    href: "/review",
    key: "review",
  },
  {
    label: "IsoToken Store",
    href: "/isotoken-store",
    key: "store",
  },
  {
    label: "Raffles",
    href: "/raffles",
    key: "raffles",
  },
  {
    label: "Contact Us",
    href: "/contact",
    key: "contact",
  },
  {
    label: "Site Policies",
    href: "/legal",
    key: "legal",
  },
];

export default async function IsopediaNav({
  active = "none",
}: Props) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  let canAccessAdmin = false;
  let neededReviewCount = 0;

  if (user) {
    const [
      { data: profile },
      { data: adminProfile },
      submissionsResult,
      editsResult,
      imagesResult,
      verifiedImagesResult,
    ] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("username, role")
          .eq("id", user.id)
          .maybeSingle<{
            username: string | null;
            role: string | null;
          }>(),

        supabase
          .from("admin_profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("isopedia_submissions")
          .select("id", { count: "exact", head: true })
          .eq("status", "unverified"),

        supabase
          .from("isopedia_suggested_edits")
          .select("id", { count: "exact", head: true })
          .eq("status", "unverified"),

        supabase
          .from("isopedia_species_images")
          .select(
            `
            id,
            species_id,
            image_url,
            isopedia_species:species_id (
              image_url
            )
            `
          )
          .eq("status", "unverified"),

        supabase
          .from("isopedia_species_images")
          .select("species_id, image_url")
          .eq("status", "verified"),
      ]);

    username = profile?.username || null;
    neededReviewCount =
      (submissionsResult.count || 0) +
      (editsResult.count || 0) +
      filterReviewableGalleryImages(
        imagesResult.data,
        verifiedImagesResult.data
      ).length;

    canAccessAdmin =
      Boolean(adminProfile) ||
      profile?.role === "admin" ||
      profile?.role === "moderator";
  }

  const profileHref = username ? `/profile/${username}` : "/account";

  return (
    <header className="mb-6 rounded-3xl border border-white/10 bg-[#102016]/95 p-4 shadow-2xl shadow-black/25 backdrop-blur sm:mb-8 sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="text-center">
          <Link href="/" className="group inline-flex flex-col">
            <span className="text-3xl font-black tracking-tight text-white transition group-hover:text-emerald-200 sm:text-4xl">
              Isopedia
            </span>

            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-100/40 sm:text-xs">
              Bioactive Community Database
            </span>
          </Link>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-2">
          {mainNavItems.map((item) => {
            const isActive = active === item.key;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={`relative rounded-xl border px-4 py-2 text-sm font-black transition ${
                  isActive
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                    : "border-white/10 bg-[#07130c] text-white hover:bg-[#18291d]"
                }`}
              >
                {item.label}
                {item.key === "review" && neededReviewCount > 0 && (
                  <span className="absolute -right-2 -top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[11px] font-black leading-none text-white shadow-lg shadow-red-950/40 ring-2 ring-[#102016]">
                    {neededReviewCount > 99 ? "99+" : neededReviewCount}
                  </span>
                )}
              </Link>
            );
          })}

          {user && (
            <>
              <Link
                href={profileHref}
                className={`rounded-xl border px-4 py-2 text-sm font-black transition ${
                  active === "profile"
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                    : "border-white/10 bg-[#07130c] text-white hover:bg-[#18291d]"
                }`}
              >
                My Profile
              </Link>
              <Link
                href="/account?tab=settings"
                className="rounded-xl border border-white/10 bg-[#07130c] px-4 py-2 text-sm font-black text-white transition hover:bg-[#18291d]"
              >
                Settings
              </Link>
            </>
          )}

          {canAccessAdmin && (
            <Link
              href="/admin/isopedia"
              className={`rounded-xl border px-4 py-2 text-sm font-black transition ${
                active === "admin"
                  ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                  : "border-amber-400/20 bg-amber-400/5 text-amber-100 hover:bg-amber-400/10"
              }`}
            >
              Admin
            </Link>
          )}

          {user ? (
            <Link
              href="/logout"
              className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-2 text-sm font-black text-red-100 transition hover:bg-red-400/10"
            >
              Logout
            </Link>
          ) : (
            <>
              <Link
                href="/login?next=/"
                className="rounded-xl border border-white/10 bg-[#07130c] px-4 py-2 text-sm font-black text-white transition hover:bg-[#18291d]"
              >
                Sign In
              </Link>
              <Link
                href="/signup?next=/account?welcome=true"
                className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Create Account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
