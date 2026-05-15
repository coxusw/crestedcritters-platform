import Link from "next/link";
import ContentAgentDashboard from "./ContentAgentDashboard";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { getDashboardCounts, getRecentPosts } from "@/lib/content-agent/db";

export default async function ContentAgentAdminPage() {
  await requireContentAgentAdmin();
  const [counts, posts] = await Promise.all([getDashboardCounts(), getRecentPosts(50)]);
  return (
    <>
      <div className="bg-slate-950 px-4 pt-4 text-sm">
        <Link className="text-emerald-300 underline" href="/admin/isopedia">← Back to Isopedia Admin</Link>
      </div>
      <ContentAgentDashboard counts={counts} posts={posts} />
    </>
  );
}
