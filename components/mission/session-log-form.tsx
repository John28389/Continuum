"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { logSessionAction } from "@/app/(app)/missions/[id]/sessions/actions";
import { Button, Field, FormError, controlClass } from "@/components/ui/form";
import { OK } from "@/lib/domain/errors";
import { ptBR } from "@/lib/i18n/pt-BR";

const copy = ptBR.session;

/**
 * The person's local date and time, as an absolute instant.
 *
 * This is the whole timezone defence for manual entry. A date and time with no
 * offset is defined by the language to mean the device's own timezone — with
 * that date's daylight-saving rule, not today's — so the conversion has to
 * happen here, in the browser, where that timezone is known. Sent as it was
 * typed, the server would read it in its own timezone, which on a hosted
 * deployment is UTC: three hours off for someone in São Paulo, silently.
 */
function toInstant(date: string, time: string): string {
  if (!date || !time) return "";
  const instant = new Date(`${date}T${time}`);
  return Number.isNaN(instant.getTime()) ? "" : instant.toISOString();
}

/**
 * A session worked without the timer.
 *
 * Start and duration rather than start and end: a duration cannot be entered
 * backwards, and a session crossing midnight needs no special case.
 *
 * All fields are controlled so a refused log — an overlap, a future start —
 * keeps what was entered instead of wiping it. Only a successful log clears
 * the duration and note for the next entry; date and time are left as they
 * were, since logging several sessions from the same day is the common case.
 */
export function SessionLogForm({ missionId }: { missionId: string }) {
  const [state, action, pending] = useActionState(logSessionAction, OK);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [note, setNote] = useState("");

  const wasPending = useRef(pending);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setDurationHours("");
      setNote("");
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="missionId" value={missionId} />
      <input type="hidden" name="startedAt" value={toInstant(date, time)} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={copy.date} htmlFor="log-date">
          <input
            id="log-date"
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={controlClass}
          />
        </Field>

        <Field label={copy.startTime} htmlFor="log-time">
          <input
            id="log-time"
            type="time"
            required
            value={time}
            onChange={(event) => setTime(event.target.value)}
            className={controlClass}
          />
        </Field>

        <Field label={copy.duration} htmlFor="log-duration">
          <input
            id="log-duration"
            name="durationHours"
            inputMode="decimal"
            required
            value={durationHours}
            onChange={(event) => setDurationHours(event.target.value)}
            className={controlClass}
          />
        </Field>
      </div>

      <Field label={copy.note} htmlFor="log-note">
        <input
          id="log-note"
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className={controlClass}
        />
      </Field>

      <FormError message={state.error} />

      <div>
        <Button type="submit" variant="quiet" disabled={pending}>
          {copy.log}
        </Button>
      </div>
    </form>
  );
}
