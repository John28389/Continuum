import { describe, expect, it } from "vitest";

import { toUserMessage } from "@/lib/domain/errors";
import { formatDuration } from "@/lib/domain/session";
import { ptBR } from "@/lib/i18n/pt-BR";
import { manualSessionSchema, stopSessionSchema } from "@/lib/validation/session";

const uuid = "11111111-1111-4111-8111-111111111111";

const manual = {
  missionId: uuid,
  startedAt: "2026-09-10T12:00:00.000Z",
  durationMinutes: "1,5",
  note: "",
};

describe("a session logged after the fact", () => {
  it("accepts an instant and a duration in hours", () => {
    const parsed = manualSessionSchema.parse(manual);
    expect(parsed.durationMinutes).toBe(90);
    expect(parsed.note).toBeNull();
  });

  /**
   * The timezone guard. A wall-clock time with no offset would be read in the
   * server's timezone — UTC on a hosted deployment — which is the error the
   * browser-side conversion exists to prevent. Refusing it here means a form
   * that forgot to convert fails loudly instead of storing the wrong instant.
   */
  it("refuses a local time with no offset", () => {
    expect(
      manualSessionSchema.safeParse({ ...manual, startedAt: "2026-09-10T09:00" }).success,
    ).toBe(false);
  });

  it("accepts an explicit offset", () => {
    expect(
      manualSessionSchema.safeParse({ ...manual, startedAt: "2026-09-10T09:00:00-03:00" }).success,
    ).toBe(true);
  });

  it("refuses a missing start", () => {
    expect(manualSessionSchema.safeParse({ ...manual, startedAt: "" }).success).toBe(false);
  });

  it("refuses a duration of zero, or one no single sitting could have", () => {
    expect(manualSessionSchema.safeParse({ ...manual, durationMinutes: "0" }).success).toBe(false);
    expect(manualSessionSchema.safeParse({ ...manual, durationMinutes: "25" }).success).toBe(false);
  });

  it("reads the decimal comma", () => {
    expect(manualSessionSchema.parse({ ...manual, durationMinutes: "0,25" }).durationMinutes).toBe(
      15,
    );
  });
});

describe("stopping", () => {
  it("needs only the session; the note is optional", () => {
    expect(stopSessionSchema.parse({ sessionId: uuid, note: "  " }).note).toBeNull();
    expect(stopSessionSchema.parse({ sessionId: uuid, note: "Lab 3" }).note).toBe("Lab 3");
  });
});

describe("durations, as a person reads them", () => {
  it.each([
    [0, "0min"],
    [45, "45min"],
    [60, "1h"],
    [95, "1h 35min"],
    [120, "2h"],
    [89.6, "1h 30min"],
  ])("%s minutes reads as %s", (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });

  it("never shows a negative duration", () => {
    expect(formatDuration(-5)).toBe("0min");
  });
});

/**
 * Every refusal the session trigger can raise has an explanation of its own.
 * None of them is one of the hard rules, so each must be recognised by its
 * constraint name — and none may reach the reader as SQL.
 */
describe("session refusals become explanations", () => {
  const cases = [
    {
      error: { code: "23P01", message: "mission_sessions_no_overlap: this period overlaps" },
      expected: ptBR.session.overlap,
    },
    {
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "mission_sessions_one_running_per_user"',
      },
      expected: ptBR.session.alreadyRunning,
    },
    {
      error: { code: "23514", message: "mission_sessions_not_in_future: cannot end after" },
      expected: ptBR.session.inFuture,
    },
    {
      error: { code: "23514", message: "mission_sessions_mission_active: active mission only" },
      expected: ptBR.session.missionNotActive,
    },
    {
      error: {
        code: "23514",
        message:
          'new row for relation "mission_sessions" violates check constraint "mission_sessions_period_valid"',
      },
      expected: ptBR.session.periodInvalid,
    },
  ];

  for (const { error, expected } of cases) {
    it(`explains ${error.message.split(":")[0]}`, () => {
      const message = toUserMessage(error);
      expect(message).toBe(expected);

      for (const leak of ["mission_sessions", "constraint", "relation", "23p01", "23514"]) {
        expect(message.toLowerCase()).not.toContain(leak);
      }
    });
  }
});
