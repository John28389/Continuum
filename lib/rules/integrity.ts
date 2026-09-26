/**
 * Mission Integrity.
 *
 * Reliability in doing what was deliberately taken on — expressed as counts and
 * history, never as a score. No XP, no levels, no streaks. A number that goes
 * up is exactly the kind of thing that starts being optimised for its own sake,
 * which would put this product at odds with itself.
 *
 * Computed, never stored, so it cannot go stale or be edited after the fact.
 *
 * One observation shaped this design. The original idea of the metric included
 * "missions abandoned on impulse", but the database makes that state
 * unreachable: leaving an active mission requires a categorised justification
 * (RULE-004), so an impulsive abandonment cannot be recorded because it cannot
 * happen. Reporting a permanent zero would be theatre. What is genuinely
 * informative is the opposite figure — how often the system held the line — so
 * blocked attempts are counted instead, from the rule events that recorded
 * them.
 */

import type { MissionStatus } from "./transitions";

export const REVIEW_REASON_CATEGORIES = [
  "premise_changed",
  "external_dependency",
  "scope_error",
  "strategy_changed",
  "evidence_obsolete",
] as const;
export type ReviewReasonCategory = (typeof REVIEW_REASON_CATEGORIES)[number];

export const REVIEW_OUTCOMES = ["kept", "revised", "abandoned"] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

export interface MissionSummary {
  readonly status: MissionStatus;
}

export interface ReviewSummary {
  readonly outcome: ReviewOutcome;
  readonly reasonCategory: ReviewReasonCategory;
}

export interface RuleEventSummary {
  readonly ruleCode: string;
  readonly outcome: "blocked" | "overridden" | "advised";
}

export interface IntegrityRecord {
  readonly missionsCompleted: number;
  readonly missionsRevised: number;
  readonly missionsAbandoned: number;
  readonly missionsActive: number;
  readonly missionsDraft: number;
  /** Reviews that examined a mission and kept it. Deciding to continue is a decision too. */
  readonly reviewsKept: number;
  readonly reviewsByCategory: Readonly<Record<ReviewReasonCategory, number>>;
  /** Times a hard rule refused a change of direction. */
  readonly impulseAttemptsBlocked: number;
}

/** The rules whose refusals represent the system protecting a commitment. */
const COMMITMENT_RULES = new Set(["RULE-001", "RULE-004", "RULE-005", "RULE-007"]);

function emptyCategoryCounts(): Record<ReviewReasonCategory, number> {
  return {
    premise_changed: 0,
    external_dependency: 0,
    scope_error: 0,
    strategy_changed: 0,
    evidence_obsolete: 0,
  };
}

export function computeIntegrity(input: {
  readonly missions: readonly MissionSummary[];
  readonly reviews: readonly ReviewSummary[];
  readonly ruleEvents: readonly RuleEventSummary[];
}): IntegrityRecord {
  const { missions, reviews, ruleEvents } = input;

  const byStatus = (status: MissionStatus) =>
    missions.filter((mission) => mission.status === status).length;

  const reviewsByCategory = emptyCategoryCounts();
  for (const review of reviews) {
    reviewsByCategory[review.reasonCategory] += 1;
  }

  return {
    missionsCompleted: byStatus("completed"),
    missionsRevised: byStatus("revised"),
    missionsAbandoned: byStatus("abandoned"),
    missionsActive: byStatus("active"),
    missionsDraft: byStatus("draft"),
    reviewsKept: reviews.filter((review) => review.outcome === "kept").length,
    reviewsByCategory,
    impulseAttemptsBlocked: ruleEvents.filter(
      (event) => event.outcome === "blocked" && COMMITMENT_RULES.has(event.ruleCode),
    ).length,
  };
}

/**
 * Missions that reached a terminal state. The denominator for "how much of what
 * was started actually finished", and deliberately excludes drafts and the
 * mission currently in flight — neither has had its chance yet.
 */
export function concludedMissions(record: IntegrityRecord): number {
  return record.missionsCompleted + record.missionsRevised + record.missionsAbandoned;
}
