import { headers } from "next/headers";
import { acceptIsopediaLegalDocuments } from "@/app/legal/actions";
import LegalAcceptanceModal from "@/app/components/legal/LegalAcceptanceModal";
import { ISOPEDIA_LEGAL_VERSION } from "@/lib/isopedia-legal";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const skippedHosts = new Set([
  "admin.crestedcritters.com",
  "randomizer.crestedcritters.com",
  "shop.crestedcritters.com",
]);

export default async function LegalAcceptanceGate() {
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

  const { data, error } = await supabase
    .from("isopedia_legal_acceptances")
    .select("legal_version, content_license_acknowledged")
    .eq("profile_id", user.id)
    .maybeSingle<{
      legal_version: string | null;
      content_license_acknowledged: boolean | null;
    }>();

  if (error) return null;

  if (
    data?.legal_version === ISOPEDIA_LEGAL_VERSION &&
    data.content_license_acknowledged
  ) {
    return null;
  }

  return <LegalAcceptanceModal action={acceptIsopediaLegalDocuments} />;
}
