import { NextResponse } from "next/server";
import { verifyCronSecretFromRequest } from "@/lib/content-agent/security";
import { generateImageForNextPost } from "@/lib/content-agent/media";

export async function GET(request: Request) {
  verifyCronSecretFromRequest(request);
  const result = await generateImageForNextPost();
  return NextResponse.json({ ok: true, result });
}
