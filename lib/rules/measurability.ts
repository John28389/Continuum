/**
 * RULE-101 — the measurability advisory.
 *
 * A Definition-of-Done criterion is useful only if someone could look at the
 * world afterwards and say whether it happened. "Estudar web exploitation"
 * cannot be finished, only abandoned; "reproduzir oito labs sem walkthrough"
 * can.
 *
 * This module answers, heuristically, whether a criterion names an observable
 * outcome. Three properties are deliberate and must survive any future edit:
 *
 *   1. It is ADVISORY. Nothing here may ever gate a write. Judging whether
 *      prose is measurable is exactly the kind of decision that stays with the
 *      user, and hardening this into a block would break the rigid-invariants /
 *      flexible-variables split the product is built on.
 *   2. It is pure. No I/O, no framework imports, so it can be reasoned about
 *      and tested in isolation like the rest of `lib/rules/`.
 *   3. It under-flags rather than over-flags. A missed vague criterion costs
 *      silence; a wrongly flagged good one costs nagging, and a system that
 *      nags about prose is one the user starts ignoring.
 */

/** What made a criterion look verifiable. Surfaced so the hint can be specific. */
export const MEASURABILITY_SIGNALS = ["quantity", "outcome_verb", "artefact"] as const;
export type MeasurabilitySignal = (typeof MEASURABILITY_SIGNALS)[number];

export interface CriterionAssessment {
  readonly verifiable: boolean;
  readonly signals: readonly MeasurabilitySignal[];
}

/**
 * Verb stems that describe producing or establishing something inspectable.
 *
 * Stems rather than whole words, so conjugations are covered without a
 * stemmer. Each entry was checked against the obvious false friends: anything
 * that would also match an unrelated common word was written out in full or
 * dropped.
 */
const OUTCOME_VERB_STEMS = [
  "entreg",
  "public",
  "escrev",
  "escrit",
  "resolv",
  "reproduz",
  "document",
  "apresent",
  "submet",
  "implement",
  "demonstr",
  "explic",
  "conclu",
  "finaliz",
  "produz",
  "refator",
  "automatiz",
  "identific",
  "corrig",
  "valid",
  "verific",
  "export",
  "mape",
  "registr",
  "resum",
  "traduz",
  "aprov",
  "obter",
  "atingir",
  "encontr",
  "compar",
  "constru",
  "configur",
  "deploy",
] as const;

/**
 * Nouns for things that exist after the work and can be pointed at.
 *
 * Consumption artefacts — aula, capítulo, página, módulo — are deliberately
 * absent. "Assistir às aulas" names something countable but no outcome, and
 * treating it as verifiable would let the advisory bless exactly the criterion
 * it exists to question.
 */
const ARTEFACT_STEMS = [
  "relatorio",
  "artigo",
  "writeup",
  "write-up",
  "repositorio",
  "prototipo",
  "documento",
  "resumo",
  "exercicio",
  "desafio",
  "certificado",
  "projeto",
  "script",
  "evidencia",
  "apresentacao",
  "commit",
  "teste",
  "demo",
  "post",
  "lab",
  "readme",
  "diagrama",
  "planilha",
  "video",
] as const;

/** Lowercase and strip accents, so "relatório" and "relatorio" match alike. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function containsStem(text: string, stems: readonly string[]): boolean {
  // Anchored at a word start only: matching mid-word would make "lab" fire on
  // "trabalho", which is close to the worst possible false positive here.
  return stems.some((stem) => new RegExp(`(?:^|[^\p{L}])${stem}`, "u").test(text));
}

/**
 * Whether a single criterion names something observable.
 *
 * A digit counts on its own: a number is the cheapest honest commitment a
 * criterion can carry, and "oito labs" is checkable even without a verb.
 */
export function assessCriterion(description: string): CriterionAssessment {
  const text = normalise(description.trim());
  const signals: MeasurabilitySignal[] = [];

  if (/\d/.test(text)) signals.push("quantity");
  if (containsStem(text, OUTCOME_VERB_STEMS)) signals.push("outcome_verb");
  if (containsStem(text, ARTEFACT_STEMS)) signals.push("artefact");

  return { verifiable: signals.length > 0, signals };
}

export interface MissionMeasurability {
  readonly total: number;
  readonly verifiableCount: number;
  /** True when the mission has criteria and none of them names an outcome. */
  readonly needsAdvisory: boolean;
}

/**
 * The mission-level view.
 *
 * The advisory fires only when *no* criterion is verifiable, because that is
 * what its text actually claims — the mission does not yet have a verifiable
 * completion criterion. Firing per criterion would make the sentence false
 * whenever one good criterion sat beside one vague one. The per-criterion
 * assessment is still exposed, for the quieter inline hint while editing.
 */
export function missionMeasurability(descriptions: readonly string[]): MissionMeasurability {
  const present = descriptions.map((d) => d.trim()).filter((d) => d.length > 0);
  const verifiableCount = present.filter((d) => assessCriterion(d).verifiable).length;

  return {
    total: present.length,
    verifiableCount,
    needsAdvisory: present.length > 0 && verifiableCount === 0,
  };
}
