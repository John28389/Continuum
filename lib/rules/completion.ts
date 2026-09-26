/**
 * Completion readiness — RULE-008, mirrored.
 *
 * A pure mirror of the `missions_enforce_completion` trigger, so the interface
 * can say *why* completion is not yet available before anyone asks. It decides
 * nothing: the trigger is the authority, and if the two ever disagree the
 * trigger is right and this file is the bug.
 *
 * Look at what the function accepts. Status and criteria — and no hours. There
 * is no parameter for logged time and there must never be one: completion is
 * decided by the Definition of Done (RULE-102), and a signature that took hours
 * would be the first step towards hours gating completion, which the roadmap
 * names as this milestone's failure mode.
 */

import type { MissionStatus } from "./transitions";

export interface CriterionState {
  readonly id: string;
  readonly description: string;
  readonly satisfied_at: string | null;
}

export interface CompletionReadiness {
  readonly ready: boolean;
  readonly total: number;
  /** Criteria still open, in the order given. Empty when ready. */
  readonly open: readonly CriterionState[];
}

export function completionReadiness(
  status: MissionStatus,
  criteria: readonly CriterionState[],
): CompletionReadiness {
  const open = criteria.filter((criterion) => criterion.satisfied_at === null);

  return {
    // Zero criteria is not "all satisfied". A mission whose Definition of Done
    // was emptied has no honest end state, which is RULE-002's whole argument.
    ready: status === "active" && criteria.length > 0 && open.length === 0,
    total: criteria.length,
    open,
  };
}
