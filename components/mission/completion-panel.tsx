"use client";

import { useActionState } from "react";

import { RuleViolation } from "./rule-violation";
import {
  completeMissionAction,
  setCriterionSatisfiedAction,
} from "@/app/(app)/missions/[id]/actions";
import { Button, FormError } from "@/components/ui/form";
import type { EvidenceIndex, MissionEvidence } from "@/lib/domain/evidence";
import { OK, type ActionState } from "@/lib/domain/errors";
import { ptBR } from "@/lib/i18n/pt-BR";
import { completionReadiness, type CriterionState } from "@/lib/rules/completion";
import { cn } from "@/lib/utils";

const copy = ptBR.mission;

function Refusal({ state }: { state: ActionState }) {
  return state.ruleCode ? (
    <RuleViolation ruleCode={state.ruleCode} />
  ) : (
    <FormError message={state.error} />
  );
}

function LinkedEvidence({ items }: { items: MissionEvidence[] }) {
  return (
    <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.id}>
          {ptBR.evidence.linked}
          {": "}
          {item.description}
        </li>
      ))}
    </ul>
  );
}

/**
 * One criterion, and the single thing that can be done to it.
 *
 * Marking and unmarking are both offered while the mission is active. The
 * criteria are rigid about existing and flexible about their state: realising a
 * criterion was not actually met is honest, and the system should make saying so
 * as easy as claiming it.
 */
function CriterionRow({
  missionId,
  criterion,
  evidence,
}: {
  missionId: string;
  criterion: CriterionState;
  evidence: MissionEvidence[];
}) {
  const [state, action, pending] = useActionState(setCriterionSatisfiedAction, OK);
  const satisfied = criterion.satisfied_at !== null;

  return (
    <li
      data-testid="criterion"
      className={cn(
        "flex flex-col gap-2 rounded-[--radius-base] border px-4 py-3",
        satisfied ? "border-success/40" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span
            className={cn(
              "font-mono text-[0.6875rem] tracking-wide uppercase",
              satisfied ? "text-success" : "text-muted-foreground",
            )}
          >
            {satisfied ? copy.satisfied : copy.openCriterion}
          </span>
          <p className="text-sm">{criterion.description}</p>
        </div>

        <form action={action}>
          <input type="hidden" name="criterionId" value={criterion.id} />
          <input type="hidden" name="missionId" value={missionId} />
          <input type="hidden" name="satisfied" value={satisfied ? "false" : "true"} />
          <Button
            type="submit"
            variant="quiet"
            disabled={pending}
            aria-label={`${satisfied ? copy.unsatisfy : copy.satisfy}: ${criterion.description}`}
          >
            {satisfied ? copy.unsatisfy : copy.satisfy}
          </Button>
        </form>
      </div>

      {evidence.length > 0 ? <LinkedEvidence items={evidence} /> : null}
      <Refusal state={state} />
    </li>
  );
}

/**
 * The Definition of Done as a checklist, and completion.
 *
 * Completion is offered only when every criterion is satisfied, and when it is
 * not, the reason is always on screen: the criteria still open, by name.
 * RULE-008 is the trigger's to enforce; this panel mirrors it so nobody has to
 * press a button to learn what it would say.
 *
 * No hours anywhere in here. What decides completion is the list above the
 * button, and nothing else is allowed near it.
 */
export function CompletionPanel({
  missionId,
  criteria,
  evidence,
}: {
  missionId: string;
  criteria: CriterionState[];
  evidence: EvidenceIndex;
}) {
  const [state, action, pending] = useActionState(completeMissionAction, OK);
  const readiness = completionReadiness("active", criteria);

  return (
    <section aria-labelledby="definition-of-done" className="flex flex-col gap-4">
      <h2 id="definition-of-done" className="text-sm font-medium">
        {copy.definitionOfDone}
      </h2>

      <ul className="flex flex-col gap-2">
        {criteria.map((criterion) => (
          <CriterionRow
            key={criterion.id}
            missionId={missionId}
            criterion={criterion}
            evidence={evidence[criterion.id] ?? []}
          />
        ))}
      </ul>

      <div
        data-testid="completion"
        className="flex flex-col gap-3 rounded-[--radius-base] border border-border p-4"
      >
        {readiness.ready ? (
          <>
            <p className="text-sm">{copy.completionReady}</p>
            <form action={action}>
              <input type="hidden" name="missionId" value={missionId} />
              <Button type="submit" disabled={pending}>
                {pending ? copy.completing : copy.complete}
              </Button>
            </form>
          </>
        ) : (
          <>
            <p className="max-w-prose text-sm text-muted-foreground">{copy.completionPending}</p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
              {readiness.open.map((criterion) => (
                <li key={criterion.id}>{criterion.description}</li>
              ))}
            </ul>
          </>
        )}

        <Refusal state={state} />
      </div>
    </section>
  );
}
