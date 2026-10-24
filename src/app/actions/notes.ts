"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyProfile, getRecipe, isUuid } from "@/lib/data";
import { notifyNoteAdded } from "@/lib/notify";
import type { Messages } from "@/i18n/format";
import { getActionI18n } from "@/i18n/server";

export type NoteResult = { error: string } | undefined;

function clean(body: string, t: Messages): string | NoteResult {
  const text = body.trim();
  if (!text) return { error: t.common.error };
  if (text.length > 2000) return { error: t.notes.tooLong };
  return text;
}

export async function addNote(recipeId: string, body: string): Promise<NoteResult> {
  const { t } = await getActionI18n();
  const user = await getCurrentUser();
  const recipe = await getRecipe(recipeId);
  const text = clean(body, t);
  if (!recipe) return { error: t.common.error };
  if (typeof text !== "string") return text;

  const supabase = await createClient();
  const { error } = await supabase.from("recipe_notes").insert({ recipe_id: recipe.id, author_id: user.id, body: text });
  if (error) return { error: t.common.error };
  revalidatePath("/", "layout");

  // Notify the recipe's owner after the response is sent
  const author = await getMyProfile();
  after(() =>
    notifyNoteAdded({
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      ownerId: recipe.owner_id,
      authorId: user.id,
      authorName: author.display_name,
      text,
    }),
  );
}

export async function updateNote(noteId: string, body: string): Promise<NoteResult> {
  const { t } = await getActionI18n();
  await getCurrentUser();
  const text = clean(body, t);
  if (!isUuid(noteId)) return { error: t.common.error };
  if (typeof text !== "string") return text;

  const supabase = await createClient();
  const { data, error } = await supabase.from("recipe_notes").update({ body: text }).eq("id", noteId).select("id");
  if (error || !data.length) return { error: t.common.error };
  revalidatePath("/", "layout");
}

export async function deleteNote(noteId: string): Promise<NoteResult> {
  const { t } = await getActionI18n();
  await getCurrentUser();
  if (!isUuid(noteId)) return { error: t.common.error };
  const supabase = await createClient();
  const { data, error } = await supabase.from("recipe_notes").delete().eq("id", noteId).select("id");
  if (error || !data.length) return { error: t.common.error };
  revalidatePath("/", "layout");
}
