import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase().split(":")[0] || "";
  const isPodboundHost = host === "podbound.crestedcritters.com";
  const isLocalDevHost = host === "localhost" || host === "127.0.0.1";

  if (!isPodboundHost && !isLocalDevHost) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = join(process.cwd(), "public", "podbound", "index.html");
  let html = await readFile(filePath, "utf8");

  const supabaseConfig = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  };

  html = html.replace(
    /window\.PODBOUND_SUPABASE = window\.PODBOUND_SUPABASE \|\| \{\s*url: "",\s*anonKey: ""\s*\};/,
    `window.PODBOUND_SUPABASE = ${JSON.stringify(supabaseConfig)};`,
  );

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
