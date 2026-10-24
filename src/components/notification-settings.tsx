"use client";

import { motion } from "framer-motion";
import { useEffect, useState, useTransition } from "react";
import { setNotificationPrefs } from "@/app/actions/profile";
import { savePushSubscription, sendTestPush, type TestPushResult } from "@/app/actions/push";
import { spring } from "@/components/motion";
import { useI18n } from "@/i18n/client";

type DeviceState = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function base64ToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function supported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * Looks at the browser's subscription and makes sure the server knows it
 * (re-registers it on every visit, so a failed earlier save heals itself).
 */
async function detectAndSync(): Promise<DeviceState> {
  if (!supported()) {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    return ios && !window.matchMedia("(display-mode: standalone)").matches ? "ios-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub || Notification.permission !== "granted") return "off";
  const { ok } = await savePushSubscription(sub.toJSON());
  return ok ? "on" : "off";
}

/** Device registration for push + which notifications someone wants. */
export function NotificationSettings({ notifyNotes, notifyNewRecipes }: { notifyNotes: boolean; notifyNewRecipes: boolean }) {
  const { t, p, f } = useI18n();
  const [device, setDevice] = useState<DeviceState>("checking");
  const [prefs, setPrefs] = useState({ notify_notes: notifyNotes, notify_new_recipes: notifyNewRecipes });
  const [result, setResult] = useState<TestPushResult | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    detectAndSync().then(setDevice).catch(() => setDevice("unsupported"));
  }, []);

  /** Asks for permission and registers this device (fresh = drop the old browser subscription first). */
  async function enableDevice(fresh = false): Promise<boolean> {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key || !supported()) return false;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setDevice(permission === "denied" ? "denied" : "off");
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing && fresh) await existing.unsubscribe();
    const sub = (!fresh && existing) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(key) }));
    const { ok } = await savePushSubscription(sub.toJSON());
    setDevice(ok ? "on" : "off");
    return ok;
  }

  function toggle(name: keyof typeof prefs) {
    const next = { ...prefs, [name]: !prefs[name] };
    setPrefs(next);
    startTransition(async () => {
      if (next[name] && device === "off") await enableDevice();
      await setNotificationPrefs({ [name]: next[name] });
    });
  }

  const hint =
    device === "unsupported" ? t.profile.pushUnsupported : device === "ios-install" ? t.profile.pushIosHint : device === "denied" ? t.profile.pushDenied : "";
  const usable = device === "on" || device === "off";
  const resultText =
    result?.status === "sent"
      ? p(t.profile.pushSent, result.delivered)
      : result?.status === "no-device"
        ? t.profile.pushNoDevice
        : result?.status === "failed"
          ? f(t.profile.pushFailed, { code: result.code ?? "?" })
          : result?.status === "not-configured"
            ? t.profile.pushNotConfigured
            : "";

  return (
    <section className="card space-y-4 p-5 sm:p-6">
      <h2 className="font-serif text-xl font-semibold text-forest-900">🔔 {t.profile.notifications}</h2>
      {hint && <p className="rounded-xl bg-mint-100 px-3 py-2 text-sm text-forest-800">{hint}</p>}

      <div className="space-y-2">
        <Toggle label={t.profile.notifyNotes} hint={t.profile.notifyNotesHint} on={prefs.notify_notes} disabled={!usable || pending} onClick={() => toggle("notify_notes")} />
        <Toggle label={t.profile.notifyRecipes} hint={t.profile.notifyRecipesHint} on={prefs.notify_new_recipes} disabled={!usable || pending} onClick={() => toggle("notify_new_recipes")} />
      </div>

      {usable && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {device === "on" ? (
              <>
                <span className="text-sm text-moss-600">{t.profile.pushEnabled}</span>
                <button
                  type="button"
                  className="btn-secondary min-h-11 sm:min-h-0"
                  disabled={pending}
                  onClick={() => startTransition(async () => setResult(await sendTestPush()))}
                >
                  {t.profile.pushTest}
                </button>
              </>
            ) : (
              <button type="button" className="btn-primary min-h-11 sm:min-h-0" disabled={pending} onClick={() => startTransition(async () => void (await enableDevice()))}>
                {t.profile.enablePush}
              </button>
            )}
            <button
              type="button"
              className="min-h-11 rounded-lg px-3 text-sm text-muted underline-offset-2 hover:underline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setResult(null);
                  await enableDevice(true);
                })
              }
            >
              ↻ {t.profile.pushReset}
            </button>
          </div>
          {resultText && (
            <p className={`rounded-xl px-3 py-2 text-sm ${result?.status === "sent" ? "bg-mint-100 text-forest-800" : "bg-red-50 text-red-800"}`}>{resultText}</p>
          )}
          {result?.status === "sent" && <p className="text-xs text-muted">{t.profile.pushHelp}</p>}
        </div>
      )}
    </section>
  );
}

function Toggle(props: { label: string; hint: string; on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      disabled={props.disabled}
      onClick={props.onClick}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-cream px-4 py-2 text-left transition-colors hover:bg-sage-50 disabled:opacity-60"
    >
      <span className="flex-1">
        <span className="block font-medium text-forest-900">{props.label}</span>
        <span className="block text-xs text-muted">{props.hint}</span>
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${props.on ? "bg-forest-700" : "bg-sage-200"}`}>
        <motion.span className="absolute top-1 size-5 rounded-full bg-cream shadow-soft" animate={{ left: props.on ? 24 : 4 }} transition={spring} />
      </span>
    </button>
  );
}
