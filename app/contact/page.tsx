import Link from "next/link";
import { redirect } from "next/navigation";
import IsopediaNav from "@/app/components/isopedia/IsopediaNav";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  business_name: string | null;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 2000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function validCategory(value: string) {
  return ["issue", "suggestion", "question", "other"].includes(value)
    ? value
    : "issue";
}

async function submitContactMessage(formData: FormData) {
  "use server";

  const website = cleanText(formData.get("website"), 200);
  if (website) redirect("/contact?submitted=true");

  const name = cleanText(formData.get("name"), 160);
  const email = cleanText(formData.get("email"), 180).toLowerCase();
  const category = validCategory(cleanText(formData.get("category"), 40));
  const subject = cleanText(formData.get("subject"), 180) || null;
  const message = cleanText(formData.get("message"), 4000);

  if (!name || !email || !message) {
    redirect("/contact?error=missing");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("isopedia_contact_messages").insert({
    submitted_by: user?.id || null,
    name,
    email,
    category,
    subject,
    message,
    status: "open",
    updated_at: new Date().toISOString(),
  });

  if (error) {
    redirect("/contact?error=save-failed");
  }

  redirect("/contact?submitted=true");
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, business_name")
      .eq("id", user.id)
      .maybeSingle<Profile>();

    profile = data || null;
  }

  const defaultName =
    profile?.display_name ||
    profile?.business_name ||
    profile?.username ||
    "";

  return (
    <main className="min-h-screen bg-[#07130c] px-4 py-6 text-slate-100 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <IsopediaNav active="contact" />

        <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-3xl border border-white/10 bg-[#102016] p-6 shadow-2xl shadow-black/25 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
              Contact Us
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
              Help improve Isopedia
            </h1>
            <p className="mt-4 text-sm leading-7 text-emerald-50/70 sm:text-base">
              Send admins an issue report, suggestion, question, or general note.
              Messages are saved in the admin dashboard so the team can review
              and follow up.
            </p>

            <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm leading-6 text-emerald-50/70">
              Please include enough detail for admins to understand the page,
              feature, or species entry you are referring to.
            </div>
          </div>

          <form
            action={submitContactMessage}
            className="rounded-3xl border border-white/10 bg-[#102016] p-6 shadow-2xl shadow-black/25 sm:p-8"
          >
            {params.submitted === "true" && (
              <div className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">
                Message sent. An admin can review it in the Isopedia admin tools.
              </div>
            )}

            {params.error === "missing" && (
              <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm font-bold text-red-100">
                Please include your name, email, and message.
              </div>
            )}

            {params.error === "save-failed" && (
              <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm font-bold text-red-100">
                Message could not be saved. Please try again.
              </div>
            )}

            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />

            <div className="grid gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-emerald-50">
                    Name
                  </span>
                  <input
                    name="name"
                    defaultValue={defaultName}
                    required
                    maxLength={160}
                    className="rounded-xl border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 placeholder:text-emerald-50/30 focus:ring-4"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-emerald-50">
                    Email
                  </span>
                  <input
                    name="email"
                    type="email"
                    defaultValue={user?.email || ""}
                    required
                    maxLength={180}
                    className="rounded-xl border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 placeholder:text-emerald-50/30 focus:ring-4"
                  />
                </label>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-emerald-50">
                    Type
                  </span>
                  <select
                    name="category"
                    defaultValue="issue"
                    className="rounded-xl border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
                  >
                    <option value="issue">Issue</option>
                    <option value="suggestion">Suggestion</option>
                    <option value="question">Question</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-emerald-50">
                    Subject <span className="text-emerald-50/40">(optional)</span>
                  </span>
                  <input
                    name="subject"
                    maxLength={180}
                    placeholder="Short summary"
                    className="rounded-xl border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 placeholder:text-emerald-50/30 focus:ring-4"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-emerald-50">
                  Message
                </span>
                <textarea
                  name="message"
                  rows={8}
                  required
                  maxLength={4000}
                  placeholder="Tell admins what is happening or what you would like to suggest."
                  className="rounded-xl border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 placeholder:text-emerald-50/30 focus:ring-4"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/"
                className="text-sm font-bold text-emerald-300 hover:text-emerald-200"
              >
                Back to Isopedia
              </Link>

              <button
                type="submit"
                className="rounded-xl bg-emerald-400 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Send Message
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
