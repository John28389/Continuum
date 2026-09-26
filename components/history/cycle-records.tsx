import Link from "next/link";

import { describeCycleStatus, describeOutcome } from "./describe";
import type { CycleMission, CycleRecord } from "@/lib/domain/history";
import { ptBR } from "@/lib/i18n/pt-BR";

const copy = ptBR.history.cycles;

const DATE = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * A cycle's calendar. Dates, not instants: formatted in UTC so that no
 * timezone can move a first day to the evening before.
 */
function period(cycle: CycleRecord["cycle"]): string {
  const day = (date: string) => DATE.format(new Date(`${date}T00:00:00Z`));
  return `${day(cycle.starts_on)} – ${day(cycle.ends_on)}`;
}

function MissionOutcomes({ missions }: { missions: readonly CycleMission[] }) {
  if (missions.length === 0) {
    return <p className="text-sm text-muted-foreground">{copy.noMissions}</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {missions.map((mission) => (
        <li
          key={mission.id}
          className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm"
        >
          <Link
            href={`/missions/${mission.id}`}
            className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {mission.title}
          </Link>
          <span className="font-mono text-xs text-muted-foreground">
            {describeOutcome(mission)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Every cycle, newest first, with its missions and how each one ended.
 *
 * Outcomes are stated, not scored: no totals, no rates, no comparison between
 * cycles. A cycle whose mission was ended on a changed premise reads exactly
 * as plainly as one whose mission was completed.
 */
export function CycleRecords({ records }: { records: readonly CycleRecord[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {records.map(({ cycle, missions }) => (
        <li key={cycle.id}>
          <article
            data-testid="cycle-record"
            className="flex flex-col gap-3 rounded-[--radius-base] border border-border p-4"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 className="font-medium">{cycle.label}</h2>
                <p className="font-mono text-xs text-muted-foreground">{period(cycle)}</p>
              </div>
              <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                {describeCycleStatus(cycle.status)}
              </span>
            </header>

            <MissionOutcomes missions={missions} />

            <Link
              href={`/history?cycle=${cycle.id}`}
              className="self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {copy.viewTimeline}
            </Link>
          </article>
        </li>
      ))}
    </ol>
  );
}
