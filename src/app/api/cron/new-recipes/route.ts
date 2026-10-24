import { getMessages } from "@/i18n/dictionaries";
import { createTranslator } from "@/i18n/format";
import { adminClient, sendPush, snippet, userLocale } from "@/lib/push";

/**
 * Daily digest (Vercel Cron, see vercel.json): tells people who opted in about
 * recipes their family added in the last 24 hours. At most one message a day.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const db = adminClient();
  if (!db) return Response.json({ skipped: "no service key" });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recipes } = await db.from("recipes").select("id, title, owner_id, family_id").gte("created_at", since);
  if (!recipes?.length) return Response.json({ sent: 0 });

  const [{ data: profiles }, { data: members }, { data: subscriptions }] = await Promise.all([
    db.from("profiles").select("user_id, display_name, notify_new_recipes"),
    db.from("family_members").select("user_id, family_id"),
    db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth"),
  ]);
  const nameOf = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name ?? ""]));
  const optedIn = (profiles ?? []).filter((p) => p.notify_new_recipes).map((p) => p.user_id);

  let sent = 0;
  for (const userId of optedIn) {
    const subs = (subscriptions ?? []).filter((s) => s.user_id === userId);
    if (!subs.length) continue;
    const families = new Set((members ?? []).filter((m) => m.user_id === userId).map((m) => m.family_id));
    const fresh = recipes.filter((r) => families.has(r.family_id) && r.owner_id !== userId);
    if (!fresh.length) continue;

    const { t, p } = createTranslator(await userLocale(db, userId), getMessages(await userLocale(db, userId)));
    const authors = [...new Set(fresh.map((r) => r.owner_id))];
    const titles = snippet(fresh.map((r) => r.title).join(", "), 90);
    const body =
      authors.length === 1
        ? p(t.push.recipesBy, fresh.length, { name: nameOf.get(authors[0]) || "…", titles })
        : p(t.push.recipesMany, fresh.length, { titles });
    sent += await sendPush(db, subs, { title: t.push.recipesTitle, body, url: "/", tag: "new-recipes" });
  }
  return Response.json({ sent });
}
