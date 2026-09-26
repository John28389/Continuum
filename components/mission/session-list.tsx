"use client";

import { useHydrated } from "./clock";
import { formatDuration, type MissionSession } from "@/lib/domain/session";
import { ptBR } from "@/lib/i18n/pt-BR";

type FinishedSession = MissionSession & { ended_at: string };

const DAY = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const TIME = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

function isFinished(session: MissionSession): session is FinishedSession {
  return session.ended_at !== null;
}

function minutesBetween(session: FinishedSession): number {
  return Math.round((Date.parse(session.ended_at) - Date.parse(session.started_at)) / 60_000);
}

/** "10 de set. · 14:05–15:30", in the reader's own timezone. */
function period(session: FinishedSession): string {
  const start = Date.parse(session.started_at);
  const end = Date.parse(session.ended_at);
  return `${DAY.format(start)} · ${TIME.format(start)}–${TIME.format(end)}`;
}

/**
 * Finished sessions.
 *
 * A client component only because wall-clock times have to be formatted where
 * the reader's timezone is known, which is the browser. The durations are
 * differences between instants and are the same everywhere, so they render at
 * once; the times of day appear after hydration.
 *
 * A running session is not listed: it lives in the timer, and a row whose
 * figure changes while you read it is not a record yet.
 */
export function SessionList({ sessions }: { sessions: MissionSession[] }) {
  const hydrated = useHydrated();
  const finished = sessions.filter(isFinished);

  return (
    <ul data-testid="session-list" className="flex flex-col gap-2">
      {finished.map((session) => (
        <li
          key={session.id}
          className="flex flex-col gap-1 rounded-[--radius-base] border border-border px-4 py-3 text-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono">{hydrated ? period(session) : null}</span>
            <span className="font-mono text-muted-foreground">
              {formatDuration(minutesBetween(session))}
            </span>
          </div>
          {session.source === "manual" ? (
            <span className="text-xs text-muted-foreground">{ptBR.session.manual}</span>
          ) : null}
          {session.note ? (
            <p className="max-w-prose whitespace-pre-line text-muted-foreground">{session.note}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
