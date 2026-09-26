import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";
import { recogniseError, type DatabaseErrorLike } from "@/lib/rules/errors";
import type { RuleCode } from "@/lib/rules/registry";

type Client = SupabaseClient<Database>;

/**
 * The behavioural record of the rules doing their job.
 *
 * Every time a hard rule refuses something, a row lands here. This is what
 * later lets the system say how often it held a line the user was pushing on —
 * which is the only honest version of that figure, since RULE-004 makes an
 * impulsive abandonment literally unrecordable. See `lib/rules/integrity.ts`.
 *
 * Written by the server action rather than by a trigger, deliberately: the
 * refusal aborts its own transaction, so anything the database wrote while
 * refusing would roll back with it. The event has to be recorded afterwards, by
 * whoever is still standing.
 */
export async function recordRuleEvent(
  supabase: Client,
  userId: string,
  ruleCode: RuleCode,
  context: Record<string, string> = {},
): Promise<void> {
  // The result is deliberately discarded. A failure to record the event must
  // never replace the explanation the user is waiting for: the block already
  // happened, and losing its bookkeeping is much the lesser loss.
  await supabase.from("rule_events").insert({
    user_id: userId,
    rule_code: ruleCode,
    outcome: "blocked",
    context,
  });
}

/**
 * The same, for a refusal that arrived as a database error.
 *
 * Anything unrecognised is ignored rather than guessed at: a rule event
 * attributed to the wrong rule would corrupt the record it exists to keep.
 */
export async function recordRuleBlock(
  supabase: Client,
  userId: string,
  error: DatabaseErrorLike | null | undefined,
  context: Record<string, string> = {},
): Promise<void> {
  const recognised = recogniseError(error);
  if (recognised?.kind !== "rule_violation") return;

  await recordRuleEvent(supabase, userId, recognised.ruleCode, context);
}
