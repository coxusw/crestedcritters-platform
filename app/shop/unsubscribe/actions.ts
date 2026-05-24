"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { verifyShopUnsubscribeToken } from "@/lib/shop-unsubscribe";

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export async function unsubscribeShopEmailAction(formData: FormData) {
  const email = cleanText(formData.get("email")).toLowerCase();
  const token = cleanText(formData.get("token"));
  const reason = cleanText(formData.get("reason"));

  if (!email || !token || !verifyShopUnsubscribeToken(email, token)) {
    redirect("/unsubscribe?status=invalid");
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("shop_email_subscribers")
    .update({
      marketing_opt_in: false,
      unsubscribed_at: now,
      unsubscribe_reason: reason || null,
      source: "unsubscribed",
      updated_at: now,
    })
    .eq("email", email)
    .select("email")
    .maybeSingle();

  if (error?.message?.includes("unsubscribed_at") || error?.message?.includes("unsubscribe_reason")) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("shop_email_subscribers")
      .update({
        marketing_opt_in: false,
        source: "unsubscribed",
        updated_at: now,
      })
      .eq("email", email)
      .select("email")
      .maybeSingle();

    if (fallbackError || !fallbackData) {
      redirect(`/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&status=error`);
    }
  } else if (error) {
    redirect(`/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&status=error`);
  } else if (!data) {
    redirect(`/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&status=missing`);
  }

  redirect("/unsubscribe?status=done");
}
