"use client";

import { useHydrated } from "@/components/mission/clock";
import { ptBR } from "@/lib/i18n/pt-BR";
import type { RuleEventLike } from "@/lib/rules/rule-display";

const WHEN = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type Outcome = keyof typeof ptBR.ruleEventOutcome;

function outcomeLabel(outcome: string): string {
  return outcome in ptBR.ruleEventOutcome
    ? ptBR.ruleEventOutcome[outcome as Outcome]
    : ptBR.errors.unexpected;
}

/**
 * A rule's most recent occurrences.
 *
 * A client component only because the moment has to be formatted in the
 * reader's timezone, which the server does not know. The outcome renders at
 * once; the date and time appear after hydration.
 */
export function RuleEvents({ events }: { events: readonly RuleEventLike[] }) {
  const hydrated = useHydrated();

  return (
    <ul data-testid="rule-events" className="flex flex-col gap-1 text-xs text-muted-foreground">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap gap-x-2">
          <span className="font-mono">
            {hydrated ? WHEN.format(Date.parse(event.created_at)) : null}
          </span>
          <span>{outcomeLabel(event.outcome)}</span>
        </li>
      ))}
    </ul>
  );
}
