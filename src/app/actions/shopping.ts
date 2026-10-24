"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getPrimaryFamily, isUuid } from "@/lib/data";
import { mergeAmounts, toShoppingEntry } from "@/lib/shopping";

export type ListKind = "mine" | "family";

/**
 * Adds ingredient lines to a shopping list. Lines for an ingredient that is
 * already on the list (and not ticked off) are added up.
 */
export async function addShoppingLines(lines: string[], list: ListKind, source?: string): Promise<{ added: number }> {
  const user = await getCurrentUser();
  const family = await getPrimaryFamily();
  const entries = lines.map((l) => l.trim()).filter(Boolean).slice(0, 200).map(toShoppingEntry);
  if (!entries.length) return { added: 0 };

  const supabase = await createClient();
  const ownerId = list === "mine" ? user.id : null;
  let query = supabase.from("shopping_items").select("id, merge_key, amount, sources").eq("family_id", family.family_id).eq("checked", false);
  query = ownerId ? query.eq("owner_id", ownerId) : query.is("owner_id", null);
  const { data: existing } = await query;
  const byKey = new Map((existing ?? []).map((i) => [i.merge_key, i]));

  for (const entry of entries) {
    const hit = byKey.get(entry.merge_key);
    if (hit) {
      const sources = source && !hit.sources.includes(source) ? [...hit.sources, source] : hit.sources;
      const amount = mergeAmounts(hit.amount, entry.amount);
      await supabase.from("shopping_items").update({ amount, sources }).eq("id", hit.id);
      byKey.set(entry.merge_key, { ...hit, amount, sources });
    } else {
      const { data } = await supabase
        .from("shopping_items")
        .insert({
          family_id: family.family_id,
          owner_id: ownerId,
          name: entry.name.slice(0, 200),
          merge_key: entry.merge_key,
          amount: entry.amount,
          unit: entry.unit,
          sources: source ? [source] : [],
          created_by: user.id,
        })
        .select("id, merge_key, amount, sources")
        .single();
      if (data) byKey.set(entry.merge_key, data);
    }
  }
  revalidatePath("/", "layout");
  return { added: entries.length };
}

export async function setItemChecked(id: string, checked: boolean) {
  await getCurrentUser();
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("shopping_items").update({ checked }).eq("id", id);
  revalidatePath("/", "layout");
}

export async function deleteItem(id: string) {
  await getCurrentUser();
  if (!isUuid(id)) return;
  const supabase = await createClient();
  await supabase.from("shopping_items").delete().eq("id", id);
  revalidatePath("/", "layout");
}

export async function clearChecked(list: ListKind) {
  const user = await getCurrentUser();
  const family = await getPrimaryFamily();
  const supabase = await createClient();
  let query = supabase.from("shopping_items").delete().eq("family_id", family.family_id).eq("checked", true);
  query = list === "mine" ? query.eq("owner_id", user.id) : query.is("owner_id", null);
  await query;
  revalidatePath("/", "layout");
}
