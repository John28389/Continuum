import { describe, expect, it } from "vitest";

import { groupByEnforcement, rulesToDisplay, type RuleRowLike } from "@/lib/rules/rule-display";

/**
 * The Rules page must never claim a protection the database is not applying.
 * These tests are about what it refuses to show as much as what it shows.
 */

const row = (code: string, overrides: Partial<RuleRowLike> = {}): RuleRowLike => ({
  code,
  severity: "critical",
  enforcement: "HARD",
  active: true,
  position: Number(code.slice(-3)),
  ...overrides,
});

const event = (id: string, rule_code: string, created_at: string, outcome = "blocked") => ({
  id,
  rule_code,
  outcome,
  created_at,
});

describe("what the page may show", () => {
  it("shows only rules the table lists", () => {
    // RULE-002 exists in the registry but not in these rows: it must not appear.
    const shown = rulesToDisplay([row("RULE-001"), row("RULE-003")], []);
    expect(shown.map((r) => r.code)).toEqual(["RULE-001", "RULE-003"]);
  });

  it("hides a rule the table marks inactive", () => {
    const shown = rulesToDisplay([row("RULE-001"), row("RULE-004", { active: false })], []);
    expect(shown.map((r) => r.code)).toEqual(["RULE-001"]);
  });

  it("skips a code this application cannot describe", () => {
    expect(rulesToDisplay([row("RULE-999")], [])).toEqual([]);
  });

  it("skips a row whose level or severity is outside the vocabulary", () => {
    expect(rulesToDisplay([row("RULE-001", { enforcement: "MAYBE" })], [])).toEqual([]);
    expect(rulesToDisplay([row("RULE-001", { severity: "extreme" })], [])).toEqual([]);
  });

  /**
   * The table is the authority. If it says a rule only advises, the page says
   * so — even though the registry in this codebase says it blocks.
   */
  it("takes severity and enforcement from the table, not the registry", () => {
    const [shown] = rulesToDisplay(
      [row("RULE-001", { enforcement: "ADVISORY", severity: "low" })],
      [],
    );
    expect(shown?.enforcement).toBe("ADVISORY");
    expect(shown?.severity).toBe("low");
  });

  it("orders by the table's position", () => {
    const shown = rulesToDisplay(
      [row("RULE-003", { position: 3 }), row("RULE-001", { position: 1 })],
      [],
    );
    expect(shown.map((r) => r.code)).toEqual(["RULE-001", "RULE-003"]);
  });
});

describe("recent events per rule", () => {
  const events = [
    event("a", "RULE-001", "2026-09-10T10:00:00+00:00"),
    event("b", "RULE-001", "2026-09-11T10:00:00+00:00"),
    event("c", "RULE-004", "2026-09-11T09:00:00+00:00"),
    event("d", "RULE-001", "2026-09-09T10:00:00+00:00"),
    event("e", "RULE-001", "2026-09-11T12:00:00-03:00"),
  ];

  it("attaches each rule's own events, newest first", () => {
    const [first, second] = rulesToDisplay([row("RULE-001"), row("RULE-004")], events);
    expect(first?.recentEvents.map((e) => e.id)).toEqual(["e", "b", "a"]);
    expect(second?.recentEvents.map((e) => e.id)).toEqual(["c"]);
  });

  it("compares instants, not strings, whatever the offset", () => {
    // 12:00 at -03:00 is 15:00 UTC, later than 10:00 UTC the same day.
    const [first] = rulesToDisplay([row("RULE-001")], events);
    expect(first?.recentEvents[0]?.id).toBe("e");
  });

  it("caps the list: enough to see the rule working, not a log", () => {
    const [first] = rulesToDisplay([row("RULE-001")], events);
    expect(first?.recentEvents).toHaveLength(3);
  });

  it("gives a rule with no events an empty list", () => {
    expect(rulesToDisplay([row("RULE-002")], events)[0]?.recentEvents).toEqual([]);
  });
});

describe("sections", () => {
  it("groups by enforcement in a fixed order, omitting empty levels", () => {
    const shown = rulesToDisplay(
      [
        row("RULE-101", { enforcement: "ADVISORY", position: 101 }),
        row("RULE-001", { position: 1 }),
      ],
      [],
    );
    expect(groupByEnforcement(shown).map((s) => s.enforcement)).toEqual(["HARD", "ADVISORY"]);
  });
});
