"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type NotificationPreferences = {
  push_enabled: boolean;
  notify_guides: boolean;
  notify_discussions: boolean;
  notify_expos: boolean;
  notify_verified_species: boolean;
  notify_messages: boolean;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type Props = {
  preferences: NotificationPreferences;
  vapidPublicKey: string;
  preferencesReady: boolean;
  savePreferencesAction: (formData: FormData) => Promise<void>;
};

export function IsopediaInstallCard() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandaloneInstalled);
  const [isIos] = useState(isAppleMobileBrowser);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/isopedia-sw.js").catch(() => {});
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  }

  const installHelp = installed
    ? "Isopedia is already installed on this device."
    : isIos
      ? "Install Isopedia from Safari's Share menu. It only takes two taps."
      : installPrompt
        ? "This browser can install Isopedia directly."
        : "If your browser supports app installs, use its install option from the address bar or browser menu.";

  return (
    <section className="isopedia-install-card mx-auto mt-4 max-w-5xl rounded-2xl border border-emerald-400/20 bg-[#102016] p-4 shadow-xl shadow-black/20 sm:mt-5">
      <div className="grid gap-4 sm:grid-cols-[72px_1fr_auto] sm:items-center">
        <Image
          src="/isopedia-app-icon-192.png"
          alt=""
          width={64}
          height={64}
          className="h-16 w-16 rounded-2xl border border-white/10 shadow-lg shadow-black/30"
        />
        <div>
          <p className="isopedia-theme-kicker text-xs font-black uppercase tracking-[0.22em] text-emerald-300">
            Isopedia App
          </p>
          <h2 className="isopedia-theme-heading mt-1 text-xl font-black text-white">Install Isopedia</h2>
          <p className="isopedia-theme-muted mt-1 text-sm leading-6 text-emerald-50/70">
            Add Isopedia to your phone or desktop for quick access to species, guides, expos, and your profile.
          </p>
          <p className="isopedia-theme-muted mt-2 text-xs font-semibold leading-5 text-emerald-100/60">
            {installHelp}
          </p>
        </div>
        {isIos && !installed ? (
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-emerald-50">
            <div className="flex items-center gap-2 text-sm font-black">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-300 text-lg text-slate-950">
                {shareIcon}
              </span>
              <span>iPhone Install</span>
            </div>
            <ol className="mt-3 grid gap-2 text-sm font-bold leading-5 text-emerald-50/85">
              <li className="rounded-lg bg-black/20 px-3 py-2">
                1. Tap Safari&apos;s Share button
              </li>
              <li className="rounded-lg bg-black/20 px-3 py-2">
                2. Choose Add to Home Screen
              </li>
            </ol>
          </div>
        ) : (
          <button
            type="button"
            onClick={installApp}
            disabled={installed || !installPrompt}
            className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            {installed ? "Installed" : installPrompt ? "Install" : "Use Browser Install"}
          </button>
        )}
      </div>
    </section>
  );
}

const shareIcon = (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
    <path
      d="M12 15V3m0 0 4 4m-4-4-4 4M6 10v9h12v-9"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

function isAppleMobileBrowser() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform?.toLowerCase() || "";
  const touchMac = platform.includes("mac") && window.navigator.maxTouchPoints > 1;

  return /iphone|ipad|ipod/.test(ua) || touchMac;
}

