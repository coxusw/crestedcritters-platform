"use client";

import { useEffect, useMemo, useState } from "react";

type NotificationPreferences = {
  push_enabled: boolean;
  notify_guides: boolean;
  notify_discussions: boolean;
  notify_expos: boolean;
  notify_isotokens: boolean;
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

export default function IsopediaAppSettings({
  preferences,
  vapidPublicKey,
  preferencesReady,
  savePreferencesAction,
}: Props) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushStatus, setPushStatus] = useState("Checking browser support...");
  const [busy, setBusy] = useState(false);

  const canUsePush = useMemo(
    () => pushSupported && Boolean(vapidPublicKey) && preferencesReady,
    [pushSupported, vapidPublicKey, preferencesReady]
  );

  useEffect(() => {
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    );

    const hasServiceWorker = "serviceWorker" in navigator;
    setPushSupported(hasServiceWorker && "PushManager" in window && "Notification" in window);

    if (hasServiceWorker) {
      navigator.serviceWorker.register("/isopedia-sw.js").catch(() => {
        setPushStatus("The app installer is available, but the service worker could not register yet.");
      });
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

  useEffect(() => {
    if (!pushSupported) {
      setPushStatus("This browser does not support web push notifications.");
      return;
    }

    if (!preferencesReady) {
      setPushStatus("Notification settings need the Supabase notification table before they can be saved.");
      return;
    }

    if (!vapidPublicKey) {
      setPushStatus("Push notifications need NEXT_PUBLIC_VAPID_PUBLIC_KEY in Vercel before users can enable them.");
      return;
    }

    setPushStatus(
      Notification.permission === "granted"
        ? "Browser notifications are allowed for Isopedia."
        : Notification.permission === "denied"
          ? "Browser notifications are blocked. Change this in your browser site settings."
          : "Browser notifications are ready to enable."
    );
  }, [preferencesReady, pushSupported, vapidPublicKey]);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  }

  async function enablePush() {
    if (!canUsePush || busy) return;
    setBusy(true);
    setPushStatus("Asking your browser for notification permission...");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus("Notifications were not enabled.");
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
      setPushStatus("Notifications are enabled for this browser.");
    } catch (error) {
      setPushStatus(error instanceof Error ? error.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    if (!pushSupported || busy) return;
    setBusy(true);
    setPushStatus("Turning off notifications for this browser...");

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
      setPushStatus("Notifications are off for this browser.");
    } catch (error) {
      setPushStatus(error instanceof Error ? error.message : "Could not disable notifications.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 grid gap-6">
      <div className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-xl shadow-black/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
              Isopedia App
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">Install Isopedia</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Add Isopedia to your phone or desktop for faster access from your home screen.
            </p>
          </div>

          <button
            type="button"
            onClick={installApp}
            disabled={installed || !installPrompt}
            className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            {installed ? "Installed" : installPrompt ? "Install App" : "Install Available In Browser Menu"}
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-xl shadow-black/20">
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
            label="Guide activity"
            description="New guide activity and future guide replies."
            defaultChecked={preferences.notify_guides}
          />
          <PreferenceCheck
            name="notify_discussions"
            label="Discussion activity"
            description="Replies, likes, and future watched species updates."
            defaultChecked={preferences.notify_discussions}
          />
          <PreferenceCheck
            name="notify_expos"
            label="Expo updates"
            description="Community expo approvals and future local expo alerts."
            defaultChecked={preferences.notify_expos}
          />
          <PreferenceCheck
            name="notify_isotokens"
            label="IsoToken activity"
            description="IsoToken awards and future store activity."
            defaultChecked={preferences.notify_isotokens}
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
      </div>
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
