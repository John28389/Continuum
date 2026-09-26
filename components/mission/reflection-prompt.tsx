"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { RuleViolation } from "./rule-violation";
import { reviewMissionAction, type ReviewState } from "@/app/(app)/missions/[id]/actions";
import { Button, Field, FormError, controlClass } from "@/components/ui/form";
import { ptBR } from "@/lib/i18n/pt-BR";
import { REVIEW_OUTCOMES, REVIEW_REASON_CATEGORIES } from "@/lib/rules/integrity";

const copy = ptBR.review;

const INITIAL: ReviewState = {};

/**
 * Leaving — or deliberately keeping — the active mission (RULE-004).
 *
 * Collapsed by default: a review is an occasional, deliberate act, and a form
 * permanently open beside the mission would read as an invitation to leave it.
 * When opened, the question comes first and the parking lot is offered as the
 * honest answer for a change of interest, before any field is shown.
 *
 * No outcome is preselected. Keeping the mission is recorded as a decision, and
 * the form asks for it as deliberately as it asks for ending one. The submit
 * button is quiet on purpose: ending a mission should never be the most
 * prominent thing on its page.
 *
 * The fields are controlled. React 19 resets a form's uncontrolled fields after
 * every action, including one the server refused, so a justification one
 * character short would have wiped the decision, the category and the text.
 * A refusal here is a prompt to add a sentence, not to start over.
 *
 * The database is what makes this true. `review_mission()` writes the
 * justification and the status change in one transaction, and the exit trigger
 * refuses any other way out of `active`.
 */
export function ReflectionPrompt({ missionId }: { missionId: string }) {
  const [state, action, pending] = useActionState(reviewMissionAction, INITIAL);
  const [outcome, setOutcome] = useState("");
  const [category, setCategory] = useState("");
  const [justification, setJustification] = useState("");

  return (
    <details
      data-testid="reflection-prompt"
      className="rounded-[--radius-base] border border-border p-4"
    >
      <summary className="cursor-pointer text-sm font-medium">{copy.open}</summary>

      <div className="mt-4 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="font-medium">{copy.prompt}</p>
          <p className="max-w-prose text-sm text-muted-foreground">{copy.promptBody}</p>
          <Link
            href="/curiosities"
            className="text-sm text-curiosity underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {ptBR.mission.parkInstead}
          </Link>
        </div>

        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="missionId" value={missionId} />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{copy.outcome}</legend>
            {REVIEW_OUTCOMES.map((value) => (
              <label key={value} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="outcome"
                  value={value}
                  required
                  checked={outcome === value}
                  onChange={() => setOutcome(value)}
                  className="mt-1"
                />
                <span className="flex flex-col">
                  <span>{copy.outcomes[value]}</span>
                  <span className="text-xs text-muted-foreground">{copy.outcomeHints[value]}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <Field label={copy.category} htmlFor="review-category">
            <select
              id="review-category"
              name="reasonCategory"
              required
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={controlClass}
            >
              <option value="" disabled>
                {copy.categoryPlaceholder}
              </option>
              {REVIEW_REASON_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {ptBR.reviewCategory[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label={copy.justification}
            htmlFor="review-justification"
            hint={copy.justificationHint}
          >
            <textarea
              id="review-justification"
              name="justification"
              rows={4}
              required
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              className={controlClass}
            />
          </Field>

          {state.ruleCode ? (
            <RuleViolation ruleCode={state.ruleCode} />
          ) : (
            <FormError message={state.error} />
          )}

          {state.recorded ? (
            <p role="status" className="text-sm">
              {copy.kept}
            </p>
          ) : null}

          <div>
            <Button type="submit" variant="quiet" disabled={pending}>
              {pending ? copy.submitting : copy.submit}
            </Button>
          </div>
        </form>
      </div>
    </details>
  );
}
