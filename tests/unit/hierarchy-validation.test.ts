import { describe, expect, it } from "vitest";

import { toUserMessage } from "@/lib/domain/errors";
import { ptBR } from "@/lib/i18n/pt-BR";
import { campaignSchema, cycleSchema, directionSchema } from "@/lib/validation/hierarchy";

const uuid = "11111111-1111-4111-8111-111111111111";

const campaign = {
  directionId: uuid,
  name: "Web exploitation",
  objective: "Reach practical competence",
  description: "",
  successCriteria: "",
  startsOn: "2026-09-01",
  endsOn: "2026-12-01",
};

describe("direction input", () => {
  it("accepts a title and trims it", () => {
    const parsed = directionSchema.parse({ title: "  Crescer  ", statement: "" });
    expect(parsed.title).toBe("Crescer");
  });

  it("treats a blank statement as absent rather than empty", () => {
    // Storing "" would make "has a statement" true for something with nothing
    // in it, and every read would have to re-check.
    expect(directionSchema.parse({ title: "x", statement: "   " }).statement).toBeNull();
  });

  it("refuses a title that is only whitespace", () => {
    expect(directionSchema.safeParse({ title: "   ", statement: "" }).success).toBe(false);
  });
});

describe("campaign input", () => {
  it("accepts a well-formed campaign", () => {
    expect(campaignSchema.safeParse(campaign).success).toBe(true);
  });

  it("requires a direction", () => {
    expect(campaignSchema.safeParse({ ...campaign, directionId: "" }).success).toBe(false);
    expect(campaignSchema.safeParse({ ...campaign, directionId: "not-a-uuid" }).success).toBe(
      false,
    );
  });

  it("refuses a period that ends before it starts", () => {
    const result = campaignSchema.safeParse({
      ...campaign,
      startsOn: "2026-12-01",
      endsOn: "2026-09-01",
    });

    expect(result.success).toBe(false);
  });

  it("refuses a zero-length period", () => {
    const result = campaignSchema.safeParse({
      ...campaign,
      startsOn: "2026-09-01",
      endsOn: "2026-09-01",
    });

    expect(result.success).toBe(false);
  });

  it("refuses a date that is not a date", () => {
    expect(campaignSchema.safeParse({ ...campaign, startsOn: "01/09/2026" }).success).toBe(false);
  });
});

describe("cycle input", () => {
  it("accepts a well-formed cycle", () => {
    const result = cycleSchema.safeParse({
      label: "Setembro",
      startsOn: "2026-09-01",
      endsOn: "2026-10-01",
    });

    expect(result.success).toBe(true);
  });

  it("refuses a backwards period", () => {
    const result = cycleSchema.safeParse({
      label: "Setembro",
      startsOn: "2026-10-01",
      endsOn: "2026-09-01",
    });

    expect(result.success).toBe(false);
  });
});

describe("database refusals become explanations", () => {
  /**
   * The one-active-cycle index is a precondition for RULE-005, but the person
   * opening a second cycle needs to hear about cycles. It used to be mapped to
   * RULE-005, whose message talks about missions — a refusal that explained the
   * wrong thing entirely.
   */
  it("explains a second active cycle in terms of cycles, not missions", () => {
    const message = toUserMessage({
      code: "23505",
      message: 'duplicate key value violates unique constraint "cycles_one_active_per_user"',
    });

    expect(message).toBe(ptBR.hierarchy.cycle.alreadyActive);
    expect(message).not.toBe(ptBR.rules["RULE-005"].blocked);
    expect(message.toLowerCase()).toContain("ciclo");
  });

  it("still explains a second active mission in terms of RULE-001", () => {
    const message = toUserMessage({
      code: "23505",
      message: 'duplicate key value violates unique constraint "missions_one_active_per_user"',
    });

    expect(message).toBe(ptBR.rules["RULE-001"].blocked);
  });

  it("never surfaces raw SQL to the reader", () => {
    const message = toUserMessage({
      code: "23505",
      message: 'duplicate key value violates unique constraint "cycles_one_active_per_user"',
    });

    for (const leak of ["constraint", "duplicate key", "23505", "null value", "relation"]) {
      expect(message.toLowerCase()).not.toContain(leak);
    }
  });

  it("falls back to a calm generic message for an unrecognised failure", () => {
    expect(toUserMessage({ code: "08006", message: "connection failure" })).toBe(
      ptBR.errors.unexpected,
    );
  });

  it("does not blame the reader", () => {
    // A refusal here is the system doing its job, so the wording must prompt
    // thought rather than scold.
    const message = toUserMessage({
      code: "23505",
      message: 'duplicate key value violates unique constraint "cycles_one_active_per_user"',
    });

    for (const scolding of ["erro seu", "você errou", "proibido", "não pode fazer isso"]) {
      expect(message.toLowerCase()).not.toContain(scolding);
    }
  });
});
