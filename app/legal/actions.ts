"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ISOPEDIA_CONTENT_LICENSE_ACKNOWLEDGMENT,
  ISOPEDIA_LEGAL_VERSION,
} from "@/lib/isopedia-legal";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function acceptIsopediaLegalDocuments(formData: FormData) {
  const acknowledged = formData.get("content_license_acknowledgment") === "on";

  if (!acknowledged) {
    redirect("/legal?error=acknowledgment-required");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/legal");
  }

  const { error } = await supabase.from("isopedia_legal_acceptances").upsert(
    {
      profile_id: user.id,
      legal_version: ISOPEDIA_LEGAL_VERSION,
      content_license_acknowledged: true,
      acknowledgment_text: ISOPEDIA_CONTENT_LICENSE_ACKNOWLEDGMENT,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" }
  );

  if (error) {
    redirect(`/legal?error=${encodeURIComponent(error.message || "acceptance-failed")}`);
  }

  revalidatePath("/");
  revalidatePath("/account");
  revalidatePath("/legal");
  redirect("/legal?accepted=true");
}
