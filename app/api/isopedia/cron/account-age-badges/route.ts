import { NextResponse } from "next/server";
import { verifyCronSecretFromRequest } from "@/lib/content-agent/security";
import { syncAccountAgeBadges } from "@/lib/isopedia-account-age-badges";

export async function GET(request: Request) {
  verifyCronSecretFromRequest(request);

  try {
    const result = await syncAccountAgeBadges();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
