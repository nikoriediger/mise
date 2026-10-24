"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getRecipe, isUuid } from "@/lib/data";
import { t } from "@/i18n";

export type NoteResult = { error: string } | undefined;

function clean(body: string): string | NoteResult {
  const text = body.trim();
  if (!text) return { error: t.common.error };
  if (text.length > 2000) return { error: t.notes.tooLong };
  return text;
}

export async function addNote(recipeId: string, body: string): Promise<NoteResult> {
  const user = await getCurrentUser();
  const recipe = await getRecipe(recipeId);
  const text = clean(body);
  if (!recipe) return { error: t.common.error };
  if (typeof text !== "string") return text;

  const supabase = await createClient();
  const { error } = await supabase.from("recipe_notes").insert({ recipe_id: recipe.id, author_id: user.id, body: text });
  if (error) return { error: t.common.error };
  revalidatePath(`/recipes/${recipe.id}`);
}

export async function updateNote(noteId: string, recipeId: string, body: string): Promise<NoteResult> {
  await getCurrentUser();
  const text = clean(body);
  if (!isUuid(noteId)) return { error: t.common.error };
  if (typeof text !== "string") return text;

  const supabase = await createClient();
  const { data, error } = await supabase.from("recipe_notes").update({ body: text }).eq("id", noteId).select("id");
  if (error || !data.length) return { error: t.common.error };
  revalidatePath(`/recipes/${recipeId}`);
}

export async function deleteNote(noteId: string, recipeId: string): Promise<NoteResult> {
  await getCurrentUser();
  if (!isUuid(noteId)) return { error: t.common.error };
  const supabase = await createClient();
  const { data, error } = await supabase.from("recipe_notes").delete().eq("id", noteId).select("id");
  if (error || !data.length) return { error: t.common.error };
  revalidatePath(`/recipes/${recipeId}`);
}
