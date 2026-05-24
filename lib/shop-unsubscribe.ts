import { createHmac, timingSafeEqual } from "crypto";

function unsubscribeSecret() {
  return (
    process.env.SHOP_UNSUBSCRIBE_SECRET ||
    process.env.RESEND_API_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "crested-critters-shop"
  );
}

export function createShopUnsubscribeToken(email: string) {
  return createHmac("sha256", unsubscribeSecret())
    .update(email.trim().toLowerCase())
    .digest("hex");
}

export function verifyShopUnsubscribeToken(email: string, token: string) {
  const expected = createShopUnsubscribeToken(email);
  const expectedBuffer = Buffer.from(expected);
  const tokenBuffer = Buffer.from(String(token || ""));

  return (
    expectedBuffer.length === tokenBuffer.length &&
    timingSafeEqual(expectedBuffer, tokenBuffer)
  );
}

export function shopUnsubscribeUrl(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const url = new URL("/unsubscribe", "https://shop.crestedcritters.com");
  url.searchParams.set("email", normalizedEmail);
  url.searchParams.set("token", createShopUnsubscribeToken(normalizedEmail));
  return url.toString();
}
