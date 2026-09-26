import { describe, expect, it } from "vitest";

import { minutesToHours, missionSchema } from "@/lib/validation/mission";

const uuid = "11111111-1111-4111-8111-111111111111";

const mission = {
  campaignId: uuid,
  cycleId: uuid,
  title: "Fundamentos de web exploitation",
  reason: "Fechar a distância entre ler sobre vulnerabilidades e encontrá-las",
  description: "",
  minLoadMinutes: "24",
  targetLoadMinutes: "30",
  criteria: ["Reproduzir oito labs sem walkthrough"],
};

describe("what a mission must have", () => {
  it("accepts a complete mission", () => {
    expect(missionSchema.safeParse(mission).success).toBe(true);
  });

  it("requires a campaign and a cycle", () => {
    expect(missionSchema.safeParse({ ...mission, campaignId: "" }).success).toBe(false);
    expect(missionSchema.safeParse({ ...mission, cycleId: "not-a-uuid" }).success).toBe(false);
  });

  it("requires a title that is not only whitespace", () => {
    expect(missionSchema.safeParse({ ...mission, title: "   " }).success).toBe(false);
  });

  /**
   * The reason is what a later review compares against. Without it there is
   * nothing to distinguish a changed premise from a change of mood, which is
   * the distinction RULE-004 is built on.
   */
  it("requires a stated reason", () => {
    expect(missionSchema.safeParse({ ...mission, reason: "" }).success).toBe(false);
  });

  it("treats a blank description as absent rather than empty", () => {
    const parsed = missionSchema.parse({ ...mission, description: "   " });
    expect(parsed.description).toBeNull();
  });
});

describe("RULE-002, answered early", () => {
  it("refuses a mission with no Definition-of-Done criterion", () => {
    expect(missionSchema.safeParse({ ...mission, criteria: [] }).success).toBe(false);
  });

  it("refuses a Definition of Done made only of blank rows", () => {
    expect(missionSchema.safeParse({ ...mission, criteria: ["", "   "] }).success).toBe(false);
  });

  it("drops untouched rows instead of complaining about them", () => {
    // The editor renders empty inputs. An untouched one is not a mistake the
    // user needs told about.
    const parsed = missionSchema.parse({
      ...mission,
      criteria: ["Publicar o relatório", "", "  ", "Resolver 3 labs"],
    });

    expect(parsed.criteria).toEqual(["Publicar o relatório", "Resolver 3 labs"]);
  });
});

describe("RULE-003, mirrored from the check constraint", () => {
  it("refuses a target below the minimum", () => {
    const result = missionSchema.safeParse({
      ...mission,
      minLoadMinutes: "30",
      targetLoadMinutes: "24",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a target equal to the minimum", () => {
    const result = missionSchema.safeParse({
      ...mission,
      minLoadMinutes: "24",
      targetLoadMinutes: "24",
    });

    expect(result.success).toBe(true);
  });

  it("refuses a zero or negative minimum", () => {
    expect(missionSchema.safeParse({ ...mission, minLoadMinutes: "0" }).success).toBe(false);
    expect(missionSchema.safeParse({ ...mission, minLoadMinutes: "-4" }).success).toBe(false);
  });

  it("refuses a load that is not a number", () => {
    expect(missionSchema.safeParse({ ...mission, minLoadMinutes: "oito" }).success).toBe(false);
    expect(missionSchema.safeParse({ ...mission, minLoadMinutes: "" }).success).toBe(false);
  });
});

describe("hours in, minutes stored", () => {
  it("converts whole hours", () => {
    expect(missionSchema.parse(mission).minLoadMinutes).toBe(1440);
  });

  it("accepts the decimal comma a pt-BR keyboard produces", () => {
    const parsed = missionSchema.parse({
      ...mission,
      minLoadMinutes: "1,5",
      targetLoadMinutes: "2.5",
    });

    expect(parsed.minLoadMinutes).toBe(90);
    expect(parsed.targetLoadMinutes).toBe(150);
  });

  it("refuses a load beyond the hours a month contains", () => {
    // A typo guard, not a rule: 744 hours is a 31-day month, end to end.
    expect(missionSchema.safeParse({ ...mission, minLoadMinutes: "9999" }).success).toBe(false);
  });

  it("reads minutes back as hours for display", () => {
    expect(minutesToHours(1440)).toBe(24);
    expect(minutesToHours(90)).toBe(1.5);
  });
});

/**
 * The status guard.
 *
 * RULE-001, RULE-002 and RULE-005 all hang on a mission not being able to
 * arrive in the world already active. The moment a status can be supplied by a
 * caller, every one of them becomes optional — so the schema must never learn
 * to accept one, and this test is what says so out loud.
 */
describe("status is not an input", () => {
  it("has exactly the expected fields, and status is not among them", () => {
    const parsed = missionSchema.parse({ ...mission, status: "active" } as never);

    expect(Object.keys(parsed).sort()).toEqual([
      "campaignId",
      "criteria",
      "cycleId",
      "description",
      "minLoadMinutes",
      "reason",
      "targetLoadMinutes",
      "title",
    ]);
  });
});
