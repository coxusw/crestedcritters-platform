import { NextResponse } from "next/server";
import { verifyCronSecretFromRequest } from "@/lib/content-agent/security";
import { createIsopediaStatsPost } from "@/lib/content-agent/isopedia";

export async function GET(request: Request) {
  verifyCronSecretFromRequest(request);
  const result = await createIsopediaStatsPost();
  return NextResponse.json({ ok: true, mode: "stats", result });
}
