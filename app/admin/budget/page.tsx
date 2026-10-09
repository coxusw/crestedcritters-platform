import { redirect } from "next/navigation";

export default function RetiredBudgetPage() {
  // The household budget lives at its dedicated domain.
  // Never remove the Supabase budget tables when retiring this route.
  redirect("https://budget.crestedcritters.com/");
}
