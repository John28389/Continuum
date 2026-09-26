import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";
import {
  computeIntegrity,
  REVIEW_OUTCOMES,
  REVIEW_REASON_CATEGORIES,
  type IntegrityRecord,
  type MissionSummary,
  type ReviewSummary,
  type RuleEventSummary,
} from "@/lib/rules/integrity";
import { MISSION_STATUSES } from "@/lib/rules/transitions";

type Client = SupabaseClient<Database>;

const RULE_EVENT_OUTCOMES = ["blocked", "overridden", "advised"] as const;

function oneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

/**
 * Rows, as the tables hold them, narrowed to what the integrity record counts.
 *
 * A value the application has no name for is left out rather than guessed at:
 * counting it under the wrong heading would corrupt the record it exists to
 * report.
 */
export function integrityInput(rows: {
  readonly missions: readonly { readonly status: string }[];
  readonly reviews: readonly { readonly outcome: string; readonly reason_category: string }[];
  readonly ruleEvents: readonly { readonly rule_code: string; readonly outcome: string }[];
}): {
  missions: MissionSummary[];
  reviews: ReviewSummary[];
  ruleEvents: RuleEventSummary[];
} {
  const missions: MissionSummary[] = [];
  for (const { status } of rows.missions) {
    if (oneOf(MISSION_STATUSES, status)) missions.push({ status });
  }

  const reviews: ReviewSummary[] = [];
  for (const { outcome, reason_category } of rows.reviews) {
    if (oneOf(REVIEW_OUTCOMES, outcome) && oneOf(REVIEW_REASON_CATEGORIES, reason_category)) {
      reviews.push({ outcome, reasonCategory: reason_category });
    }
  }

  const ruleEvents: RuleEventSummary[] = [];
  for (const { rule_code, outcome } of rows.ruleEvents) {
    if (oneOf(RULE_EVENT_OUTCOMES, outcome)) ruleEvents.push({ ruleCode: rule_code, outcome });
  }

  return { missions, reviews, ruleEvents };
}

/**
 * Mission Integrity, computed from the record every time it is asked for.
 *
 * Never stored: a stored figure could go stale, or be edited, and then it would
 * describe something other than what happened. The three tables it reads have
 * no path by which a finished record can be rewritten (RULE-004, RULE-006).
 */
export async function getIntegrity(supabase: Client): Promise<IntegrityRecord> {
  const [missions, reviews, ruleEvents] = await Promise.all([
    supabase.from("missions").select("status"),
    supabase.from("mission_reviews").select("outcome, reason_category"),
    supabase.from("rule_events").select("rule_code, outcome"),
  ]);

  return computeIntegrity(
    integrityInput({
      missions: missions.data ?? [],
      reviews: reviews.data ?? [],
      ruleEvents: ruleEvents.data ?? [],
    }),
  );
}
