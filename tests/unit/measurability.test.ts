import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ptBR } from "@/lib/i18n/pt-BR";
import { assessCriterion, missionMeasurability } from "@/lib/rules/measurability";
import { getRule } from "@/lib/rules/registry";

/**
 * RULE-101 is the one rule in the mission flow that must never block.
 *
 * The tests below therefore check two different things: that the heuristic is
 * useful, and — more importantly — that it has stayed advisory. A measurability
 * check that hardens into a gate would break the rigid-invariants /
 * flexible-variables split the whole product rests on, and it would do so
 * quietly, because every individual step towards it looks like an improvement.
 */

describe("RULE-101 stays advisory", () => {
  it("is registered as ADVISORY, not HARD", () => {
    expect(getRule("RULE-101")?.enforcement).toBe("ADVISORY");
  });

  it("says the mission lacks a verifiable criterion, without refusing anything", () => {
    const message = ptBR.rules["RULE-101"].blocked;

    expect(message.toLowerCase()).toContain("critério de conclusão verificável");
    for (const refusal of ["não é permitido", "bloquead", "impossível", "corrija"]) {
      expect(message.toLowerCase()).not.toContain(refusal);
    }
  });

  it("exposes no function that could refuse a write", () => {
    // The module is pure by construction. If a throw ever appears in it, the
    // advisory has acquired the ability to stop something.
    const source = readFileSync("lib/rules/measurability.ts", "utf8");
    expect(source).not.toMatch(/\bthrow\b/);
  });
});

describe("criteria with an observable outcome", () => {
  const verifiable = [
    "Reproduzir oito labs sem seguir walkthrough",
    "Escrever um relatório de cada vulnerabilidade encontrada",
    "Publicar o writeup no repositório",
    "Resolver 3 desafios do PortSwigger",
    "Documentar o processo em um diagrama",
    "Entregar a apresentação para o time",
  ];

  for (const criterion of verifiable) {
    it(`accepts: ${criterion}`, () => {
      expect(assessCriterion(criterion).verifiable).toBe(true);
    });
  }

  it("reads accented and unaccented prose alike", () => {
    expect(assessCriterion("Publicar o relatorio").verifiable).toBe(true);
    expect(assessCriterion("Publicar o relatório").verifiable).toBe(true);
  });

  it("counts a bare quantity as a commitment", () => {
    // A number is the cheapest honest thing a criterion can carry.
    expect(assessCriterion("15 exercícios").signals).toContain("quantity");
  });
});

describe("criteria with nothing to observe", () => {
  const vague = [
    "Estudar web exploitation",
    "Aprender mais sobre segurança",
    "Entender melhor a base",
    "Ficar bom nisso",
    "Praticar bastante",
  ];

  for (const criterion of vague) {
    it(`flags: ${criterion}`, () => {
      expect(assessCriterion(criterion).verifiable).toBe(false);
    });
  }

  it("does not mistake a word that merely contains a stem", () => {
    // "lab" inside "trabalho" would be the worst possible false positive: it
    // would bless the vaguest criterion anyone is likely to write.
    expect(assessCriterion("Trabalhar nisso todo dia").verifiable).toBe(false);
  });

  it("treats an empty criterion as having no signal", () => {
    expect(assessCriterion("   ").verifiable).toBe(false);
  });
});

describe("the mission-level advisory", () => {
  it("fires when no criterion names an outcome", () => {
    const result = missionMeasurability(["Estudar bastante", "Ficar melhor"]);
    expect(result.needsAdvisory).toBe(true);
    expect(result.verifiableCount).toBe(0);
  });

  /**
   * The advisory's own words are "esta missão ainda não possui um critério de
   * conclusão verificável". With one good criterion present that sentence is
   * simply false, so it must not appear — the per-criterion hint carries the
   * quieter observation instead.
   */
  it("stays quiet when at least one criterion is verifiable", () => {
    const result = missionMeasurability(["Estudar bastante", "Publicar o relatório"]);
    expect(result.needsAdvisory).toBe(false);
    expect(result.verifiableCount).toBe(1);
  });

  it("says nothing about a mission with no criteria yet", () => {
    expect(missionMeasurability([]).needsAdvisory).toBe(false);
    expect(missionMeasurability(["", "  "]).needsAdvisory).toBe(false);
  });

  it("ignores blank rows when counting", () => {
    expect(missionMeasurability(["Publicar o relatório", "", "  "]).total).toBe(1);
  });
});
