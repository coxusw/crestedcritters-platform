import { permanentRedirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function GuideDetailRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("community_discussions")
    .select("slug")
    .eq("slug", slug)
    .eq("content_type", "guide")
    .maybeSingle<{ slug: string }>();

  permanentRedirect(`/community/discussion/${data?.slug || slug}`);
}
