import { NextResponse } from "next/server";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { postApprovedDueContent } from "@/lib/content-agent/generator";

export async function POST() {
  await requireContentAgentAdmin();
  const results = await postApprovedDueContent();
  return NextResponse.json({ ok: true, results });
}
