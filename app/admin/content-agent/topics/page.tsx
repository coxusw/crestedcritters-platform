import Link from "next/link";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import ContentAgentTopicsDashboard from "./ContentAgentTopicsDashboard";

type PageProps = {
  searchParams?: Promise<{
    notice?: string;
    error?: string;
    page?: string;
    q?: string;
  }>;
};

export default async function ContentAgentTopicsPage({ searchParams }: PageProps) {
  await requireContentAgentAdmin();

  const params = await searchParams;
  const pageFilter = params?.page || "all";
  const q = (params?.q || "").trim();

  const supabase = createSupabaseAdminClient();

  const [{ data: pages, error: pagesError }, topicsResult] = await Promise.all([
    supabase
      .from("content_agent_pages")
      .select("page_key, page_name, schedule_slots, content_cycle")
      .order("page_name", { ascending: true }),
    buildTopicsQuery(supabase, pageFilter, q),
  ]);

  if (pagesError) throw new Error(pagesError.message);
  if (topicsResult.error) throw new Error(topicsResult.error.message);

  return (
    <>
      <div className="bg-slate-950 px-4 pt-4 text-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-4">
          <Link className="text-emerald-300 underline" href="/admin/content-agent">
            ← Back to Content Agent
          </Link>
          <Link className="text-emerald-300 underline" href="/admin/content-agent/settings">
            Settings & Schedule
          </Link>
        </div>
      </div>

      <ContentAgentTopicsDashboard
        pages={pages || []}
        topics={topicsResult.data || []}
        activePageFilter={pageFilter}
        searchQuery={q}
        notice={params?.notice}
        error={params?.error}
      />
    </>
  );
}

function buildTopicsQuery(supabase: ReturnType<typeof createSupabaseAdminClient>, pageFilter: string, q: string) {
  let query = supabase
    .from("content_agent_topics")
    .select("*")
    .order("page_key", { ascending: true })
    .order("active", { ascending: false })
    .order("post_type", { ascending: true })
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .order("topic", { ascending: true });

  if (pageFilter && pageFilter !== "all") {
    query = query.eq("page_key", pageFilter);
  }

  if (q) {
    query = query.or(`topic.ilike.%${q}%,post_type.ilike.%${q}%,notes.ilike.%${q}%`);
  }

  return query;
}
