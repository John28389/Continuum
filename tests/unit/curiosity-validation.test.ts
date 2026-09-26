import { describe, expect, it } from "vitest";

import { captureSchema, curiosityStateSchema, promoteSchema } from "@/lib/validation/curiosity";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("capture needs only a title", () => {
  it("accepts a bare title", () => {
    expect(captureSchema.safeParse({ title: "Wireless security" }).success).toBe(true);
  });

  it("refuses a title that is only whitespace", () => {
    expect(captureSchema.safeParse({ title: "   " }).success).toBe(false);
  });
});

describe("a direct state change", () => {
  it("accepts each settable state", () => {
    for (const state of ["captured", "waiting", "candidate", "archived"]) {
      expect(curiosityStateSchema.safeParse({ curiosityId: uuid, state }).success).toBe(true);
    }
  });

  /**
   * `chosen` only ever comes from promotion, alongside the mission it
   * produced. Accepting it here would let the two disagree about whether a
   * curiosity was actually promoted.
   */
  it("refuses chosen as a direct state change", () => {
    expect(curiosityStateSchema.safeParse({ curiosityId: uuid, state: "chosen" }).success).toBe(
      false,
    );
  });

  it("refuses a state outside the known set", () => {
    expect(curiosityStateSchema.safeParse({ curiosityId: uuid, state: "urgent" }).success).toBe(
      false,
    );
  });
});

describe("promotion input", () => {
  const promotion = {
    curiosityId: uuid,
    campaignId: uuid,
    title: "Wireless security",
    reason: "Promoted from the parking lot at a cycle boundary",
    minLoadMinutes: "24",
    targetLoadMinutes: "30",
  };

  it("accepts a complete promotion", () => {
    expect(promoteSchema.safeParse(promotion).success).toBe(true);
  });

  it("has no cycle field: the database always targets the active cycle", () => {
    const parsed = promoteSchema.parse(promotion);
    expect(Object.keys(parsed).sort()).toEqual([
      "campaignId",
      "curiosityId",
      "minLoadMinutes",
      "reason",
      "targetLoadMinutes",
      "title",
    ]);
  });

  it("mirrors RULE-003: a target below the minimum is refused", () => {
    const result = promoteSchema.safeParse({
      ...promotion,
      minLoadMinutes: "30",
      targetLoadMinutes: "24",
    });
    expect(result.success).toBe(false);
  });

  it("requires a campaign and a reason", () => {
    expect(promoteSchema.safeParse({ ...promotion, campaignId: "" }).success).toBe(false);
    expect(promoteSchema.safeParse({ ...promotion, reason: "" }).success).toBe(false);
  });

  it("converts hours to minutes", () => {
    expect(promoteSchema.parse(promotion).minLoadMinutes).toBe(1440);
  });
});
