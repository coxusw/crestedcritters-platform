import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type Props = {
  active?:
    | "database"
    | "expos"
    | "submit"
    | "review"
    | "profile"
    | "admin"
    | "none";
};

const mainNavItems = [
  {
    label: "Database",
    href: "/isopedia",
    key: "database",
  },
  {
    label: "Expos",
    href: "/isopedia/expos",
    key: "expos",
  },
  {
    label: "Submit Species",
    href: "/isopedia/submit",
    key: "submit",
  },
  {
    label: "Review",
    href: "/isopedia/review",
    key: "review",
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

  if (user) {
    const [{ data: profile }, { data: adminProfile }] =
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
      ]);

    username = profile?.username || null;

    canAccessAdmin =
      Boolean(adminProfile) ||
      profile?.role === "admin" ||
      profile?.role === "moderator";
  }

  const profileHref = username
    ? `/profile/${username}`
    : "/account";

  return (
    <header className="mb-8 rounded-3xl border border-white/10 bg-[#142318]/95 p-4 shadow-2xl shadow-black/25 backdrop-blur">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <Link
            href="/isopedia"
            className="group inline-flex flex-col"
          >
            <span className="text-2xl font-black tracking-tight text-white transition group-hover:text-emerald-200">
              Isopedia
            </span>

            <span className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-100/40">
              Bioactive Community Database
            </span>
          </Link>
        </div>

        <nav className="flex flex-wrap gap-2">
          {mainNavItems.map((item) => {
            const isActive = active === item.key;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                  isActive
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                    : "border-white/10 bg-[#0b140d] text-emerald-50/80 hover:border-emerald-400/30 hover:bg-[#102016] hover:text-emerald-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          {user && (
            <Link
              href={profileHref}
              className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                active === "profile"
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                  : "border-white/10 bg-[#0b140d] text-emerald-50/80 hover:border-emerald-400/30 hover:bg-[#102016] hover:text-emerald-200"
              }`}
            >
              My Profile
            </Link>
          )}

          {canAccessAdmin && (
            <Link
              href="/admin/isopedia"
              className={`rounded-xl border px-4 py-2 text-sm font-black transition ${
                active === "admin"
                  ? "border-amber-300/40 bg-amber-300/15 text-amber-100"
                  : "border-amber-300/25 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20"
              }`}
            >
              Admin Panel
            </Link>
          )}

          {user ? (
            <Link
              href="/logout"
              className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-2 text-sm font-black text-red-100 transition hover:bg-red-400/20"
            >
              Logout
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}