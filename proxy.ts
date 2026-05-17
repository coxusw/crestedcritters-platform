import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase().split(":")[0] || "";
  const isRandomizerHost = host === "randomizer.crestedcritters.com";

  if (!isRandomizerHost) return NextResponse.next();

  const url = request.nextUrl.clone();

  if (url.pathname === "/") {
    url.pathname = "/randomizer";
    return NextResponse.rewrite(url);
  }

  if (url.pathname === "/login") {
    url.searchParams.set("app", "randomizer");

    if (!url.searchParams.has("next")) {
      url.searchParams.set("next", "/");
    }

    return NextResponse.rewrite(url);
  }

  if (url.pathname === "/reset-password") {
    url.searchParams.set("app", "randomizer");
    return NextResponse.rewrite(url);
  }

  if (url.pathname === "/update-password") {
    url.searchParams.set("app", "randomizer");
    return NextResponse.rewrite(url);
  }

  if (url.pathname === "/isopedia") {
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (url.pathname === "/billing") {
    url.pathname = "/randomizer/billing";
    return NextResponse.rewrite(url);
  }

  if (url.pathname === "/verify") {
    url.pathname = "/randomizer/verify";
    return NextResponse.rewrite(url);
  }

  if (url.pathname === "/faq") {
    url.pathname = "/randomizer/faq";
    return NextResponse.rewrite(url);
  }

  if (url.pathname.startsWith("/results/")) {
    url.pathname = `/randomizer${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|crest-logo.png).*)"],
};
