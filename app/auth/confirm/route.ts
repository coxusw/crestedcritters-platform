import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function safeNextPath(value: string | null) {
  if (!value) return "/update-password";
  if (!value.startsWith("/")) return "/update-password";
  if (value.startsWith("//")) return "/update-password";
  return value;
}

const skippedProfileSetupHosts = new Set([
  "admin.crestedcritters.com",
  "randomizer.crestedcritters.com",
  "shop.crestedcritters.com",
]);

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(requestUrl.searchParams.get("next"));

  if (!tokenHash && !code) {
    return NextResponse.redirect(new URL("/login?error=invalid-auth-link", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: type || "recovery",
      });

  if (error) {
    return NextResponse.redirect(new URL("/login?error=invalid-auth-link", request.url));
  }

  const host = requestUrl.hostname.toLowerCase();
  const isPasswordRecovery = type === "recovery" || next.startsWith("/update-password");

  if (!isPasswordRecovery && !skippedProfileSetupHosts.has(host)) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle<{ username: string | null }>();

      if (!profile?.username) {
        return NextResponse.redirect(new URL("/account?welcome=true", request.url));
      }
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
