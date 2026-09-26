import { describe, expect, it } from "vitest";

import { toUserMessage } from "@/lib/domain/errors";
import { ptBR } from "@/lib/i18n/pt-BR";
import { MIN_JUSTIFICATION, reviewSchema } from "@/lib/validation/review";

const uuid = "11111111-1111-4111-8111-111111111111";

const review = {
  missionId: uuid,
  outcome: "abandoned",
  reasonCategory: "premise_changed",
  justification: "O laboratório que a missão pressupunha foi desativado.",
};

describe("a review, as RULE-004 requires it", () => {
  it("accepts a categorised, written justification", () => {
    expect(reviewSchema.safeParse(review).success).toBe(true);
  });

  /**
   * The categories are the legitimate reasons to stop. Losing interest is not
   * among them, and the schema must not learn to accept it.
   */
  it("refuses a reason outside the five categories", () => {
    for (const reasonCategory of ["lost_interest", "boredom", "something_better", ""]) {
      expect(reviewSchema.safeParse({ ...review, reasonCategory }).success, reasonCategory).toBe(
        false,
      );
    }
  });

  it("requires a justification that actually says something", () => {
    expect(
      reviewSchema.safeParse({ ...review, justification: "x".repeat(MIN_JUSTIFICATION - 1) })
        .success,
    ).toBe(false);
    expect(
      reviewSchema.safeParse({ ...review, justification: "x".repeat(MIN_JUSTIFICATION) }).success,
    ).toBe(true);
  });

  it("does not count padding towards the justification", () => {
    const padded = `   ${"x".repeat(MIN_JUSTIFICATION - 1)}   `;
    expect(reviewSchema.safeParse({ ...review, justification: padded }).success).toBe(false);
  });

  it("stores the justification trimmed", () => {
    const parsed = reviewSchema.parse({ ...review, justification: `  ${review.justification}  ` });
    expect(parsed.justification).toBe(review.justification);
  });

  /** Keeping the mission is a decision too; there is no default outcome. */
  it("requires a deliberate outcome, and only the three that exist", () => {
    expect(reviewSchema.safeParse({ ...review, outcome: "" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...review, outcome: "paused" }).success).toBe(false);
    for (const outcome of ["kept", "revised", "abandoned"]) {
      expect(reviewSchema.safeParse({ ...review, outcome }).success, outcome).toBe(true);
    }
  });

  it("requires a mission", () => {
    expect(reviewSchema.safeParse({ ...review, missionId: "" }).success).toBe(false);
  });
});

/**
 * The same limits, refused by the database. The form catches them first; if it
 * ever did not, the person must still read an explanation, not a constraint.
 */
describe("review refusals become explanations", () => {
  const cases = [
    {
      message:
        'new row for relation "mission_reviews" violates check constraint "mission_reviews_justification_substantive"',
      expected: ptBR.review.justificationShort,
    },
    {
      message:
        'new row for relation "mission_reviews" violates check constraint "mission_reviews_reason_category_valid"',
      expected: ptBR.review.categoryRequired,
    },
    {
      message:
        'new row for relation "mission_reviews" violates check constraint "mission_reviews_outcome_valid"',
      expected: ptBR.review.outcomeRequired,
    },
  ];

  for (const { message, expected } of cases) {
    it(`explains ${message.split('"').at(-2)}`, () => {
      const explained = toUserMessage({ code: "23514", message });
      expect(explained).toBe(expected);
      for (const leak of ["mission_reviews", "constraint", "relation", "23514"]) {
        expect(explained.toLowerCase()).not.toContain(leak);
      }
    });
  }
});

describe("the reflection prompt", () => {
  it("asks the question the roadmap names, as reflection", () => {
    expect(ptBR.review.prompt).toBe("Você está mudando a regra ou tentando escapar dela?");
  });

  it("does not scold", () => {
    const text = `${ptBR.review.prompt} ${ptBR.review.promptBody}`.toLowerCase();
    for (const scolding of ["você errou", "proibido", "vergonha", "fracass", "desistiu"]) {
      expect(text).not.toContain(scolding);
    }
  });
});
