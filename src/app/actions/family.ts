"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getPrimaryFamily, isUuid } from "@/lib/data";

export async function createInvite(): Promise<{ token: string } | { error: true }> {
  const user = await getCurrentUser();
  const family = await getPrimaryFamily();
  if (family.role !== "owner") return { error: true };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invites")
    .insert({ family_id: family.family_id, created_by: user.id })
    .select("token")
    .single();
  if (error) return { error: true };

  revalidatePath("/family");
  return { token: data.token };
}

export async function revokeInvite(token: string) {
  await getCurrentUser();
  if (!isUuid(token)) return;
  const supabase = await createClient();
  await supabase.from("invites").delete().eq("token", token);
  revalidatePath("/family");
}

export async function removeMember(userId: string) {
  await getCurrentUser();
  const family = await getPrimaryFamily();
  if (!isUuid(userId) || family.role !== "owner") return;
  const supabase = await createClient();
  await supabase
    .from("family_members")
    .delete()
    .eq("family_id", family.family_id)
    .eq("user_id", userId);
  revalidatePath("/family");
}
