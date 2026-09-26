import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";

export type RuleRow = Database["public"]["Tables"]["rules"]["Row"];
export type RuleEventRow = Database["public"]["Tables"]["rule_events"]["Row"];

type Client = SupabaseClient<Database>;

/**
 * The rules as the database states them.
 *
 * Read from the table rather than from the registry on purpose: the Rules page
 * must describe what is enforced, and the table is the record of that. The
 * registry is compared against the seed by a unit test; the page trusts
 * neither alone and shows only what both know about.
 */
export async function listRules(supabase: Client): Promise<RuleRow[]> {
  const { data } = await supabase.from("rules").select("*").order("position", { ascending: true });

  return data ?? [];
}

/**
 * The most recent rule events, across every rule.
 *
 * Enough to show the last few beside each rule. The full history belongs to the
 * History page (M15); this is only evidence that a rule is doing its job.
 */
export async function listRecentRuleEvents(supabase: Client, limit = 200): Promise<RuleEventRow[]> {
  const { data } = await supabase
    .from("rule_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}
