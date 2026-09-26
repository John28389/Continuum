import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";
import type { CaptureInput, CuriosityState, PromoteInput } from "@/lib/validation/curiosity";

export type Curiosity = Database["public"]["Tables"]["curiosities"]["Row"];

type Client = SupabaseClient<Database>;

/** Newest first: a fresh capture belongs at the top of the parking lot. */
export async function listCuriosities(supabase: Client): Promise<Curiosity[]> {
  const { data } = await supabase
    .from("curiosities")
    .select("*")
    .order("created_at", { ascending: false });

  return data ?? [];
}

/**
 * How many curiosities are still waiting for a decision.
 *
 * The dashboard shows this count and nothing else (M12's acceptance
 * criterion): `chosen` already became a mission and `archived` was explicitly
 * dismissed, so neither is still "in" the parking lot in the sense the count
 * is meant to convey.
 */
export async function countOpenCuriosities(supabase: Client): Promise<number> {
  const { count } = await supabase
    .from("curiosities")
    .select("id", { count: "exact", head: true })
    .in("state", ["captured", "waiting", "candidate"]);

  return count ?? 0;
}

/** Capture has to be cheap: only a title, insertable from anywhere in the app. */
export async function captureCuriosity(supabase: Client, userId: string, input: CaptureInput) {
  return supabase.from("curiosities").insert({ user_id: userId, title: input.title });
}

/**
 * A direct state change: captured, waiting, candidate, or archived.
 *
 * `chosen` is never accepted here — it is set only by
 * `promote_curiosity_to_mission()`, alongside the mission it produced, so the
 * two can never disagree about whether a curiosity was actually promoted.
 */
export async function setCuriosityState(
  supabase: Client,
  curiosityId: string,
  state: Exclude<CuriosityState, "chosen">,
) {
  return supabase.from("curiosities").update({ state }).eq("id", curiosityId);
}

/**
 * Promotion, through the RPC (RULE-007).
 *
 * Nothing is checked here first. The active cycle, the cycle-boundary window
 * and the curiosity's own state are all read consistently inside the
 * function; a pre-check here would be racy and would put the rule in two
 * places, one of which is weaker. Note what is not a parameter: a status, and
 * a cycle — the function always targets the caller's own active cycle.
 */
export async function promoteCuriosity(supabase: Client, input: PromoteInput) {
  return supabase.rpc("promote_curiosity_to_mission", {
    p_curiosity_id: input.curiosityId,
    p_campaign_id: input.campaignId,
    p_title: input.title,
    p_reason: input.reason,
    p_min_load_minutes: input.minLoadMinutes,
    p_target_load_minutes: input.targetLoadMinutes,
  });
}
