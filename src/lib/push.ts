import "server-only";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";

export type PushPayload = { title: string; body: string; url: string; tag?: string };
type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };

/** True when VAPID keys are configured (push can be sent at all). */
export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/**
 * Service-role client for sending notifications to other people (reads their
 * subscriptions and settings). Server-only; null when no secret key is set.
 */
export function adminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

let configured = false;
function setup() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

/**
 * Sends a notification to the given subscriptions. Subscriptions that no longer
 * exist (the device unsubscribed) are removed. Returns the number delivered.
 */
export async function sendPush(db: SupabaseClient, subscriptions: Subscription[], payload: PushPayload) {
  if (!pushConfigured() || subscriptions.length === 0) return 0;
  setup();
  let delivered = 0;
  const gone: string[] = [];
  await Promise.all(
    subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
          TTL: 60 * 60 * 12,
          urgency: "normal",
        });
        delivered++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.id);
        else console.error("Push failed", status, (error as Error).message);
      }
    }),
  );
  if (gone.length) await db.from("push_subscriptions").delete().in("id", gone);
  return delivered;
}

/** The UI language a person chose (stored in their auth profile), for notification texts. */
export async function userLocale(db: SupabaseClient, userId: string): Promise<Locale> {
  const { data } = await db.auth.admin.getUserById(userId);
  const value = data.user?.user_metadata?.locale;
  return isLocale(value) ? value : defaultLocale;
}

export function snippet(text: string, max = 120) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
