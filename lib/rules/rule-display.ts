/**
 * What the Rules page is allowed to claim.
 *
 * The page reads the `rules` table, not the registry, and this is the function
 * that turns those rows into what gets shown. A rule the table does not list —
 * or lists as inactive — is not shown at all, so the page can never tell the
 * user they are protected by something the database is not enforcing. Severity
 * and enforcement level come from the row for the same reason; the registry
 * only supplies the codes this application knows how to describe.
 *
 * Pure: rows and events in, display model out. The copy is attached by the
 * component, so this file stays free of the i18n layer.
 */

import {
  RULE_ENFORCEMENTS,
  RULE_SEVERITIES,
  isRuleCode,
  type RuleCode,
  type RuleEnforcement,
  type RuleSeverity,
} from "./registry";

export interface RuleRowLike {
  readonly code: string;
  readonly severity: string;
  readonly enforcement: string;
  readonly active: boolean;
  readonly position: number;
}

export interface RuleEventLike {
  readonly id: string;
  readonly rule_code: string;
  readonly outcome: string;
  readonly created_at: string;
}

export interface DisplayedRule {
  readonly code: RuleCode;
  readonly severity: RuleSeverity;
  readonly enforcement: RuleEnforcement;
  readonly position: number;
  /** Newest first, at most RECENT_EVENTS_PER_RULE. */
  readonly recentEvents: readonly RuleEventLike[];
}

export interface RuleSection {
  readonly enforcement: RuleEnforcement;
  readonly rules: readonly DisplayedRule[];
}

/** Enough to see that a rule is doing something, not a log. History is M15's page. */
export const RECENT_EVENTS_PER_RULE = 3;

function isSeverity(value: string): value is RuleSeverity {
  return (RULE_SEVERITIES as readonly string[]).includes(value);
}

function isEnforcement(value: string): value is RuleEnforcement {
  return (RULE_ENFORCEMENTS as readonly string[]).includes(value);
}

export function rulesToDisplay(
  rows: readonly RuleRowLike[],
  events: readonly RuleEventLike[],
  perRule: number = RECENT_EVENTS_PER_RULE,
): DisplayedRule[] {
  const newestFirst = [...events].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );

  const displayed: DisplayedRule[] = [];
  for (const row of [...rows].sort((a, b) => a.position - b.position)) {
    // Inactive, unknown to this application, or carrying a value outside the
    // vocabulary: not shown. Showing it would mean inventing a description.
    if (!row.active || !isRuleCode(row.code)) continue;
    if (!isSeverity(row.severity) || !isEnforcement(row.enforcement)) continue;

    displayed.push({
      code: row.code,
      severity: row.severity,
      enforcement: row.enforcement,
      position: row.position,
      recentEvents: newestFirst.filter((event) => event.rule_code === row.code).slice(0, perRule),
    });
  }

  return displayed;
}

/**
 * Grouped by what the rule does when it applies: blocks, asks, or advises.
 * Always in that order, and a level with no rules has no section.
 */
export function groupByEnforcement(rules: readonly DisplayedRule[]): RuleSection[] {
  return RULE_ENFORCEMENTS.map((enforcement) => ({
    enforcement,
    rules: rules.filter((rule) => rule.enforcement === enforcement),
  })).filter((section) => section.rules.length > 0);
}
