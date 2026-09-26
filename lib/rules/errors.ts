/**
 * Translating database refusals into something a person can act on.
 *
 * Every hard rule raises SQLSTATE CT001 with its rule code in DETAIL. This
 * module recognises that shape so the interface can explain which rule applied
 * and why it exists, rather than surfacing a Postgres error — a refusal the
 * user cannot understand is indistinguishable from a bug.
 */

import { isRuleCode, type RuleCode } from "./registry";

/** Raised by public.raise_rule_violation. */
export const RULE_VIOLATION_SQLSTATE = "CT001";

/** Raised by public.raise_not_found. Not a refusal: the row is simply not visible. */
export const NOT_FOUND_SQLSTATE = "CT404";

/** The subset of a PostgREST / supabase-js error this module needs. */
export interface DatabaseErrorLike {
  readonly code?: string | null;
  readonly message?: string | null;
  readonly details?: string | null;
  readonly hint?: string | null;
}

export interface RuleViolation {
  readonly kind: "rule_violation";
  readonly ruleCode: RuleCode;
  readonly databaseMessage: string;
}

export interface NotFound {
  readonly kind: "not_found";
  readonly databaseMessage: string;
}

export type RecognisedError = RuleViolation | NotFound | ConstraintViolation;

/**
 * Constraint names that enforce a rule without going through
 * raise_rule_violation, because the storage layer refuses them directly. A
 * partial unique index cannot raise a custom SQLSTATE, so the mapping is
 * recovered from the constraint name instead.
 */
const CONSTRAINT_RULE_MAP: Readonly<Record<string, RuleCode>> = {
  missions_one_active_per_user: "RULE-001",
  missions_load_coherent: "RULE-003",
};

/**
 * Constraints that enforce something real but are not one of the hard rules.
 *
 * `cycles_one_active_per_user` is the clearest case. It is a precondition for
 * RULE-005 — activation is bound to the active cycle, which presumes there is
 * exactly one — but the explanation a person needs when opening a second cycle
 * is about cycles, not about missions. Mapping it to RULE-005 produced a
 * refusal that talked about the wrong thing entirely.
 */
export const NAMED_CONSTRAINTS = [
  "cycles_one_active_per_user",
  // Sessions. None of these is one of the hard rules; each is a structural
  // fact about time that the database refuses, and each needs its own
  // explanation rather than a rule's.
  "mission_sessions_no_overlap",
  "mission_sessions_one_running_per_user",
  "mission_sessions_not_in_future",
  "mission_sessions_mission_active",
  "mission_sessions_period_valid",
  // Evidence and criteria. Structural facts about output, again not rules.
  "mission_evidence_mission_active",
  "mission_evidence_url_valid",
  "mission_evidence_criterion_same_mission",
  "mission_dod_criteria_satisfy_active",
  // Reviews. What RULE-004 requires of a justification, refused by the table
  // itself; the form catches them first, but the explanation must not depend on it.
  "mission_reviews_justification_substantive",
  "mission_reviews_reason_category_valid",
  "mission_reviews_outcome_valid",
  // Knowledge. Structural facts about notes and links, not rules.
  "knowledge_links_no_self_link",
  "knowledge_links_unique_triple",
  "knowledge_notes_title_not_blank",
] as const;
export type NamedConstraint = (typeof NAMED_CONSTRAINTS)[number];

export interface ConstraintViolation {
  readonly kind: "constraint_violation";
  readonly constraint: NamedConstraint;
  readonly databaseMessage: string;
}

export function recogniseError(
  error: DatabaseErrorLike | null | undefined,
): RecognisedError | null {
  if (!error) return null;

  const message = error.message ?? "";

  if (error.code === RULE_VIOLATION_SQLSTATE) {
    const detail = (error.details ?? "").trim();
    if (isRuleCode(detail)) {
      return { kind: "rule_violation", ruleCode: detail, databaseMessage: message };
    }
    // The SQLSTATE is ours, so this is a rule violation whose code did not
    // survive. Fall through rather than guess: a wrong rule code would explain
    // the refusal incorrectly, which is worse than explaining it generically.
    return null;
  }

  if (error.code === NOT_FOUND_SQLSTATE) {
    return { kind: "not_found", databaseMessage: message };
  }

  for (const [constraint, ruleCode] of Object.entries(CONSTRAINT_RULE_MAP)) {
    if (message.includes(constraint)) {
      return { kind: "rule_violation", ruleCode, databaseMessage: message };
    }
  }

  for (const constraint of NAMED_CONSTRAINTS) {
    if (message.includes(constraint)) {
      return { kind: "constraint_violation", constraint, databaseMessage: message };
    }
  }

  return null;
}

export function isRuleViolation(
  error: DatabaseErrorLike | null | undefined,
  ruleCode?: RuleCode,
): boolean {
  const recognised = recogniseError(error);
  if (recognised?.kind !== "rule_violation") return false;
  return ruleCode === undefined || recognised.ruleCode === ruleCode;
}
