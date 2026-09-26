"use client";

import { useActionState } from "react";

import { closeCycleAction, openCycleAction } from "../actions";
import { Button, Field, FormError, controlClass } from "@/components/ui/form";
import type { Cycle, CycleProgress } from "@/lib/domain/cycle";
import { OK } from "@/lib/domain/errors";
import { ptBR } from "@/lib/i18n/pt-BR";

const copy = ptBR.hierarchy.cycle;

export function OpenCycleForm({
  defaultLabel,
  defaultStart,
  defaultEnd,
}: {
  defaultLabel: string;
  defaultStart: string;
  defaultEnd: string;
}) {
  const [state, action, pending] = useActionState(openCycleAction, OK);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={copy.label} htmlFor="cycle-label">
        <input
          id="cycle-label"
          name="label"
          required
          defaultValue={defaultLabel}
          className={controlClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={ptBR.hierarchy.startsOn} htmlFor="cycle-starts">
          <input
            id="cycle-starts"
            name="startsOn"
            type="date"
            required
            defaultValue={defaultStart}
            className={controlClass}
          />
        </Field>

        <Field label={ptBR.hierarchy.endsOn} htmlFor="cycle-ends">
          <input
            id="cycle-ends"
            name="endsOn"
            type="date"
            required
            defaultValue={defaultEnd}
            className={controlClass}
          />
        </Field>
      </div>

      <FormError message={state.error} />

      <div>
        <Button type="submit" disabled={pending}>
          {copy.open}
        </Button>
      </div>
    </form>
  );
}

/**
 * The cycle's calendar position.
 *
 * Days remaining leads, and the bar is labelled as elapsed *time*. A bar that
 * fills as the month passes looks exactly like a progress bar for work done,
 * and this product is explicit that hours are an input metric: letting the
 * clock read as achievement would undermine the rule it is meant to support.
 */
export function ActiveCycle({ cycle, progress }: { cycle: Cycle; progress: CycleProgress }) {
  const [state, action, pending] = useActionState(closeCycleAction, OK);

  const remaining =
    progress.remainingDays === 0
      ? progress.hasEnded
        ? copy.ended
        : copy.lastDay
      : `${progress.remainingDays} ${copy.daysRemaining}`;

  return (
    <div className="flex flex-col gap-4 rounded-[--radius-base] border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{cycle.label}</p>
        <p data-testid="days-remaining" className="font-mono text-sm text-muted-foreground">
          {remaining}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.totalDays}
          aria-valuenow={progress.elapsedDays}
          aria-label={copy.elapsedLabel}
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-maintenance"
            style={{ width: `${Math.round(progress.elapsedFraction * 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {Math.round(progress.elapsedFraction * 100)}% {copy.elapsedLabel}
        </p>
      </div>

      <FormError message={state.error} />

      <form action={action}>
        <input type="hidden" name="id" value={cycle.id} />
        <Button type="submit" variant="quiet" disabled={pending}>
          {copy.close}
        </Button>
      </form>
    </div>
  );
}
