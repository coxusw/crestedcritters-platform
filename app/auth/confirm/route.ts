import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function safeNextPath(value: string | null) {
  if (!value) return "/update-password";
  if (!value.startsWith("/")) return "/update-password";
  if (value.startsWith("//")) return "/update-password";
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(requestUrl.searchParams.get("next"));

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/login?error=invalid-auth-link", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return NextResponse.redirect(new URL("/login?error=invalid-auth-link", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
