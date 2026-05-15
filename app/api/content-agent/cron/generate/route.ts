import { NextResponse } from "next/server";
import { verifyCronSecretFromRequest } from "@/lib/content-agent/security";
import { generateNextPostsForActivePages } from "@/lib/content-agent/generator";

export async function GET(request: Request) {
  verifyCronSecretFromRequest(request);
  const results = await generateNextPostsForActivePages();
  return NextResponse.json({ ok: true, results });
}
