"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data";
import { pushConfigured, sendPushDetailed } from "@/lib/push";
import { getActionI18n } from "@/i18n/server";

type BrowserSubscription = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** Registers this device for push notifications. */
export async function savePushSubscription(sub: BrowserSubscription): Promise<{ ok: boolean }> {
  await getCurrentUser();
  if (!sub.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys.auth) return { ok: false };
  const supabase = await createClient();
  // Moves the device to this account even if another account registered it before
  const { error } = await supabase.rpc("register_push_device", {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.keys.p256dh,
    p_auth: sub.keys.auth,
  });
  if (error) console.error("Saving push subscription failed", error.code, error.message);
  return { ok: !error };
}

export async function removePushSubscription(endpoint: string) {
  await getCurrentUser();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export type TestPushResult =
  | { status: "not-configured" }
  | { status: "no-device" }
  | { status: "sent"; delivered: number }
  | { status: "failed"; code: number | null };

/** Sends a test notification to all of the user's own devices and reports exactly what happened. */
export async function sendTestPush(): Promise<TestPushResult> {
  const user = await getCurrentUser();
  const { t } = await getActionI18n();
  if (!pushConfigured()) return { status: "not-configured" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", user.id);
  if (error) console.error("Reading push subscriptions failed", error.code, error.message);
  if (!data?.length) return { status: "no-device" };
  const result = await sendPushDetailed(supabase, data, { title: t.push.testTitle, body: t.push.testBody, url: "/profile", tag: "test" });
  if (result.delivered > 0) return { status: "sent", delivered: result.delivered };
  return { status: "failed", code: result.failures[0]?.status ?? null };
}
