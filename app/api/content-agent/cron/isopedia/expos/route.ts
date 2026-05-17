import { NextResponse } from "next/server";
import { verifyCronSecretFromRequest } from "@/lib/content-agent/security";
import { createExpoRoundupPost } from "@/lib/content-agent/isopedia";

export async function GET(request: Request) {
  verifyCronSecretFromRequest(request);
  const result = await createExpoRoundupPost();
  return NextResponse.json({ ok: true, mode: "expos", result });
}
