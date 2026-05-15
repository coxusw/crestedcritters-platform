import { NextResponse } from "next/server";
import { verifyCronSecretFromRequest } from "@/lib/content-agent/security";
import { createExpoRoundupPost, createIsopediaStatsPost, createLatestSpeciesAnnouncement } from "@/lib/content-agent/isopedia";

export async function GET(request: Request) {
  verifyCronSecretFromRequest(request);
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") || "stats";
  let result = "";
  if (mode === "species") result = await createLatestSpeciesAnnouncement();
  else if (mode === "expos") result = await createExpoRoundupPost();
  else result = await createIsopediaStatsPost();
  return NextResponse.json({ ok: true, mode, result });
}
