import { z } from "zod";

import type { RuleCode } from "@/lib/rules/registry";

/**
 * Mission input.
 *
 * Mirrors the database rather than replacing it. RULE-003 is a check
 * constraint; the schema below repeats it only so the form can answer before a
 * round trip. Where the two disagree, the database is right.
 *
 * Note what this file does *not* contain: a status. A mission is always created
 * as a draft and only ever becomes active through `activate_mission()`, where
 * the trigger can see the criteria and the active cycle. Accepting a status
 * here would turn RULE-001, RULE-002 and RULE-005 into a form field.
 */

/** Trimmed, and required to contain something other than whitespace. */
const requiredText = (max: number) =>
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

/**
 * Hours in, minutes stored.
 *
 * The database keeps minutes so no unit is lossy; the person thinks in hours.
 * The comma is accepted because a pt-BR keyboard produces "12,5" and rejecting
 * it would be the interface being pedantic about something it can simply read.
 *
 * The upper bound is a typo guard, not a rule: 744 is the number of hours in
 * the longest possible month, so anything above it is a slip rather than an
 * ambition.
 */
const MAX_LOAD_HOURS = 744;

/**
 * A positive number of hours, typed the way a person types it, as minutes.
 *
 * Exported because sessions take durations in hours too, and the rule about
 * the decimal comma has to live in exactly one place.
 */
export const hoursAsMinutes = (maxHours: number) =>
  z
    .string()
    .transform((value) => Number(value.trim().replace(",", ".")))
    // Number("") is 0 and Number("oito") is NaN; both are refused below rather
    // than by a regex, so there is one place that decides what an hour is.
    .pipe(z.number().positive("positive").max(maxHours, "max"))
    .transform((hours) => Math.round(hours * 60));

const loadHours = hoursAsMinutes(MAX_LOAD_HOURS);

/** At most one criterion per line of a sane Definition of Done. */
const MAX_CRITERIA = 20;

export const missionSchema = z
  .object({
    campaignId: z.string().uuid("required"),
    cycleId: z.string().uuid("required"),
    title: requiredText(160),
    reason: requiredText(500),
    description: optionalText(),
    minLoadMinutes: loadHours,
    targetLoadMinutes: loadHours,
    // Blank rows are dropped rather than refused: the editor renders empty
    // inputs, and an untouched one is not a mistake the user needs told about.
    criteria: z
      .array(z.string())
      .transform((values) => values.map((value) => value.trim()).filter((v) => v.length > 0))
      // RULE-002, answered early. The trigger is what makes it true.
      .pipe(z.array(z.string().max(300)).min(1, "required").max(MAX_CRITERIA)),
  })
  // RULE-003.
  .refine((value) => value.targetLoadMinutes >= value.minLoadMinutes, {
    message: "load",
    path: ["targetLoadMinutes"],
  });

export type MissionInput = z.infer<typeof missionSchema>;

/** Minutes back to hours for display. One decimal, so 90 minutes reads as 1,5. */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

const HOURS = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/**
 * Minutes as hours, written for a pt-BR reader: 90 becomes "1,5".
 *
 * `minutesToHours` returns a number, and a number interpolated into JSX prints
 * with a full stop. Whole hours hid that; session totals would not.
 */
export function formatHours(minutes: number): string {
  return HOURS.format(minutes / 60);
}

/**
 * The rule a schema failure corresponds to, when it mirrors one.
 *
 * The schema exists to answer before a round trip, so its refusals have to
 * speak the same language the database would. A missing Definition of Done
 * reported as "algo não funcionou" would be the interface hiding a rule the
 * user is entitled to see explained.
 */
export function ruleForIssuePath(path: readonly PropertyKey[]): RuleCode | null {
  switch (String(path[0] ?? "")) {
    case "criteria":
      return "RULE-002";
    case "minLoadMinutes":
    case "targetLoadMinutes":
      return "RULE-003";
    default:
      return null;
  }
}
