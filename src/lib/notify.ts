import "server-only";
import { getMessages } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { adminClient, sendPush, snippet, userLocale } from "@/lib/push";

/** Tells a recipe's owner (if they opted in) that someone wrote a note on it. */
export async function notifyNoteAdded(input: { recipeId: string; recipeTitle: string; ownerId: string; authorId: string; authorName: string; text: string }) {
  if (input.ownerId === input.authorId) return;
  const db = adminClient();
  if (!db) return;

  const [{ data: profile }, { data: subscriptions }] = await Promise.all([
    db.from("profiles").select("notify_notes").eq("user_id", input.ownerId).maybeSingle(),
    db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", input.ownerId),
  ]);
  if (!profile?.notify_notes || !subscriptions?.length) return;

  const t = getMessages(await userLocale(db, input.ownerId));
  await sendPush(db, subscriptions, {
    title: format(t.push.noteTitle, { recipe: snippet(input.recipeTitle, 40) }),
    body: format(t.push.noteBody, { name: input.authorName || "…", text: snippet(input.text) }),
    url: `/recipes/${input.recipeId}`,
    tag: `note-${input.recipeId}`,
  });
}
