import { ptBR } from "@/lib/i18n/pt-BR";

/**
 * MISSÃO CONCLUÍDA — and nothing after it.
 *
 * RULE-103. When the mission is finished before the cycle is, the person is
 * free, and the only honest thing to show is that it is done. No remaining
 * percentage, no hours still "missing", no suggestion of what to do next. A
 * screen that followed completion with a nudge would be the system
 * manufacturing work, which is the one thing it has promised not to do.
 *
 * `freedom` is true while the cycle is still running, which is when saying so
 * matters: "the month is not over and there is nothing left to do here".
 */
export function CompletedState({ freedom }: { freedom: boolean }) {
  return (
    <section
      data-testid="mission-completed"
      className="flex flex-col gap-2 rounded-[--radius-base] border border-success/40 bg-success/5 p-6"
    >
      <p className="font-mono text-lg font-medium tracking-wide text-success">
        {ptBR.mission.completed}
      </p>
      {freedom ? (
        <p className="max-w-prose text-sm text-muted-foreground">{ptBR.mission.completedFreedom}</p>
      ) : null}
    </section>
  );
}
