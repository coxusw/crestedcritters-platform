"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  title: string;
  username: string;
};

export default function ProfileQrButton({ title, username }: Props) {
  const [open, setOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;

    const url = `${window.location.origin}/profile/${username}`;
    setPageUrl(url);

    QRCode.toDataURL(url, {
      width: 900,
      margin: 2,
      errorCorrectionLevel: "H",
    }).then(setQrUrl);
  }, [open, username]);

  async function copyUrl() {
    const url = pageUrl || `${window.location.origin}/profile/${username}`;

    await navigator.clipboard.writeText(url);
    setCopied(true);

    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-white/10 bg-[#142318] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#18291d]"
      >
        Share / QR
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0c1710] p-6 shadow-2xl shadow-black/50">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
                  Profile QR
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  {title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/15"
              >
                Close
              </button>
            </div>

            {qrUrl && (
              <div className="rounded-2xl bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrUrl}
                  alt={`${title} profile QR code`}
                  className="h-auto w-full"
                />
              </div>
            )}

            <button
              type="button"
              onClick={copyUrl}
              className="mt-5 inline-flex w-full justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/20"
            >
              {copied ? "Copied" : "Copy URL"}
            </button>

            {qrUrl && (
              <a
                href={qrUrl}
                download={`${username}-profile-qr.png`}
                className="mt-3 inline-flex w-full justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Download QR Code
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
