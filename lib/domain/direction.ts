import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";
import type { DirectionInput } from "@/lib/validation/hierarchy";

export type Direction = Database["public"]["Tables"]["directions"]["Row"];

type Client = SupabaseClient<Database>;

export async function listDirections(supabase: Client): Promise<Direction[]> {
  const { data } = await supabase
    .from("directions")
    .select("*")
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  return data ?? [];
}

/** Only directions that can still take a new campaign. */
export async function listActiveDirections(supabase: Client): Promise<Direction[]> {
  const { data } = await supabase
    .from("directions")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function createDirection(supabase: Client, userId: string, input: DirectionInput) {
  return supabase.from("directions").insert({
    user_id: userId,
    title: input.title,
    statement: input.statement,
  });
}

export async function updateDirection(supabase: Client, id: string, input: DirectionInput) {
  return supabase
    .from("directions")
    .update({ title: input.title, statement: input.statement })
    .eq("id", id);
}

/**
 * Archiving rather than deleting.
 *
 * A direction that shaped past campaigns is part of the record of what was
 * pursued and why. Deleting it would quietly rewrite that history, and the
 * campaigns beneath it hold a foreign key to it in any case.
 */
export async function archiveDirection(supabase: Client, id: string) {
  return supabase
    .from("directions")
    .update({ status: "archived", ended_on: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
}
