"use client";

import { useActionState } from "react";

import { useNow } from "./clock";
import {
  discardSessionAction,
  startSessionAction,
  stopSessionAction,
} from "@/app/(app)/missions/[id]/sessions/actions";
import { Button, Field, FormError, controlClass } from "@/components/ui/form";
import { OK } from "@/lib/domain/errors";
import { formatDuration, type MissionSession } from "@/lib/domain/session";
import { ptBR } from "@/lib/i18n/pt-BR";

const copy = ptBR.session;

const TIME = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

function elapsedMinutes(now: number, startedAt: number): number {
  return Math.max(0, Math.floor((now - startedAt) / 60_000));
}

/**
 * Starting the timer: one action, nothing to fill in.
 *
 * No note, no confirmation, no choice of mission — there is only one mission a
 * session can belong to. Anything more between intention and work is friction
 * the system would be adding for its own sake.
 */
function StartSession({ missionId }: { missionId: string }) {
  const [state, action, pending] = useActionState(startSessionAction, OK);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="missionId" value={missionId} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? copy.starting : copy.start}
        </Button>
      </div>
      <FormError message={state.error} />
    </form>
  );
}

/**
 * A session in progress.
 *
 * It needs no babysitting. The start lives in the database, not in this tab, so
 * closing the browser, reloading, or switching devices changes nothing; the
 * elapsed time is recomputed from that instant whenever the page is open. A
 * forgotten timer is corrected by discarding it, on the sessions page.
 */
function RunningSession({
  missionId,
  session,
  detailed,
}: {
  missionId: string;
  session: Pick<MissionSession, "id" | "started_at">;
  detailed: boolean;
}) {
  const now = useNow();
  const [stopState, stop, stopping] = useActionState(stopSessionAction, OK);
  const [discardState, discard, discarding] = useActionState(discardSessionAction, OK);
  const startedAt = Date.parse(session.started_at);

  return (
    <div
      data-testid="running-session"
      className="flex flex-col gap-3 rounded-[--radius-base] border border-border p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{copy.running}</p>
        {now === null ? null : (
          <p className="font-mono text-sm text-muted-foreground">
            {copy.since} {TIME.format(startedAt)} · {formatDuration(elapsedMinutes(now, startedAt))}
          </p>
        )}
      </div>

      <form action={stop} className="flex flex-col gap-3">
        <input type="hidden" name="sessionId" value={session.id} />
        <input type="hidden" name="missionId" value={missionId} />
        {detailed ? (
          <Field label={copy.note} htmlFor="session-note">
            <input id="session-note" name="note" className={controlClass} />
          </Field>
        ) : null}
        <div>
          <Button type="submit" variant="quiet" disabled={stopping}>
            {stopping ? copy.stopping : copy.stop}
          </Button>
        </div>
        <FormError message={stopState.error} />
      </form>

      {detailed ? (
        <form action={discard} className="flex flex-col gap-1 border-t border-border pt-3">
          <input type="hidden" name="sessionId" value={session.id} />
          <input type="hidden" name="missionId" value={missionId} />
          <div>
            <Button type="submit" variant="danger" disabled={discarding}>
              {copy.discard}
            </Button>
          </div>
          <p className="max-w-prose text-xs text-muted-foreground">{copy.discardHint}</p>
          <FormError message={discardState.error} />
        </form>
      ) : null}
    </div>
  );
}

/**
 * The timer, in whichever state it is in.
 *
 * `detailed` adds the note field and the discard control, for the sessions
 * page. The dashboard gets the bare version: start, or stop.
 */
export function SessionTimer({
  missionId,
  running,
  detailed = false,
}: {
  missionId: string;
  running: Pick<MissionSession, "id" | "started_at"> | null;
  detailed?: boolean;
}) {
  if (running) {
    return <RunningSession missionId={missionId} session={running} detailed={detailed} />;
  }

  return <StartSession missionId={missionId} />;
}
