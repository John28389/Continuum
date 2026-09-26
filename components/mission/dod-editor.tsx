"use client";

import { useState } from "react";

import { X } from "lucide-react";

import { RuleAdvisory } from "./rule-violation";
import { Button, Field, controlClass } from "@/components/ui/form";
import { ptBR } from "@/lib/i18n/pt-BR";
import { assessCriterion, missionMeasurability } from "@/lib/rules/measurability";

const copy = ptBR.mission;

/**
 * The Definition of Done, edited as rows.
 *
 * Rows rather than prose because that is what makes RULE-002 checkable at all,
 * and what will let a criterion be satisfied individually and linked to
 * evidence later.
 *
 * The RULE-101 advisory renders here, live, and never disables anything. It is
 * a question — is this something you could actually verify? — not a gate. The
 * mission-level note appears only when no criterion looks verifiable, because
 * that is precisely what its wording claims.
 */
export function DodEditor() {
  const [criteria, setCriteria] = useState<string[]>([""]);

  const measurability = missionMeasurability(criteria);

  const update = (index: number, value: string) =>
    setCriteria((current) => current.map((item, i) => (i === index ? value : item)));

  // A block body rather than an expression. The copy guard reads the span
  // between two angle brackets as user-facing text, and a trailing arrow
  // expression immediately before the JSX looks exactly like that to it.
  const remove = (index: number) => {
    setCriteria((current) => (current.length === 1 ? [""] : current.filter((_, i) => i !== index)));
  };

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-sm font-medium">{copy.criteria}</legend>
      <p className="max-w-prose text-xs text-muted-foreground">{copy.criteriaHint}</p>

      {criteria.map((criterion, index) => {
        const assessment = assessCriterion(criterion);
        const flagged = criterion.trim() !== "" && !assessment.verifiable;

        return (
          <div key={index} className="flex flex-col gap-1.5">
            <Field label={`${copy.criterion} ${index + 1}`} htmlFor={`criterion-${index}`}>
              <div className="flex items-start gap-2">
                <input
                  id={`criterion-${index}`}
                  name="criteria"
                  value={criterion}
                  onChange={(event) => update(index, event.target.value)}
                  className={controlClass}
                />
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() => remove(index)}
                  aria-label={`${copy.removeCriterion} ${index + 1}`}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            </Field>

            {flagged ? (
              <p className="text-xs text-muted-foreground">{copy.criterionUnverifiable}</p>
            ) : null}
          </div>
        );
      })}

      <div>
        <Button type="button" variant="quiet" onClick={() => setCriteria((c) => [...c, ""])}>
          {copy.addCriterion}
        </Button>
      </div>

      {measurability.needsAdvisory ? <RuleAdvisory ruleCode="RULE-101" /> : null}
    </fieldset>
  );
}
