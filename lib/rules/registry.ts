/**
 * The rule registry.
 *
 * This file carries only the machine-checkable metadata: which rules exist,
 * how severe they are, and whether the system blocks, asks, or merely advises.
 * The human-readable name, description, rationale and exceptions live in
 * `lib/i18n/pt-BR.ts`, keyed by the same codes, so the prose exists in exactly
 * one place.
 *
 * It must agree with the seed in the rules migration. A unit test parses that
 * migration and compares the two, because a Rules page that disagrees with what
 * the database actually enforces is worse than no Rules page: it tells the user
 * they are protected when they are not.
 */

export const RULE_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type RuleSeverity = (typeof RULE_SEVERITIES)[number];

/**
 * HARD     the database blocks it
 * SOFT     permitted, but requires explicit confirmation or justification
 * ADVISORY the system only recommends
 */
export const RULE_ENFORCEMENTS = ["HARD", "SOFT", "ADVISORY"] as const;
export type RuleEnforcement = (typeof RULE_ENFORCEMENTS)[number];

export interface RuleDefinition {
  readonly code: string;
  readonly severity: RuleSeverity;
  readonly enforcement: RuleEnforcement;
  readonly position: number;
}

export const RULES = [
  { code: "RULE-001", severity: "critical", enforcement: "HARD", position: 1 },
  { code: "RULE-002", severity: "critical", enforcement: "HARD", position: 2 },
  { code: "RULE-003", severity: "high", enforcement: "HARD", position: 3 },
  { code: "RULE-004", severity: "critical", enforcement: "HARD", position: 4 },
  { code: "RULE-005", severity: "high", enforcement: "HARD", position: 5 },
  { code: "RULE-006", severity: "high", enforcement: "HARD", position: 6 },
  { code: "RULE-007", severity: "critical", enforcement: "HARD", position: 7 },
  { code: "RULE-008", severity: "critical", enforcement: "HARD", position: 8 },
  { code: "RULE-101", severity: "medium", enforcement: "ADVISORY", position: 101 },
  { code: "RULE-102", severity: "medium", enforcement: "ADVISORY", position: 102 },
  { code: "RULE-103", severity: "medium", enforcement: "ADVISORY", position: 103 },
] as const satisfies readonly RuleDefinition[];

export type RuleCode = (typeof RULES)[number]["code"];

const BY_CODE = new Map<string, RuleDefinition>(RULES.map((rule) => [rule.code, rule]));

export function getRule(code: string): RuleDefinition | undefined {
  return BY_CODE.get(code);
}

export function isRuleCode(value: string): value is RuleCode {
  return BY_CODE.has(value);
}

/** The rules the database refuses outright. */
export function hardRules(): readonly RuleDefinition[] {
  return RULES.filter((rule) => rule.enforcement === "HARD");
}
