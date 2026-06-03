import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase().split(":")[0] || "";
  const isIsopediaHost = host === "isopedia.crestedcritters.com";
  const isRandomizerHost = host === "randomizer.crestedcritters.com";
  const isAdminHost = host === "admin.crestedcritters.com";
  const isShopHost = host === "shop.crestedcritters.com";

  if (isIsopediaHost) {
    const url = request.nextUrl.clone();
    const isInternalRewrite =
      request.headers.get("x-isopedia-internal-rewrite") === "1";

    if (url.pathname === "/isopedia" && !isInternalRewrite) {
      url.pathname = "/";
      return NextResponse.redirect(url, 308);
    }

    if (url.pathname.startsWith("/isopedia/") && !isInternalRewrite) {
      url.pathname = url.pathname.replace(/^\/isopedia/, "") || "/";
      return NextResponse.redirect(url, 308);
    }

    const cleanIsopediaPath = toInternalIsopediaPath(url.pathname);

    if (cleanIsopediaPath) {
      url.pathname = cleanIsopediaPath;
      const headers = new Headers(request.headers);
      headers.set("x-isopedia-internal-rewrite", "1");
      return NextResponse.rewrite(url, { request: { headers } });
    }
  }

  if (isAdminHost) {
    const url = request.nextUrl.clone();

    if (url.pathname === "/") {
      url.pathname = "/admin";
      return NextResponse.rewrite(url);
    }

    if (url.pathname === "/login") {
      url.pathname = "/admin/login";
      return NextResponse.rewrite(url);
    }

    if (url.pathname === "/logout") {
      return NextResponse.next();
    }

    if (!url.pathname.startsWith("/admin")) {
      url.pathname = `/admin${url.pathname}`;
      return NextResponse.rewrite(url);
    }

    return NextResponse.next();
  }

  if (isShopHost) {
    const url = request.nextUrl.clone();

    if (url.pathname === "/") {
      url.pathname = "/shop";
      return NextResponse.rewrite(url);
    }

    if (url.pathname.startsWith("/api/")) {
      return NextResponse.next();
    }

    if (url.pathname === "/checkout/success") {
      url.pathname = "/shop/checkout/success";
      return NextResponse.rewrite(url);
    }

    if (url.pathname === "/cart") {
      url.pathname = "/shop/cart";
      return NextResponse.rewrite(url);
    }

    if (!url.pathname.startsWith("/shop")) {
      url.pathname = `/shop${url.pathname}`;
      return NextResponse.rewrite(url);
    }

    return NextResponse.next();
  }

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

const reservedIsopediaPaths = new Set([
  "account",
  "admin",
  "api",
  "auth",
  "isotoken-store",
  "login",
  "logout",
  "profile",
  "raffles",
  "randomizer",
  "reset-password",
  "robots.txt",
  "shop",
  "signup",
  "sitemap.xml",
  "update-password",
]);

const cleanIsopediaPrefixes = new Set([
  "collection",
  "expos",
  "guides",
  "review",
  "submit",
  "verify",
  "verify-edits",
  "verify-images",
]);

function toInternalIsopediaPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const [first, second] = segments;

  if (reservedIsopediaPaths.has(first)) return null;
  if (first.includes(".")) return null;

  if (cleanIsopediaPrefixes.has(first)) {
    return `/isopedia${pathname}`;
  }

  if (segments.length === 1) {
    return `/isopedia/${first}`;
  }

  if (
    segments.length === 2 &&
    (second === "suggest-edit" || second === "submit-image")
  ) {
    return `/isopedia/${first}/${second}`;
  }

  return null;
}
