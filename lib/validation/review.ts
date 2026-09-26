import { z } from "zod";

import { REVIEW_OUTCOMES, REVIEW_REASON_CATEGORIES } from "@/lib/rules/integrity";

/**
 * A mission review (RULE-004).
 *
 * Mirrors the `mission_reviews` constraints, which are what make it true: the
 * category must be one of the five legitimate reasons to stop, and the
 * justification must actually say something. Boredom, lost motivation and a
 * more interesting idea are not categories, on purpose — that is what the
 * curiosity parking lot is for.
 *
 * The outcome has no default. Keeping the mission is a decision too, and the
 * form asks for it as deliberately as it asks for ending one.
 */

/** Mirrors `mission_reviews_justification_substantive`: at least 20 characters once trimmed. */
export const MIN_JUSTIFICATION = 20;

export const reviewSchema = z.object({
  missionId: z.string().uuid("required"),
  outcome: z.enum(REVIEW_OUTCOMES),
  reasonCategory: z.enum(REVIEW_REASON_CATEGORIES),
  justification: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(MIN_JUSTIFICATION, "justification").max(2000, "justification")),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
