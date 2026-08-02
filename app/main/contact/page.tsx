import type { Metadata } from "next";
import { redirect } from "next/navigation";
import MainSiteShell from "@/app/components/MainSiteShell";

export const metadata: Metadata = {
  title: { absolute: "Contact | Crested Critters" },
  description:
    "Contact Crested Critters with questions about orders, local pickup, live availability, and shop items.",
  alternates: {
    canonical: "https://crestedcritters.com/contact/",
  },
};

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

async function submitContactForm(formData: FormData) {
  "use server";

  const website = cleanText(formData.get("website"), 200);
  if (website) redirect("/contact?submitted=true");

  const name = cleanText(formData.get("name"), 160);
  const email = cleanText(formData.get("email"), 180).toLowerCase();
  const phone = cleanText(formData.get("phone"), 80);
  const message = cleanText(formData.get("message"), 4000);

  if (!name || !email || !message) {
    redirect("/contact?error=missing");
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    redirect("/contact?error=send-failed");
  }

  const body = [
    phone ? `${name} - ${email} - ${phone}` : `${name} - ${email}`,
    "",
    message,
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:
          process.env.CONTACT_EMAIL_FROM ||
          process.env.SHOP_REMINDER_EMAIL_FROM ||
          "Crested Critters <Sales@crestedcritters.com>",
        to: ["Contact_us@crestedcritters.com"],
        reply_to: email,
        subject: `customer contact (${name})`,
        text: body,
      }),
    });

    if (response.ok) redirect("/contact?submitted=true");
  } catch {
    redirect("/contact?error=send-failed");
  }

  redirect("/contact?error=send-failed");
}

export default async function MainContactPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <MainSiteShell>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d6c06f]">
          Contact
        </p>
        <h1 className="mt-3 text-4xl font-black leading-tight text-white md:text-5xl">
          Contact Crested Critters
        </h1>
        <p className="mt-4 text-base leading-8 text-[#a8b0b8]">
          Send us a note about orders, live availability, local pickup, or
          anything else you need help with.
        </p>

        <form
          action={submitContactForm}
          className="mt-8 rounded-lg border border-white/[0.08] bg-[#141618] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
        >
          {params.submitted === "true" && (
            <div className="mb-5 rounded-md border border-[#7fb069]/30 bg-[#7fb069]/10 p-4 text-sm font-bold text-[#d8f2cf]">
              Message sent. We will get back to you as soon as possible.
            </div>
          )}

          {params.error === "missing" && (
            <div className="mb-5 rounded-md border border-red-400/30 bg-red-400/10 p-4 text-sm font-bold text-red-100">
              Please enter your name, email address, and message.
            </div>
          )}

          {params.error === "send-failed" && (
            <div className="mb-5 rounded-md border border-red-400/30 bg-red-400/10 p-4 text-sm font-bold text-red-100">
              Your message could not be sent. Please try again.
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
            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#e9ecef]">Name</span>
              <input
                name="name"
                required
                maxLength={160}
                className="rounded-md border border-white/[0.12] bg-[#101214] px-4 py-3 text-white outline-none ring-[#7fb069]/30 focus:ring-4"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#e9ecef]">
                Email address
              </span>
              <input
                name="email"
                type="email"
                required
                maxLength={180}
                className="rounded-md border border-white/[0.12] bg-[#101214] px-4 py-3 text-white outline-none ring-[#7fb069]/30 focus:ring-4"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#e9ecef]">
                Phone number <span className="text-[#a8b0b8]">(optional)</span>
              </span>
              <input
                name="phone"
                type="tel"
                maxLength={80}
                className="rounded-md border border-white/[0.12] bg-[#101214] px-4 py-3 text-white outline-none ring-[#7fb069]/30 focus:ring-4"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#e9ecef]">
                What would you like to contact us for?
              </span>
              <textarea
                name="message"
                rows={8}
                required
                maxLength={4000}
                className="rounded-md border border-white/[0.12] bg-[#101214] px-4 py-3 text-white outline-none ring-[#7fb069]/30 focus:ring-4"
              />
            </label>
          </div>

          <button
            type="submit"
            className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-[#7fb069] px-4 py-3 text-sm font-black text-[#0b0d0b] transition hover:bg-[#92c37d]"
          >
            Submit
          </button>
        </form>
      </section>
    </MainSiteShell>
  );
}
