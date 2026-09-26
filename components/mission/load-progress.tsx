import type { LoadProgress } from "@/lib/domain/session";
import { ptBR } from "@/lib/i18n/pt-BR";
import type { RuleCode } from "@/lib/rules/registry";
import { formatHours } from "@/lib/validation/mission";

const copy = ptBR.load;
const hoursShort = ptBR.mission.hoursShort;
const RULE_102: RuleCode = "RULE-102";

function Figure({
  label,
  minutes,
  status,
}: {
  label: string;
  minutes: number;
  status?: string | null;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="font-mono text-sm">
        {formatHours(minutes)}
        {hoursShort}
      </span>
      {status ? <span className="text-xs text-muted-foreground">{status}</span> : null}
    </div>
  );
}

/**
 * Hours logged, against both loads — and nothing more.
 *
 * No bar. A bar is the one visual that reads as "progress" before anything
 * else on the page is read, and the roadmap names hours drifting into the
 * primary progress measure as the likeliest failure in the whole project. So
 * this is three figures in the neutral chrome of the interface, labelled as an
 * input metric, placed after the Definition of Done wherever it appears.
 *
 * There is a distance to the minimum, because the floor is worth knowing about.
 * There is no distance to the target and no figure beyond it. When the target
 * is reached the component says, in RULE-102's words, that this does not finish
 * anything.
 *
 * `final` is for a mission that is over. Its hours are a record, not a
 * distance: the minimum and target are left out entirely, because "12h of a
 * 24h minimum" beside a finished mission reads as having fallen short — and
 * finishing is finishing, however many hours it took (RULE-103).
 */
export function LoadProgressView({
  progress,
  final = false,
}: {
  progress: LoadProgress;
  final?: boolean;
}) {
  const minimumStatus =
    progress.minutesToMinimum === 0
      ? copy.reached
      : `${copy.remaining} ${formatHours(progress.minutesToMinimum)}${hoursShort}`;

  return (
    <section
      data-testid="load-progress"
      aria-labelledby="load-progress-title"
      className="flex flex-col gap-3 rounded-[--radius-base] border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="load-progress-title" className="text-sm font-medium">
          {copy.title}
        </h2>
        <span className="font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
          {copy.inputMetric}
        </span>
      </div>

      <div className="flex flex-wrap gap-8">
        <Figure label={copy.logged} minutes={progress.loggedMinutes} />
        {final ? null : (
          <>
            <Figure label={copy.minimum} minutes={progress.minimumMinutes} status={minimumStatus} />
            <Figure
              label={copy.target}
              minutes={progress.targetMinutes}
              status={progress.stage === "target_reached" ? copy.reached : null}
            />
          </>
        )}
      </div>

      {!final && progress.stage === "target_reached" ? (
        <p data-testid="rule-102" className="flex max-w-prose flex-wrap gap-x-2 text-sm">
          <span className="font-mono text-xs text-muted-foreground">{RULE_102}</span>
          <span>{ptBR.rules[RULE_102].blocked}</span>
        </p>
      ) : null}
    </section>
  );
}
