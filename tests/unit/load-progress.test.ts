import { describe, expect, it } from "vitest";

import { loadProgress, loggedMinutes } from "@/lib/domain/session";

/**
 * Hours are an input metric.
 *
 * These tests check the arithmetic, but the ones that matter most check what the
 * result *refuses to contain*. The likeliest drift in this whole project is
 * hours quietly becoming the primary progress measure, and the first step of
 * that drift is always a convenient percentage field that some screen then
 * renders as a bar.
 */

const loads = { min_load_minutes: 24 * 60, target_load_minutes: 30 * 60 };

describe("the three stages", () => {
  it("is below the minimum with nothing logged", () => {
    const progress = loadProgress(0, loads);
    expect(progress.stage).toBe("below_minimum");
    expect(progress.minutesToMinimum).toBe(24 * 60);
  });

  it("reaches the minimum exactly at the floor", () => {
    const progress = loadProgress(24 * 60, loads);
    expect(progress.stage).toBe("minimum_reached");
    expect(progress.minutesToMinimum).toBe(0);
  });

  it("reaches the target exactly at the target", () => {
    expect(loadProgress(30 * 60, loads).stage).toBe("target_reached");
  });

  it("stays at target_reached beyond it, with no surplus to report", () => {
    const progress = loadProgress(45 * 60, loads);
    expect(progress.stage).toBe("target_reached");
    expect(progress.minutesToMinimum).toBe(0);
  });

  it("treats a minimum equal to the target as one threshold", () => {
    const equal = { min_load_minutes: 600, target_load_minutes: 600 };
    expect(loadProgress(599, equal).stage).toBe("below_minimum");
    expect(loadProgress(600, equal).stage).toBe("target_reached");
  });

  it("never reports a negative distance or a negative total", () => {
    const progress = loadProgress(-30, loads);
    expect(progress.loggedMinutes).toBe(0);
    expect(progress.minutesToMinimum).toBe(24 * 60);
  });
});

describe("what load progress must never contain", () => {
  /**
   * The exact key set, asserted. A future field called `percent`, `fraction`,
   * `ratio`, `minutesToTarget` or `surplus` fails here, where someone has to
   * read this comment before adding it.
   */
  it("has exactly the expected fields", () => {
    expect(Object.keys(loadProgress(600, loads)).sort()).toEqual([
      "loggedMinutes",
      "minimumMinutes",
      "minutesToMinimum",
      "stage",
      "targetMinutes",
    ]);
  });

  it("carries no value that could be drawn as a bar", () => {
    // Every number in the result is a whole count of minutes, never a value
    // between zero and one.
    for (const [key, value] of Object.entries(loadProgress(1500, loads))) {
      if (typeof value !== "number") continue;
      expect(Number.isInteger(value), `${key} should be whole minutes`).toBe(true);
      expect(value === 0 || value >= 1, `${key} looks like a fraction: ${value}`).toBe(true);
    }
  });

  /** RULE-102. Reaching the target is a stage of the input, not an outcome. */
  it("has no notion of completing the mission", () => {
    const progress = loadProgress(100 * 60, loads);
    for (const key of Object.keys(progress)) {
      expect(key.toLowerCase()).not.toMatch(/complete|done|finish/);
    }
  });
});

describe("minutes logged", () => {
  it("sums finished sessions", () => {
    expect(
      loggedMinutes([
        { started_at: "2026-09-10T12:00:00+00:00", ended_at: "2026-09-10T13:30:00+00:00" },
        { started_at: "2026-09-10T14:00:00+00:00", ended_at: "2026-09-10T14:45:00+00:00" },
      ]),
    ).toBe(135);
  });

  it("leaves a running session out of the total", () => {
    expect(
      loggedMinutes([
        { started_at: "2026-09-10T12:00:00+00:00", ended_at: "2026-09-10T13:00:00+00:00" },
        { started_at: "2026-09-10T15:00:00+00:00", ended_at: null },
      ]),
    ).toBe(60);
  });

  /**
   * The timezone trap. The same instant written with two different offsets must
   * produce the same duration, and a session crossing midnight in São Paulo
   * must not come out a day long or negative.
   */
  it("is indifferent to the offset an instant is written in", () => {
    expect(
      loggedMinutes([
        { started_at: "2026-09-10T23:00:00-03:00", ended_at: "2026-09-11T05:00:00+00:00" },
      ]),
    ).toBe(180);
  });

  it("rounds once over the sum, not once per session", () => {
    // Twenty 30-second sessions are ten minutes, not zero and not twenty.
    const sessions = Array.from({ length: 20 }, (_, i) => ({
      started_at: new Date(Date.UTC(2026, 8, 10, 12, i, 0)).toISOString(),
      ended_at: new Date(Date.UTC(2026, 8, 10, 12, i, 30)).toISOString(),
    }));
    expect(loggedMinutes(sessions)).toBe(10);
  });

  it("is zero with nothing logged", () => {
    expect(loggedMinutes([])).toBe(0);
  });
});
