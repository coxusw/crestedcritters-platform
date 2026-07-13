import { NextResponse } from "next/server";
import { generateTodaysCommunityPrompt } from "@/lib/community-daily-prompts";
import { verifyCronSecretFromRequest } from "@/lib/content-agent/security";

export async function GET(request: Request) {
  verifyCronSecretFromRequest(request);
  const result = await generateTodaysCommunityPrompt();
  return NextResponse.json({ ok: true, result });
}
