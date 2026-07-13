import { permanentRedirect } from "next/navigation";

export default function SubmitGuideRedirectPage() {
  permanentRedirect("/community/new?category=guides");
}
