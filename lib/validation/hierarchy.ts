import { z } from "zod";

/**
 * Input schemas for the strategic scaffolding above missions.
 *
 * These mirror the database constraints rather than replacing them. A form that
 * catches a bad date first gives a better message; the check constraint is what
 * makes the rule true. Where the two disagree, the database is right.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isoDate = z.string().regex(ISO_DATE, "date");

/** Trimmed, and required to contain something other than whitespace. */
const requiredText = (max = 200) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, "required").max(max));

const optionalText = (max = 2000) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().max(max))
    .transform((value) => (value.length === 0 ? null : value));

export const directionSchema = z.object({
  title: requiredText(120),
  statement: optionalText(),
});
export type DirectionInput = z.infer<typeof directionSchema>;

export const campaignSchema = z
  .object({
    directionId: z.string().uuid("required"),
    name: requiredText(120),
    objective: requiredText(300),
    description: optionalText(),
    successCriteria: optionalText(),
    startsOn: isoDate,
    endsOn: isoDate,
  })
  .refine((value) => value.endsOn > value.startsOn, {
    message: "period",
    path: ["endsOn"],
  });
export type CampaignInput = z.infer<typeof campaignSchema>;

export const cycleSchema = z
  .object({
    label: requiredText(80),
    startsOn: isoDate,
    endsOn: isoDate,
  })
  .refine((value) => value.endsOn > value.startsOn, {
    message: "period",
    path: ["endsOn"],
  });
export type CycleInput = z.infer<typeof cycleSchema>;

export const idSchema = z.string().uuid();
