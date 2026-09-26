import { describe, expect, it } from "vitest";

import { ptBR, ruleCopy, rulesForDisplay } from "@/lib/i18n/pt-BR";
import {
  NOT_FOUND_SQLSTATE,
  RULE_VIOLATION_SQLSTATE,
  isRuleViolation,
  recogniseError,
} from "@/lib/rules/errors";
import { RULES } from "@/lib/rules/registry";

describe("database error recognition", () => {
  it("recognises a rule violation and recovers its rule code", () => {
    const recognised = recogniseError({
      code: RULE_VIOLATION_SQLSTATE,
      message: "A missao nao pode ser ativada sem criterio.",
      details: "RULE-002",
    });

    expect(recognised).toEqual({
      kind: "rule_violation",
      ruleCode: "RULE-002",
      databaseMessage: "A missao nao pode ser ativada sem criterio.",
    });
  });

  it("recognises a not-found signal as distinct from a refusal", () => {
    const recognised = recogniseError({
      code: NOT_FOUND_SQLSTATE,
      message: "Missao nao encontrada.",
    });
    expect(recognised?.kind).toBe("not_found");
  });

  /**
   * A partial unique index cannot raise a custom SQLSTATE, so RULE-001 arrives
   * as a plain uniqueness error naming the index. Recovering the rule from the
   * constraint name is what lets the user see an explanation instead of
   * "duplicate key value violates unique constraint".
   */
  it("maps the single-active-mission index to RULE-001", () => {
    expect(
      isRuleViolation(
        {
          code: "23505",
          message: 'duplicate key value violates unique constraint "missions_one_active_per_user"',
        },
        "RULE-001",
      ),
    ).toBe(true);
  });

  it("maps the load check constraint to RULE-003", () => {
    expect(
      isRuleViolation(
        {
          code: "23514",
          message: 'new row violates check constraint "missions_load_coherent"',
        },
        "RULE-003",
      ),
    ).toBe(true);
  });

  it("returns null for an unrelated database error rather than guessing", () => {
    expect(recogniseError({ code: "08006", message: "connection failure" })).toBeNull();
    expect(recogniseError(null)).toBeNull();
    expect(recogniseError(undefined)).toBeNull();
  });

  it("does not report a rule violation when the rule code is missing", () => {
    // Explaining a refusal with the wrong rule is worse than explaining it
    // generically, so an unrecoverable code is not guessed at.
    expect(
      recogniseError({ code: RULE_VIOLATION_SQLSTATE, message: "boom", details: "RULE-999" }),
    ).toBeNull();
  });

  it("does not match a rule when asked about a different one", () => {
    const error = { code: RULE_VIOLATION_SQLSTATE, message: "x", details: "RULE-002" };
    expect(isRuleViolation(error, "RULE-002")).toBe(true);
    expect(isRuleViolation(error, "RULE-001")).toBe(false);
  });
});

describe("pt-BR copy", () => {
  it("has copy for every rule in the registry", () => {
    for (const rule of RULES) {
      const copy = ruleCopy(rule.code);
      expect(copy, `${rule.code} has no copy`).toBeDefined();
      expect(copy.name.length, `${rule.code} name`).toBeGreaterThan(0);
      expect(copy.description.length, `${rule.code} description`).toBeGreaterThan(0);
      expect(copy.rationale.length, `${rule.code} rationale`).toBeGreaterThan(0);
      expect(copy.exceptions.length, `${rule.code} exceptions`).toBeGreaterThan(0);
    }
  });

  it("gives every hard rule a message explaining the block", () => {
    // A hard rule that blocks without explaining itself reads as a bug.
    for (const rule of RULES.filter((r) => r.enforcement === "HARD")) {
      expect(ruleCopy(rule.code).blocked.length, `${rule.code} blocked message`).toBeGreaterThan(0);
    }
  });

  it("orders rules for display by position", () => {
    const positions = rulesForDisplay().map((r) => r.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("names exactly the seven navigation areas", () => {
    expect(Object.keys(ptBR.nav)).toEqual([
      "dashboard",
      "missions",
      "curiosities",
      "knowledge",
      "history",
      "rules",
      "settings",
    ]);
  });

  it("states completion without qualifying it", () => {
    // Finishing early is the system working. The completion string must not be
    // followed by a nudge to do more.
    expect(ptBR.mission.completed).toBe("MISSÃO CONCLUÍDA");
    expect(ptBR.mission.completedFreedom).not.toMatch(/\d+%/);
  });

  it("distinguishes the four content classes", () => {
    const classes = Object.values(ptBR.contentClass);
    expect(new Set(classes).size).toBe(4);
  });
});
