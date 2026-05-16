import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function requireContentAgentAdmin() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const [{ data: adminProfile }, { data: roleProfile }] = await Promise.all([
    supabase.from("admin_profiles").select("id").eq("id", user.id).maybeSingle(),
    supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle(),
  ]);

  const allowed =
    Boolean(adminProfile) ||
    roleProfile?.role === "admin" ||
    roleProfile?.role === "moderator";

  if (!allowed) redirect("/admin/login");

  return { supabase, user };
}

function extractBearerToken(value: string | null) {
  if (!value) return "";

  const trimmed = value.trim();

  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim();
  }

  return trimmed;
}

export function verifyCronSecretFromRequest(request: Request) {
  const allowedSecrets = [
    process.env.CRON_SECRET,
    process.env.CONTENT_AGENT_CRON_SECRET,
  ].filter(Boolean);

  if (!allowedSecrets.length) {
    throw new Error("Missing CRON_SECRET or CONTENT_AGENT_CRON_SECRET.");
  }

  const url = new URL(request.url);

  const supplied =
    extractBearerToken(request.headers.get("authorization")) ||
    request.headers.get("x-content-agent-secret") ||
    url.searchParams.get("secret") ||
    "";

  if (!allowedSecrets.includes(supplied)) {
    throw new Error("Unauthorized cron request.");
  }
}