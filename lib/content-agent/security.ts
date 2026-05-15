import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function requireContentAgentAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ data: adminProfile }, { data: roleProfile }] = await Promise.all([
    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle(),
  ]);

  const allowed = Boolean(adminProfile) || roleProfile?.role === "admin" || roleProfile?.role === "moderator";
  if (!allowed) redirect("/admin/login");
  return { supabase, user };
}

export function verifyCronSecretFromRequest(request: Request) {
  const configured = process.env.CONTENT_AGENT_CRON_SECRET;
  if (!configured) throw new Error("Missing CONTENT_AGENT_CRON_SECRET.");
  const url = new URL(request.url);
  const supplied = url.searchParams.get("secret") || request.headers.get("x-content-agent-secret") || "";
  if (supplied !== configured) throw new Error("Unauthorized cron request.");
}