function isStandaloneInstalled() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export default function IsopediaNotificationSettings({
  preferences,
  vapidPublicKey,
  preferencesReady,
  savePreferencesAction,
}: Props) {
  const [pushSupported] = useState(supportsWebPush);
  const [pushStatusOverride, setPushStatusOverride] = useState("");
  const [busy, setBusy] = useState(false);

  const pushStatus = pushStatusOverride || browserPushStatus(pushSupported, preferencesReady, vapidPublicKey);
  const canUsePush = useMemo(
    () => pushSupported && Boolean(vapidPublicKey) && preferencesReady,
    [pushSupported, vapidPublicKey, preferencesReady]
  );

  useEffect(() => {
    const hasServiceWorker = "serviceWorker" in navigator;

    if (hasServiceWorker) {
      navigator.serviceWorker.register("/isopedia-sw.js").catch(() => {
        setPushStatusOverride("The app installer is available, but the service worker could not register yet.");
      });
    }

  }, []);

  async function enablePush() {
    if (!canUsePush || busy) return;
    setBusy(true);
    setPushStatusOverride("Asking your browser for notification permission...");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatusOverride("Notifications were not enabled.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/isopedia-sw.js");
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));

      const response = await fetch("/api/isopedia/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const payload = await response.json();

      if (!response.ok) throw new Error(payload.error || "Could not save notification subscription.");
      setPushStatusOverride("Notifications are enabled for this browser.");
    } catch (error) {
      setPushStatusOverride(error instanceof Error ? error.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    if (!pushSupported || busy) return;
    setBusy(true);
    setPushStatusOverride("Turning off notifications for this browser...");

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      const endpoint = subscription?.endpoint || "";
      await subscription?.unsubscribe();

      const response = await fetch("/api/isopedia/push-subscription", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      const payload = await response.json();

      if (!response.ok) throw new Error(payload.error || "Could not update notification settings.");
      setPushStatusOverride("Notifications are off for this browser.");
    } catch (error) {
      setPushStatusOverride(error instanceof Error ? error.message : "Could not disable notifications.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-xl shadow-black/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
              Notifications
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">Push Notification Settings</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{pushStatus}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={enablePush}
              disabled={!canUsePush || busy}
              className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
            >
              Enable Push
            </button>
            <button
              type="button"
              onClick={disablePush}
              disabled={!pushSupported || busy || !preferencesReady}
              className="rounded-xl border border-white/10 px-5 py-3 text-sm font-black text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-slate-500"
            >
              Disable
            </button>
          </div>
        </div>

        <form action={savePreferencesAction} className="mt-6 grid gap-3 sm:grid-cols-2">
          <PreferenceCheck
            name="notify_guides"
            label="Guide notifications"
            description="Guide posts, guide replies, and guide-related mentions."
            defaultChecked={preferences.notify_guides}
          />
          <PreferenceCheck
            name="notify_discussions"
            label="Community discussion notifications"
            description="Replies, mentions, accepted answers, and followed species discussion updates."
            defaultChecked={preferences.notify_discussions}
          />
          <PreferenceCheck
            name="notify_expos"
            label="Expo updates"
            description="Community expo approvals and future local expo alerts."
            defaultChecked={preferences.notify_expos}
          />
          <PreferenceCheck
            name="notify_verified_species"
            label="New verified species"
            description="New species pages after community submissions are verified."
            defaultChecked={preferences.notify_verified_species}
          />
          <PreferenceCheck
            name="notify_messages"
            label="Messages"
            description="Private message replies and new admin messages."
            defaultChecked={preferences.notify_messages}
          />

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={!preferencesReady}
              className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-800 disabled:text-slate-500"
            >
              Save Notification Preferences
            </button>
          </div>
        </form>
    </section>
  );
}

function PreferenceCheck({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex gap-3 rounded-2xl border border-white/10 bg-slate-950 p-4">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="mt-1 h-5 w-5 accent-emerald-400" />
      <span>
        <span className="block font-bold text-slate-100">{label}</span>
        <span className="mt-1 block text-sm leading-5 text-slate-400">{description}</span>
      </span>
    </label>
  );
}

function supportsWebPush() {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function browserPushStatus(
  pushSupported: boolean,
  preferencesReady: boolean,
  vapidPublicKey: string
) {
  if (!pushSupported) return "This browser does not support web push notifications.";
  if (!preferencesReady) {
    return "Notification settings need the Supabase notification table before they can be saved.";
  }
  if (!vapidPublicKey) {
    return "Push notifications need NEXT_PUBLIC_VAPID_PUBLIC_KEY in Vercel before users can enable them.";
  }
  if (Notification.permission === "granted") return "Browser notifications are allowed for Isopedia.";
  if (Notification.permission === "denied") {
    return "Browser notifications are blocked. Change this in your browser site settings.";
  }
  return "Browser notifications are ready to enable.";
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}
