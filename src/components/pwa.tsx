"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/client";

/** Registers the service worker (push notifications + offline copies). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => reg.update())
      .catch(() => {});
  }, []);
  return null;
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Small banner while the device is offline. */
export function OfflineBanner() {
  const { t } = useI18n();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          role="status"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed inset-x-3 top-[max(0.5rem,env(safe-area-inset-top))] z-50 mx-auto max-w-md rounded-2xl bg-forest-900/90 px-4 py-2.5 text-center text-sm text-cream shadow-lifted backdrop-blur print:hidden"
        >
          📶 {t.offline.banner}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Asks the service worker to keep this page available offline. */
export function SaveForOffline({ path }: { path: string }) {
  useEffect(() => {
    navigator.serviceWorker?.ready.then((reg) => reg.active?.postMessage({ type: "cache-page", url: path })).catch(() => {});
  }, [path]);
  return null;
}
