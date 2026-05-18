import Link from "next/link";
import ContentAgentDashboard from "./ContentAgentDashboard";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { getDashboardCounts, getRecentPosts } from "@/lib/content-agent/db";

type PageProps = {
  searchParams?: Promise<{
    notice?: string;
    error?: string;
  }>;
};

export default async function ContentAgentAdminPage({ searchParams }: PageProps) {
  await requireContentAgentAdmin();

  const params = await searchParams;

  const [counts, posts] = await Promise.all([
    getDashboardCounts(),
    getRecentPosts(50),
  ]);

  return (
    <>
      <div className="bg-slate-950 px-4 pt-4 text-sm">
        <Link className="text-emerald-300 underline" href="/admin">
          Back to Admin Dashboard
        </Link>
      </div>
      <ContentAgentDashboard
        counts={counts}
        posts={posts}
        notice={params?.notice}
        error={params?.error}
      />
    </>
  );
}
