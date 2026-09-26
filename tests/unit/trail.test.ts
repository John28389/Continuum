import { describe, expect, it } from "vitest";

import { integrityInput } from "@/lib/domain/integrity";
import { ptBR } from "@/lib/i18n/pt-BR";
import { computeIntegrity } from "@/lib/rules/integrity";
import { evidenceTrail, TRAIL_STEPS, type TrailInput } from "@/lib/rules/trail";

const CREATED = "2026-09-01T12:00:00+00:00";

const bare: TrailInput = {
  createdAt: CREATED,
  completedAt: null,
  sessions: [],
  notes: [],
  evidence: [],
  criteria: [{ satisfied_at: null }],
};

function keys(input: TrailInput) {
  return evidenceTrail(input).map((step) => step.key);
}

describe("the trail of evidence", () => {
  it("starts with creation and shows nothing that has not happened", () => {
    expect(keys(bare)).toEqual(["created"]);
  });

  it("walks every step of a completed mission, in order", () => {
    const trail = evidenceTrail({
      createdAt: CREATED,
      completedAt: "2026-09-20T12:00:00+00:00",
      sessions: [{ started_at: "2026-09-02T12:00:00+00:00" }],
      notes: [
        {
          id: "n1",
          title: "Parâmetros refletidos sem escape",
          note_type: "discovery",
          created_at: "2026-09-05T12:00:00+00:00",
        },
      ],
      evidence: [{ description: "Writeup do lab 3", created_at: "2026-09-08T12:00:00+00:00" }],
      criteria: [
        { satisfied_at: "2026-09-10T12:00:00+00:00" },
        { satisfied_at: "2026-09-18T12:00:00+00:00" },
      ],
    });

    expect(trail.map((step) => step.key)).toEqual([...TRAIL_STEPS]);
    expect(trail.find((step) => step.key === "first_discovery")?.artifact).toEqual({
      text: "Parâmetros refletidos sem escape",
      href: "/knowledge/n1",
    });
    expect(trail.find((step) => step.key === "first_evidence")?.artifact).toEqual({
      text: "Writeup do lab 3",
      href: null,
    });
    expect(trail.find((step) => step.key === "halfway")?.at).toBe("2026-09-10T12:00:00+00:00");
    expect(trail.find((step) => step.key === "definition_of_done")?.at).toBe(
      "2026-09-18T12:00:00+00:00",
    );
  });

  it("takes the earliest of each, whatever order the rows arrive in", () => {
    const trail = evidenceTrail({
      ...bare,
      sessions: [
        { started_at: "2026-09-09T12:00:00+00:00" },
        { started_at: "2026-09-03T12:00:00+00:00" },
      ],
      evidence: [
        { description: "Depois", created_at: "2026-09-12T12:00:00+00:00" },
        { description: "Antes", created_at: "2026-09-04T12:00:00+00:00" },
      ],
    });

    expect(trail.find((step) => step.key === "first_session")?.at).toBe(
      "2026-09-03T12:00:00+00:00",
    );
    expect(trail.find((step) => step.key === "first_evidence")?.artifact?.text).toBe("Antes");
  });

  it("counts only discoveries as a discovery", () => {
    const notes = [
      { id: "c", title: "Conceito", note_type: "concept", created_at: CREATED },
      { id: "e", title: "Erro", note_type: "error", created_at: CREATED },
    ];

    expect(keys({ ...bare, notes })).toEqual(["created"]);
  });

  it("reaches halfway on half the Definition of Done, not on hours", () => {
    const criteria = [
      { satisfied_at: "2026-09-11T12:00:00+00:00" },
      { satisfied_at: "2026-09-10T12:00:00+00:00" },
      { satisfied_at: null },
      { satisfied_at: null },
    ];
    const trail = evidenceTrail({ ...bare, criteria });

    expect(trail.map((step) => step.key)).toEqual(["created", "halfway"]);
    expect(trail[1]?.at).toBe("2026-09-11T12:00:00+00:00");
  });

  it("gives a single criterion one step, not two at the same moment", () => {
    expect(keys({ ...bare, criteria: [{ satisfied_at: CREATED }] })).toEqual([
      "created",
      "definition_of_done",
    ]);
  });

  it("does not call an empty Definition of Done met", () => {
    expect(keys({ ...bare, criteria: [] })).toEqual(["created"]);
  });

  it("marks effort as effort, and carries no duration at all", () => {
    const trail = evidenceTrail({ ...bare, sessions: [{ started_at: CREATED }] });

    expect(trail.filter((step) => step.kind === "effort").map((step) => step.key)).toEqual([
      "first_session",
    ]);
    for (const step of trail) {
      expect(Object.keys(step).sort()).toEqual(["artifact", "at", "key", "kind"]);
    }
  });
});

describe("the integrity record's input", () => {
  it("leaves out values it has no name for, rather than miscounting them", () => {
    const input = integrityInput({
      missions: [{ status: "completed" }, { status: "something_new" }],
      reviews: [
        { outcome: "kept", reason_category: "scope_error" },
        { outcome: "kept", reason_category: "boredom" },
        { outcome: "paused", reason_category: "scope_error" },
      ],
      ruleEvents: [
        { rule_code: "RULE-001", outcome: "blocked" },
        { rule_code: "RULE-001", outcome: "shrugged" },
      ],
    });

    const record = computeIntegrity(input);
    expect(record.missionsCompleted).toBe(1);
    expect(record.reviewsKept).toBe(1);
    expect(record.reviewsByCategory.scope_error).toBe(1);
    expect(record.impulseAttemptsBlocked).toBe(1);
  });
});

describe("integrity and trail copy", () => {
  /**
   * Counts and history, never a game and never a verdict on the person. The
   * words below belong to scoring, or to characterising someone's behaviour.
   */
  it("uses no vocabulary of scoring or of diagnosis", () => {
    const text = JSON.stringify([ptBR.integrity, ptBR.trail]).toLowerCase();

    for (const word of [
      "pontos",
      "pontuação",
      "nível",
      "sequência",
      "xp",
      "ranking",
      "medalha",
      "conquista",
      "troféu",
      "%",
      "impuls",
      "fracass",
      "falhou",
      "disciplina",
      "deveria",
    ]) {
      expect(text, word).not.toContain(word);
    }
  });

  it("names every trail step", () => {
    for (const step of TRAIL_STEPS) {
      expect(ptBR.trail.steps[step], step).toBeTruthy();
    }
  });
});
