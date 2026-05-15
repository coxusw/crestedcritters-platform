import { NextResponse } from "next/server";
import { requireContentAgentAdmin } from "@/lib/content-agent/security";
import { generateImageForNextPost } from "@/lib/content-agent/media";

export async function POST() {
  await requireContentAgentAdmin();
  const result = await generateImageForNextPost();
  return NextResponse.json({ ok: true, result });
}
