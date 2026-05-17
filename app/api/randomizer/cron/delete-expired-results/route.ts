import { NextResponse } from "next/server";
import { verifyCronSecretFromRequest } from "@/lib/content-agent/security";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";

export async function GET(request: Request) {
  verifyCronSecretFromRequest(request);

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);

  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("randomizer_results")
    .delete({ count: "exact" })
    .lt("created_at", cutoff.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: count || 0 });
}
