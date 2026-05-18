import Link from "next/link";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import ContentAgentSettingsDashboard from "./ContentAgentSettingsDashboard";

type PageProps = {
  searchParams?: Promise<{
    notice?: string;
    error?: string;
  }>;
};

export default async function ContentAgentSettingsPage({ searchParams }: PageProps) {
  await requireContentAgentAdmin();

  const params = await searchParams;
  const supabase = createSupabaseAdminClient();

  const [{ data: pages, error: pagesError }, { data: logs, error: logsError }] =
    await Promise.all([
      supabase
        .from("content_agent_pages")
        .select("*")
        .order("page_name", { ascending: true }),
      supabase
        .from("content_agent_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (pagesError) throw new Error(pagesError.message);
  if (logsError) throw new Error(logsError.message);

  return (
    <>
      <div className="bg-slate-950 px-4 pt-4 text-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-4">
          <Link className="text-emerald-300 underline" href="/admin/content-agent">
            ← Back to Content Agent
          </Link>
          <Link className="text-emerald-300 underline" href="/admin">
            Admin Dashboard
          </Link>
        </div>
      </div>

      <ContentAgentSettingsDashboard
        pages={pages || []}
        logs={logs || []}
        notice={params?.notice}
        error={params?.error}
      />
    </>
  );
}
