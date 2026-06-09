"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isValidBirthDate } from "@/lib/isopedia-age";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeReturnPath(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function saveIsopediaBirthDate(formData: FormData) {
  const birthDate = cleanText(formData.get("birth_date"));
  const returnPath = safeReturnPath(cleanText(formData.get("return_path")));

  if (!isValidBirthDate(birthDate)) {
    redirect("/account?error=birth-date-required");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      birth_date: birthDate,
      birth_date_recorded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    redirect(`/account?error=${encodeURIComponent("birth-date-save-failed")}`);
  }

  revalidatePath("/");
  revalidatePath("/account");
  revalidatePath(returnPath);
  redirect(returnPath);
}
