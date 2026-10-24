"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getPrimaryCookbook, isUuid } from "@/lib/data";

export async function createInvite(): Promise<{ token: string } | { error: true }> {
  const user = await getCurrentUser();
  const cookbook = await getPrimaryCookbook();
  if (cookbook.role !== "owner") return { error: true };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invites")
    .insert({ cookbook_id: cookbook.cookbook_id, created_by: user.id })
    .select("token")
    .single();
  if (error) return { error: true };

  revalidatePath("/cookbook");
  return { token: data.token };
}

export async function revokeInvite(token: string) {
  await getCurrentUser();
  if (!isUuid(token)) return;
  const supabase = await createClient();
  await supabase.from("invites").delete().eq("token", token);
  revalidatePath("/cookbook");
}

export async function removeMember(userId: string) {
  await getCurrentUser();
  const cookbook = await getPrimaryCookbook();
  if (!isUuid(userId) || cookbook.role !== "owner") return;
  const supabase = await createClient();
  await supabase
    .from("cookbook_members")
    .delete()
    .eq("cookbook_id", cookbook.cookbook_id)
    .eq("user_id", userId);
  revalidatePath("/cookbook");
}
