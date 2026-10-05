import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function BudgetLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("host") || "").toLowerCase().split(":")[0];

  if (host !== "admin.crestedcritters.com") {
    redirect("https://admin.crestedcritters.com/budget");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: adminProfile } = await supabase
    .from("admin_profiles")
    .select("id")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!adminProfile) redirect("/admin/login");

  return children;
}
