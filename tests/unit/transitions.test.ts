import { describe, expect, it } from "vitest";

import {
  MISSION_STATUSES,
  canTransition,
  isTerminal,
  legalTransitionsFrom,
  requiresReview,
  transitionViolation,
  type MissionStatus,
} from "@/lib/rules/transitions";

describe("mission transitions", () => {
  it("starts a mission in draft and lets it reach active", () => {
    expect(canTransition("draft", "active")).toBe(true);
  });

  it("treats completed, revised and abandoned as terminal", () => {
    for (const status of ["completed", "revised", "abandoned"] as const) {
      expect(isTerminal(status)).toBe(true);
      expect(legalTransitionsFrom(status)).toEqual([]);
    }
  });

  it("does not treat draft or active as terminal", () => {
    expect(isTerminal("draft")).toBe(false);
    expect(isTerminal("active")).toBe(false);
  });

  it("refuses every route out of a completed mission (RULE-006)", () => {
    for (const target of MISSION_STATUSES.filter((s) => s !== "completed")) {
      expect(canTransition("completed", target), `completed -> ${target}`).toBe(false);
      expect(transitionViolation("completed", target)).toBe("RULE-006");
    }
  });

  it("requires a review only when leaving an active mission", () => {
    expect(requiresReview("active", "revised")).toBe(true);
    expect(requiresReview("active", "abandoned")).toBe(true);

    // Completing is an ending the rule is not concerned with.
    expect(requiresReview("active", "completed")).toBe(false);

    // A draft was never committed to, so dropping it costs nothing.
    expect(requiresReview("draft", "abandoned")).toBe(false);
  });

  it("permits a no-op transition without reporting a violation", () => {
    for (const status of MISSION_STATUSES) {
      expect(transitionViolation(status, status)).toBeNull();
    }
  });

  it("reports no violation for each legal transition", () => {
    for (const from of MISSION_STATUSES) {
      for (const to of legalTransitionsFrom(from)) {
        expect(transitionViolation(from, to), `${from} -> ${to}`).toBeNull();
      }
    }
  });

  it("reports a violation for every transition that is not declared legal", () => {
    for (const from of MISSION_STATUSES) {
      const legal = new Set<MissionStatus>(legalTransitionsFrom(from));
      for (const to of MISSION_STATUSES) {
        if (to === from || legal.has(to)) continue;
        expect(transitionViolation(from, to), `${from} -> ${to} should be refused`).not.toBeNull();
      }
    }
  });

  it("never allows a direct jump from draft to completed", () => {
    // Completion has to pass through active, because evidence and sessions are
    // what make a completion meaningful.
    expect(canTransition("draft", "completed")).toBe(false);
  });
});
