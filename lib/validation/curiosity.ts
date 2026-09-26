import { z } from "zod";

/**
 * The curiosity parking lot.
 *
 * Capture mirrors `curiosities`: only a title is required, because a form
 * asking for more would cost more than the few seconds capture is supposed to
 * take, and then it would stop happening at the moment the idea appears.
 *
 * Promotion mirrors RULE-007's mechanism as enforced by
 * `promote_curiosity_to_mission()`: no status, and no cycle either — the
 * function always targets the caller's own active cycle, so neither field
 * exists here for a caller to try to supply.
 */

export const CURIOSITY_STATES = ["captured", "waiting", "candidate", "chosen", "archived"] as const;
export type CuriosityState = (typeof CURIOSITY_STATES)[number];

/** States a person can set directly. `chosen` only ever comes from promotion. */
export const SETTABLE_CURIOSITY_STATES = ["captured", "waiting", "candidate", "archived"] as const;
export type SettableCuriosityState = (typeof SETTABLE_CURIOSITY_STATES)[number];

const requiredText = (max: number) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, "required").max(max));

export const captureSchema = z.object({
  title: requiredText(200),
});
export type CaptureInput = z.infer<typeof captureSchema>;

export const curiosityStateSchema = z.object({
  curiosityId: z.string().uuid("required"),
  state: z.enum(SETTABLE_CURIOSITY_STATES),
});
export type CuriosityStateInput = z.infer<typeof curiosityStateSchema>;

/** Hours in, minutes stored — the same rule mission input follows. */
const MAX_LOAD_HOURS = 744;
const loadHours = z
  .string()
  .transform((value) => Number(value.trim().replace(",", ".")))
  .pipe(z.number().positive("positive").max(MAX_LOAD_HOURS, "max"))
  .transform((hours) => Math.round(hours * 60));

export const promoteSchema = z
  .object({
    curiosityId: z.string().uuid("required"),
    campaignId: z.string().uuid("required"),
    title: requiredText(160),
    reason: requiredText(500),
    minLoadMinutes: loadHours,
    targetLoadMinutes: loadHours,
  })
  .refine((value) => value.targetLoadMinutes >= value.minLoadMinutes, {
    message: "load",
    path: ["targetLoadMinutes"],
  });
export type PromoteInput = z.infer<typeof promoteSchema>;
