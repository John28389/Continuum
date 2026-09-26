import { describe, expect, it } from "vitest";

import { cycleProgress } from "@/lib/domain/cycle";

const cycle = { starts_on: "2026-09-01", ends_on: "2026-10-01" };

/** Midday UTC, so a timezone slip would not be hidden by rounding to midnight. */
const on = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("cycle progress", () => {
  it("reports the full span remaining on the first day", () => {
    const progress = cycleProgress(cycle, on("2026-09-01"));

    expect(progress.totalDays).toBe(30);
    expect(progress.elapsedDays).toBe(0);
    expect(progress.remainingDays).toBe(30);
    expect(progress.elapsedFraction).toBe(0);
    expect(progress.hasEnded).toBe(false);
  });

  it("counts elapsed days part-way through", () => {
    const progress = cycleProgress(cycle, on("2026-09-16"));

    expect(progress.elapsedDays).toBe(15);
    expect(progress.remainingDays).toBe(15);
    expect(progress.elapsedFraction).toBeCloseTo(0.5, 5);
  });

  it("reaches zero remaining on the final day without overshooting", () => {
    const progress = cycleProgress(cycle, on("2026-10-01"));

    expect(progress.remainingDays).toBe(0);
    expect(progress.elapsedFraction).toBe(1);
    expect(progress.hasEnded).toBe(false);
  });

  it("clamps rather than reporting negative time once the cycle is over", () => {
    const progress = cycleProgress(cycle, on("2026-10-20"));

    expect(progress.elapsedDays).toBe(30);
    expect(progress.remainingDays).toBe(0);
    expect(progress.elapsedFraction).toBe(1);
    expect(progress.hasEnded).toBe(true);
  });

  it("clamps before the cycle has started", () => {
    const progress = cycleProgress(cycle, on("2026-08-20"));

    expect(progress.elapsedDays).toBe(0);
    expect(progress.remainingDays).toBe(30);
  });

  it("never divides by zero on a one-day cycle", () => {
    const progress = cycleProgress(
      { starts_on: "2026-09-01", ends_on: "2026-09-02" },
      on("2026-09-01"),
    );

    expect(progress.totalDays).toBe(1);
    expect(Number.isFinite(progress.elapsedFraction)).toBe(true);
  });

  it("is not shifted by the local timezone", () => {
    // Late in the day UTC and early the next day in some zones. Day arithmetic
    // must come from the UTC calendar date, not from a local offset.
    const late = cycleProgress(cycle, new Date("2026-09-16T23:59:00Z"));
    const early = cycleProgress(cycle, new Date("2026-09-16T00:01:00Z"));

    expect(late.elapsedDays).toBe(early.elapsedDays);
  });

  it("keeps the fraction within bounds across the whole span", () => {
    for (let day = 1; day <= 31; day += 1) {
      const iso = `2026-09-${String(day).padStart(2, "0")}`;
      const { elapsedFraction } = cycleProgress(cycle, on(iso));
      expect(elapsedFraction).toBeGreaterThanOrEqual(0);
      expect(elapsedFraction).toBeLessThanOrEqual(1);
    }
  });
});
