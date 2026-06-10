import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import {
  ISOPEDIA_CONTENT_LICENSE_ACKNOWLEDGMENT,
  ISOPEDIA_LEGAL_VERSION,
} from "@/lib/isopedia-legal";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeNextPath(value: string, fallback = "/account?welcome=true") {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  return value;
}

function appQuery(app: string) {
  return app ? `&app=${encodeURIComponent(app)}` : "";
}

async function hasProfileUsername(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle<{ username: string | null }>();

  return Boolean(profile?.username);
}

async function currentOrigin() {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") || headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") || "https";
  return host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_SITE_URL || "https://isopedia.crestedcritters.com";
}

async function createAccount(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const email = cleanText(formData.get("email"));
  const password = cleanText(formData.get("password"));
  const app = cleanText(formData.get("app"));
  const acknowledged = formData.get("content_license_acknowledgment") === "on";
  const fallback = app === "randomizer" ? "/" : "/account?welcome=true";
  const next = safeNextPath(cleanText(formData.get("next")), fallback);

  if (!email || !password) {
    redirect(`/signup?error=missing-fields&next=${encodeURIComponent(next)}${appQuery(app)}`);
  }

  if (!acknowledged) {
    redirect(`/signup?error=legal-required&next=${encodeURIComponent(next)}${appQuery(app)}`);
  }

  const origin = await currentOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      data: {
        isopedia_legal_version: ISOPEDIA_LEGAL_VERSION,
        isopedia_content_license_acknowledged: true,
        isopedia_legal_accepted_at: new Date().toISOString(),
      },
    },
  });

  if (error) {
    redirect(`/signup?error=signup-failed&next=${encodeURIComponent(next)}${appQuery(app)}`);
  }

  if (data.user?.id) {
    try {
      const admin = createSupabaseAdminClient();
      await admin.from("isopedia_legal_acceptances").upsert(
        {
          profile_id: data.user.id,
          legal_version: ISOPEDIA_LEGAL_VERSION,
          content_license_acknowledged: true,
          acknowledgment_text: ISOPEDIA_CONTENT_LICENSE_ACKNOWLEDGMENT,
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" }
      );
    } catch (acceptanceError) {
      console.error("Could not save initial Isopedia legal acceptance:", acceptanceError);
    }
  }

  if (!data.session) {
    redirect(`/signup?message=check-email&next=${encodeURIComponent(next)}${appQuery(app)}`);
  }

  if (app !== "randomizer" && data.user?.id) {
    const hasUsername = await hasProfileUsername(data.user.id);

    if (!hasUsername) {
      redirect("/account?welcome=true");
    }
  }

  redirect(next);
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    message?: string;
    next?: string;
    app?: string;
  }>;
}) {
  const params = await searchParams;
  const isRandomizer = params.app === "randomizer";
  const next = safeNextPath(
    params.next || "",
    isRandomizer ? "/" : "/account?welcome=true"
  );

  return (
    <main className="min-h-screen bg-[#07130c] px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-300">
            {isRandomizer ? "Randomizer" : "Isopedia"}
          </p>

          <h1 className="mt-3 text-4xl font-black text-white">Create Account</h1>

          <p className="mt-4 text-base leading-7 text-emerald-50/70">
            {isRandomizer
              ? "Create your account for the official Randomizer."
              : "Create your Isopedia account. After this, you will be sent straight to profile setup."}
          </p>
        </div>

        {params.message === "check-email" && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-200">
            Account created. Check your email to confirm the account, then you will be guided to finish your profile.
          </div>
        )}

        {params.error === "missing-fields" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Please enter an email and password.
          </div>
        )}

        {params.error === "signup-failed" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200">
            Account creation failed. This email may already be registered or the password may not meet requirements.
          </div>
        )}

        {params.error === "legal-required" && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200">
            Please accept the Isopedia legal documents and content license acknowledgment before creating an account.
          </div>
        )}

        <form
          action={createAccount}
          className="rounded-3xl border border-white/10 bg-[#102016] p-6 shadow-2xl shadow-black/30"
        >
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="app" value={params.app || ""} />

          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-emerald-100">Email</span>
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none ring-emerald-400/30 transition placeholder:text-emerald-50/30 focus:ring-4"
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-emerald-100">Password</span>
              <input
                type="password"
                name="password"
                placeholder="Create a password"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none ring-emerald-400/30 transition placeholder:text-emerald-50/30 focus:ring-4"
                required
              />
            </label>
          </div>

          <label className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-emerald-50/80">
            <input
              name="content_license_acknowledgment"
              type="checkbox"
              required
              className="mt-1 h-5 w-5 rounded border-white/20 bg-black"
            />
            <span>
              {ISOPEDIA_CONTENT_LICENSE_ACKNOWLEDGMENT}{" "}
              <Link href="/legal" className="font-bold text-emerald-300 underline">
                View legal documents.
              </Link>
            </span>
          </label>

          <button
            type="submit"
            className="mt-8 w-full rounded-2xl bg-emerald-400 px-6 py-3 font-black text-slate-950 transition hover:bg-emerald-300"
          >
            Create Account
          </button>
        </form>

        <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
          <Link
            href={`/login?next=${encodeURIComponent(next)}${appQuery(params.app || "")}`}
            className="font-bold text-emerald-300 hover:text-emerald-200"
          >
            Already have an account? Sign In
          </Link>

          <Link
            href={isRandomizer ? "/" : "/isopedia"}
            className="font-bold text-emerald-300 hover:text-emerald-200"
          >
            {isRandomizer ? "Back to Randomizer" : "Back to Isopedia"}
          </Link>
        </div>
      </div>
    </main>
  );
}
