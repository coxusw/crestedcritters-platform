"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  title: string;
  username: string;
};

export default function CollectionQrButton({ title, username }: Props) {
  const [open, setOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    if (!open) return;

    const url = `${window.location.origin}/isopedia/collection/${username}`;
    setPageUrl(url);

    QRCode.toDataURL(url, {
      width: 900,
      margin: 2,
      errorCorrectionLevel: "H",
    }).then(setQrUrl);
  }, [open, username]);

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
                  Collection QR
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
                  alt={`${title} collection QR code`}
                  className="h-auto w-full"
                />
              </div>
            )}

            <p className="mt-4 break-all text-sm text-emerald-50/60">
              {pageUrl || `/isopedia/collection/${username}`}
            </p>

            {qrUrl && (
              <a
                href={qrUrl}
                download={`${username}-collection-qr.png`}
                className="mt-5 inline-flex w-full justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
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