"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data";
import { sendPush } from "@/lib/push";
import { getActionI18n } from "@/i18n/server";

type BrowserSubscription = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** Registers this device for push notifications. */
export async function savePushSubscription(sub: BrowserSubscription): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!sub.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys.auth) return { ok: false };
  const supabase = await createClient();
  // The same device may have been registered before (e.g. after re-login)
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await supabase
    .from("push_subscriptions")
    .insert({ user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth });
  return { ok: !error };
}

export async function removePushSubscription(endpoint: string) {
  await getCurrentUser();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

/** Sends a test notification to all of the user's own devices. */
export async function sendTestPush(): Promise<{ delivered: number }> {
  const user = await getCurrentUser();
  const { t } = await getActionI18n();
  const supabase = await createClient();
  const { data } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", user.id);
  const delivered = await sendPush(supabase, data ?? [], { title: t.push.testTitle, body: t.push.testBody, url: "/profile", tag: "test" });
  return { delivered };
}
