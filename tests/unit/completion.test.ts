import { describe, expect, it } from "vitest";

import { ptBR } from "@/lib/i18n/pt-BR";
import { completionReadiness, type CriterionState } from "@/lib/rules/completion";
import { getRule } from "@/lib/rules/registry";

const open = (id: string): CriterionState => ({ id, description: `c${id}`, satisfied_at: null });
const done = (id: string): CriterionState => ({
  id,
  description: `c${id}`,
  satisfied_at: "2026-09-11T12:00:00+00:00",
});

describe("RULE-008 — completion by the Definition of Done", () => {
  it("is registered as a hard rule", () => {
    expect(getRule("RULE-008")?.enforcement).toBe("HARD");
  });

  it("is ready only when every criterion is satisfied", () => {
    expect(completionReadiness("active", [done("1"), done("2")]).ready).toBe(true);
    expect(completionReadiness("active", [done("1"), open("2")]).ready).toBe(false);
  });

  it("names what is still open, in order", () => {
    const readiness = completionReadiness("active", [open("1"), done("2"), open("3")]);
    expect(readiness.open.map((c) => c.id)).toEqual(["1", "3"]);
    expect(readiness.total).toBe(3);
  });

  /** An emptied Definition of Done is not a satisfied one. */
  it("is never ready with no criteria at all", () => {
    expect(completionReadiness("active", []).ready).toBe(false);
  });

  it("is ready only from active", () => {
    for (const status of ["draft", "completed", "revised", "abandoned"] as const) {
      expect(completionReadiness(status, [done("1")]).ready, status).toBe(false);
    }
  });

  /**
   * The failure mode the roadmap names: hours gating completion. The guard is
   * structural — the function has no parameter through which hours could
   * arrive. If someone adds one, this fails and sends them to the comment in
   * lib/rules/completion.ts first.
   */
  it("takes no hours: status and criteria are its only inputs", () => {
    expect(completionReadiness.length).toBe(2);
  });
});

describe("RULE-008 copy", () => {
  const copy = ptBR.rules["RULE-008"];

  it("explains the block and the way forward", () => {
    expect(copy.blocked.toLowerCase()).toContain("critérios");
    expect(copy.blocked.toLowerCase()).toContain("satisfeito");
  });

  it("says hours do not decide completion", () => {
    expect(copy.rationale.toLowerCase()).toContain("não as horas");
  });

  it("does not scold", () => {
    for (const scolding of ["você errou", "proibido", "não pode fazer isso", "falhou"]) {
      expect(copy.blocked.toLowerCase()).not.toContain(scolding);
    }
  });
});
