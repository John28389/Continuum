import { describe, expect, it } from "vitest";

import {
  computeIntegrity,
  concludedMissions,
  type MissionSummary,
  type ReviewSummary,
  type RuleEventSummary,
} from "@/lib/rules/integrity";

const noInput = { missions: [], reviews: [], ruleEvents: [] } as const;

describe("mission integrity", () => {
  it("returns zeroes for a user who has not started yet", () => {
    const record = computeIntegrity(noInput);

    expect(record.missionsCompleted).toBe(0);
    expect(record.missionsRevised).toBe(0);
    expect(record.missionsAbandoned).toBe(0);
    expect(record.impulseAttemptsBlocked).toBe(0);
    expect(concludedMissions(record)).toBe(0);
  });

  it("counts missions by terminal state", () => {
    const missions: MissionSummary[] = [
      { status: "completed" },
      { status: "completed" },
      { status: "revised" },
      { status: "abandoned" },
      { status: "active" },
      { status: "draft" },
    ];

    const record = computeIntegrity({ ...noInput, missions });

    expect(record.missionsCompleted).toBe(2);
    expect(record.missionsRevised).toBe(1);
    expect(record.missionsAbandoned).toBe(1);
    expect(record.missionsActive).toBe(1);
    expect(record.missionsDraft).toBe(1);
  });

  it("excludes drafts and the mission in flight from the concluded count", () => {
    const record = computeIntegrity({
      ...noInput,
      missions: [{ status: "completed" }, { status: "active" }, { status: "draft" }],
    });

    // Neither the draft nor the active mission has had its chance yet, so
    // counting them would understate reliability rather than measure it.
    expect(concludedMissions(record)).toBe(1);
  });

  it("groups reviews by the reason given", () => {
    const reviews: ReviewSummary[] = [
      { outcome: "revised", reasonCategory: "premise_changed" },
      { outcome: "abandoned", reasonCategory: "premise_changed" },
      { outcome: "kept", reasonCategory: "scope_error" },
    ];

    const record = computeIntegrity({ ...noInput, reviews });

    expect(record.reviewsByCategory.premise_changed).toBe(2);
    expect(record.reviewsByCategory.scope_error).toBe(1);
    expect(record.reviewsByCategory.external_dependency).toBe(0);
    expect(record.reviewsKept).toBe(1);
  });

  it("counts blocked attempts to break a commitment", () => {
    const ruleEvents: RuleEventSummary[] = [
      { ruleCode: "RULE-001", outcome: "blocked" },
      { ruleCode: "RULE-004", outcome: "blocked" },
      { ruleCode: "RULE-007", outcome: "blocked" },
      // Advisory nudges are not the system holding a line.
      { ruleCode: "RULE-101", outcome: "advised" },
      // Nor is a rule that merely reported something.
      { ruleCode: "RULE-102", outcome: "advised" },
    ];

    const record = computeIntegrity({ ...noInput, ruleEvents });

    expect(record.impulseAttemptsBlocked).toBe(3);
  });

  it("does not count an advisory rule as a blocked commitment even if marked blocked", () => {
    const record = computeIntegrity({
      ...noInput,
      ruleEvents: [{ ruleCode: "RULE-103", outcome: "blocked" }],
    });

    expect(record.impulseAttemptsBlocked).toBe(0);
  });

  it("produces no score, level or streak", () => {
    const record = computeIntegrity({
      ...noInput,
      missions: [{ status: "completed" }],
    });

    // Guarding the product decision, not the implementation: the moment a
    // single number summarises this, it becomes the thing being optimised.
    for (const forbidden of ["score", "points", "xp", "level", "streak", "rank", "badge"]) {
      expect(Object.keys(record).map((k) => k.toLowerCase())).not.toContain(forbidden);
    }
  });

  it("is pure: computing twice from the same input gives the same result", () => {
    const input = {
      missions: [{ status: "completed" }] as MissionSummary[],
      reviews: [{ outcome: "revised", reasonCategory: "scope_error" }] as ReviewSummary[],
      ruleEvents: [{ ruleCode: "RULE-001", outcome: "blocked" }] as RuleEventSummary[],
    };

    expect(computeIntegrity(input)).toEqual(computeIntegrity(input));
  });
});
