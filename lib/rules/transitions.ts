/**
 * Mission state transitions.
 *
 * A pure mirror of the triggers in the missions migration. This exists so the
 * interface can disable an impossible action and explain why, before the user
 * attempts it — not so the interface can decide. The database remains the
 * authority; if these two ever disagree, the database is right and this file is
 * the bug.
 */

import type { RuleCode } from "./registry";

export const MISSION_STATUSES = ["draft", "active", "completed", "revised", "abandoned"] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

/**
 * Terminal states. Nothing leaves these.
 *
 * Completion being terminal is what makes the integrity record trustworthy: a
 * history that can be edited afterwards stops describing what actually
 * happened.
 */
export const TERMINAL_STATUSES = ["completed", "revised", "abandoned"] as const;
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

const LEGAL_TRANSITIONS: Readonly<Record<MissionStatus, readonly MissionStatus[]>> = {
  // A draft was never committed to, so dropping it needs no justification.
  draft: ["active", "abandoned"],
  active: ["completed", "revised", "abandoned"],
  completed: [],
  revised: [],
  abandoned: [],
};

export function isTerminal(status: MissionStatus): status is TerminalStatus {
  return (TERMINAL_STATUSES as readonly MissionStatus[]).includes(status);
}

export function legalTransitionsFrom(status: MissionStatus): readonly MissionStatus[] {
  return LEGAL_TRANSITIONS[status];
}

export function canTransition(from: MissionStatus, to: MissionStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

/**
 * Whether a categorised, written justification is required (RULE-004).
 *
 * Only leaving an *active* mission needs one. Abandoning a draft does not:
 * the rule protects commitments actually made, and applying it to drafts would
 * make planning expensive, which is how a system starts costing more than it
 * saves.
 */
export function requiresReview(from: MissionStatus, to: MissionStatus): boolean {
  return from === "active" && (to === "revised" || to === "abandoned");
}

/**
 * The rule that refuses a transition, or null when it is permitted.
 *
 * Note this covers only what can be decided from the two statuses alone.
 * RULE-001, RULE-002 and RULE-005 depend on other rows — another active
 * mission, the criteria list, the active cycle — and are answered by the
 * database, which is the only place that can see them consistently.
 */
export function transitionViolation(from: MissionStatus, to: MissionStatus): RuleCode | null {
  if (from === to) return null;
  if (isTerminal(from)) return "RULE-006";
  if (!canTransition(from, to)) return "RULE-006";
  return null;
}
