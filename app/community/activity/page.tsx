import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";

export const metadata = { title: "Community Activity | Isopedia" };

type ActivityItem = {
  type: string;
  title: string;
  href: string;
  createdAt: string | null;
};

export default async function CommunityActivityPage() {
  const supabase = await createSupabaseServerClient();

  const [discussions, species, expos] = await Promise.all([
    supabase
      .from("community_discussions")
      .select("title, slug, content_type, created_at")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<Array<{ title: string; slug: string; content_type: string; created_at: string | null }>>(),
    supabase
      .from("isopedia_species")
      .select("common_name, slug, created_at")
      .order("created_at", { ascending: false })
      .limit(12)
      .returns<Array<{ common_name: string; slug: string; created_at: string | null }>>(),
    supabase
      .from("isopedia_expos")
      .select("name, slug, created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(12)
      .returns<Array<{ name: string; slug: string; created_at: string | null }>>(),
  ]);

  const items: ActivityItem[] = [
    ...(discussions.data || []).map((item) => ({
      type: item.content_type,
      title: item.title,
      href: `/community/discussion/${item.slug}`,
      createdAt: item.created_at,
    })),
    ...(species.data || []).map((item) => ({
      type: "species",
      title: item.common_name,
      href: `/${item.slug}`,
      createdAt: item.created_at,
    })),
    ...(expos.data || []).map((item) => ({
      type: "expo",
      title: item.name,
      href: `/isopedia/expos/${item.slug}`,
      createdAt: item.created_at,
    })),
  ].sort((left, right) => {
    return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
  });

  return (
    <main className="min-h-screen bg-[#07130c] px-3 py-4 text-white sm:px-4 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <IsopediaNav active="community" />
        <div className="mb-4">
          <Link href="/community" className="text-sm text-emerald-300 underline">
            Back to Community
          </Link>
        </div>
        <header className="rounded-lg border border-white/10 bg-[#102016] p-5">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
            What&apos;s New
          </p>
          <h1 className="mt-3 text-3xl font-black text-white">Community Activity</h1>
          <p className="mt-3 text-sm leading-6 text-emerald-50/65">
            Recent public activity across Isopedia discussions, species, and expos.
          </p>
        </header>
        <section className="mt-6 grid gap-3">
          {items.length ? (
            items.map((item) => (
              <Link
                key={`${item.type}:${item.href}`}
                href={item.href}
                className="rounded-lg border border-white/10 bg-white/[0.05] p-4 hover:border-emerald-300/40"
              >
                <div className="text-xs font-black uppercase tracking-wide text-emerald-300">
                  {item.type}
                </div>
                <div className="mt-1 font-black text-white">{item.title}</div>
                <div className="mt-1 text-xs text-emerald-50/45">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : "Recently"}
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
              <h2 className="text-xl font-black text-white">No recent activity yet.</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-emerald-50/60">
                New discussions, species, and approved expos will show here as the
                community grows.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link
                  href="/community/new"
                  className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-300"
                >
                  Start a Discussion
                </Link>
                <Link
                  href="/isopedia"
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/10"
                >
                  Browse Isopedia
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
