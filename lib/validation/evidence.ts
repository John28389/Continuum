import { z } from "zod";

/**
 * Evidence and criterion input.
 *
 * Mirrors the database: `mission_evidence_url_valid` and the composite foreign
 * key that ties a cited criterion to the same mission are what make these true.
 * The schema only answers first.
 */

const description = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1, "required").max(500));

/**
 * An optional link to where the evidence can be seen.
 *
 * http and https only. Anything else — a `javascript:` URL above all — would be
 * rendered as a clickable link on the evidence page, and a link is the one
 * piece of user input this page turns into something executable.
 */
const url = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z.union([
      z.literal(""),
      z
        .string()
        .max(2000)
        .regex(/^https?:\/\/\S+$/i, "url"),
    ]),
  )
  .transform((value) => (value === "" ? null : value));

/** A cited criterion, or none. The empty option in the select sends "". */
const criterionId = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.union([z.literal(""), z.string().uuid()]))
  .transform((value) => (value === "" ? null : value));

export const evidenceSchema = z.object({
  missionId: z.string().uuid("required"),
  description,
  url,
  criterionId,
});
export type EvidenceInput = z.infer<typeof evidenceSchema>;

export const criterionSatisfactionSchema = z.object({
  criterionId: z.string().uuid("required"),
  missionId: z.string().uuid("required"),
  // A form field, so a string. Only these two values mean anything.
  satisfied: z.enum(["true", "false"]).transform((value) => value === "true"),
});
export type CriterionSatisfactionInput = z.infer<typeof criterionSatisfactionSchema>;
