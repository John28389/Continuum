import { z } from "zod";

import { hoursAsMinutes } from "./mission";

/**
 * Session input.
 *
 * A timer session needs no input at all: the database stamps its start and its
 * end, so the two halves of a duration always come from the same clock. Only a
 * session logged after the fact carries times, and those arrive as absolute
 * instants — the browser converts the person's local date and time before
 * submitting, because the server does not know which timezone they meant.
 */

/**
 * One sitting, at most.
 *
 * A typo guard rather than a rule: nobody works a twenty-five-hour session, and
 * a figure like that would be a slip that quietly inflates an input metric.
 * The database has no such bound, deliberately — a forgotten timer must always
 * be stoppable.
 */
const MAX_SESSION_HOURS = 24;

const note = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().max(2000))
  .transform((value) => (value.length === 0 ? null : value));

export const manualSessionSchema = z.object({
  missionId: z.string().uuid("required"),
  // An instant with an explicit offset. A bare "2026-09-10T14:00" would be read
  // in the server's timezone, which is exactly the error this exists to avoid.
  startedAt: z.iso.datetime({ offset: true }),
  durationMinutes: hoursAsMinutes(MAX_SESSION_HOURS),
  note,
});
export type ManualSessionInput = z.infer<typeof manualSessionSchema>;

export const stopSessionSchema = z.object({
  sessionId: z.string().uuid("required"),
  note,
});
export type StopSessionInput = z.infer<typeof stopSessionSchema>;
