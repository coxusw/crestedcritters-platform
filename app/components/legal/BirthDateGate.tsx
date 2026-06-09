import { headers } from "next/headers";
import BirthDateModal from "@/app/components/legal/BirthDateModal";
import { saveIsopediaBirthDate } from "@/app/components/legal/birthdate-actions";
import { ISOPEDIA_LEGAL_VERSION } from "@/lib/isopedia-legal";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const skippedHosts = new Set([
  "admin.crestedcritters.com",
  "randomizer.crestedcritters.com",
  "shop.crestedcritters.com",
]);

export default async function BirthDateGate() {
  const headersList = await headers();
  const host = (headersList.get("x-forwarded-host") || headersList.get("host") || "")
    .toLowerCase()
    .split(":")[0];

  if (skippedHosts.has(host)) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: acceptance }, { data: profile, error: profileError }] = await Promise.all([
    supabase
      .from("isopedia_legal_acceptances")
      .select("legal_version, content_license_acknowledged")
      .eq("profile_id", user.id)
      .maybeSingle<{
        legal_version: string | null;
        content_license_acknowledged: boolean | null;
      }>(),
    supabase
      .from("profiles")
      .select("birth_date")
      .eq("id", user.id)
      .maybeSingle<{ birth_date: string | null }>(),
  ]);

  if (
    acceptance?.legal_version !== ISOPEDIA_LEGAL_VERSION ||
    !acceptance.content_license_acknowledged
  ) {
    return null;
  }

  if (profileError) return null;
  if (profile?.birth_date) return null;

  return <BirthDateModal action={saveIsopediaBirthDate} />;
}
