import { ptBR } from "@/lib/i18n/pt-BR";
import { recogniseError, type DatabaseErrorLike } from "@/lib/rules/errors";
import type { RuleCode } from "@/lib/rules/registry";

/**
 * Turns a database refusal into something a person can act on.
 *
 * A refused write in this application is nearly always the system doing its
 * job, so the message explains which rule applied and what to do instead. It is
 * never a stack trace, and never a reproach: a rule that blocks an action is a
 * prompt to think, not a telling-off.
 */
export function toUserMessage(error: DatabaseErrorLike | null | undefined): string {
  const recognised = recogniseError(error);

  if (recognised?.kind === "rule_violation") {
    return ptBR.rules[recognised.ruleCode].blocked;
  }

  if (recognised?.kind === "constraint_violation") {
    switch (recognised.constraint) {
      case "cycles_one_active_per_user":
        return ptBR.hierarchy.cycle.alreadyActive;
      case "mission_sessions_no_overlap":
        return ptBR.session.overlap;
      case "mission_sessions_one_running_per_user":
        return ptBR.session.alreadyRunning;
      case "mission_sessions_not_in_future":
        return ptBR.session.inFuture;
      case "mission_sessions_mission_active":
        return ptBR.session.missionNotActive;
      case "mission_sessions_period_valid":
        return ptBR.session.periodInvalid;
      case "mission_evidence_mission_active":
        return ptBR.evidence.missionNotActive;
      case "mission_evidence_url_valid":
        return ptBR.evidence.urlInvalid;
      case "mission_evidence_criterion_same_mission":
        return ptBR.evidence.criterionOtherMission;
      case "mission_dod_criteria_satisfy_active":
        return ptBR.mission.satisfyOnlyActive;
      case "mission_reviews_justification_substantive":
        return ptBR.review.justificationShort;
      case "mission_reviews_reason_category_valid":
        return ptBR.review.categoryRequired;
      case "mission_reviews_outcome_valid":
        return ptBR.review.outcomeRequired;
      case "knowledge_links_no_self_link":
        return ptBR.knowledge.selfLink;
      case "knowledge_links_unique_triple":
        return ptBR.knowledge.duplicateLink;
      case "knowledge_notes_title_not_blank":
        return ptBR.knowledge.titleRequired;
    }
  }

  if (recognised?.kind === "not_found") {
    return ptBR.errors.notFound;
  }

  return ptBR.errors.unexpected;
}

export interface ActionState {
  readonly error?: string;
  /**
   * Set when the refusal came from a named rule.
   *
   * The message alone is enough to say what happened, but not enough to make
   * the block useful: a rule that blocks an action should also be able to
   * explain why it exists and what the legitimate alternative is. Carrying the
   * code lets the interface render that, instead of a sentence in red.
   */
  readonly ruleCode?: RuleCode;
}

/** Nothing went wrong, and nothing needs saying. */
export const OK: ActionState = {};

/**
 * A refused write, as the interface needs it: the explanation, plus the rule
 * that produced it when there was one.
 */
export function toActionState(error: DatabaseErrorLike | null | undefined): ActionState {
  const recognised = recogniseError(error);

  return {
    error: toUserMessage(error),
    ruleCode: recognised?.kind === "rule_violation" ? recognised.ruleCode : undefined,
  };
}

/**
 * A rule's own explanation, for when the form catches what the database would.
 *
 * Same shape as a refusal that came back from Postgres, deliberately: the
 * interface should render both identically, because to the person in front of
 * it they are the same event.
 */
export function ruleState(ruleCode: RuleCode): ActionState {
  return { error: ptBR.rules[ruleCode].blocked, ruleCode };
}
