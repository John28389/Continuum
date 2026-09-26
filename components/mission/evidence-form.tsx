"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { RuleViolation } from "./rule-violation";
import { addEvidenceAction } from "@/app/(app)/missions/[id]/evidence/actions";
import { Button, Field, FormError, controlClass } from "@/components/ui/form";
import { OK } from "@/lib/domain/errors";
import { ptBR } from "@/lib/i18n/pt-BR";

const copy = ptBR.evidence;

/**
 * Recording what exists after the effort.
 *
 * Only the description is required. Citing a criterion is optional — evidence
 * can speak to the mission as a whole — and so is the link. Asking for more up
 * front would make recording output cost more than recording hours, which is
 * exactly backwards.
 *
 * The fields are controlled so a server refusal never wipes what was typed.
 */
export function EvidenceForm({
  missionId,
  criteria,
}: {
  missionId: string;
  criteria: { id: string; description: string }[];
}) {
  const [state, action, pending] = useActionState(addEvidenceAction, OK);
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [criterionId, setCriterionId] = useState("");
  // React 19's post-action form reset touches the select element's own DOM
  // state even when it is controlled — unlike a text field, a select is not
  // defended against that, so its visible selection can drift from
  // `criterionId` without React noticing there is anything to re-sync.
  // Remounting it after every submission forces the DOM back to match state.
  const [criterionSelectKey, setCriterionSelectKey] = useState(0);

  // A refusal keeps what was typed; only a successful add clears the form for
  // the next one. `state` alone cannot signal that transition — `OK` is one
  // shared reference, so it is not a new value to compare against — but a
  // pending -> idle transition with no error is.
  const wasPending = useRef(pending);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setDescription("");
      setUrl("");
      setCriterionId("");
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  const wasPendingForSelect = useRef(pending);
  useEffect(() => {
    if (wasPendingForSelect.current && !pending) {
      setCriterionSelectKey((key) => key + 1);
    }
    wasPendingForSelect.current = pending;
  }, [pending]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="missionId" value={missionId} />

      <Field label={copy.what} htmlFor="evidence-description">
        <textarea
          id="evidence-description"
          name="description"
          rows={2}
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={controlClass}
        />
      </Field>

      <Field label={copy.url} htmlFor="evidence-url" hint={copy.urlHint}>
        <input
          id="evidence-url"
          name="url"
          type="url"
          inputMode="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className={controlClass}
        />
      </Field>

      <Field label={copy.criterion} htmlFor="evidence-criterion">
        <select
          key={criterionSelectKey}
          id="evidence-criterion"
          name="criterionId"
          value={criterionId}
          onChange={(event) => setCriterionId(event.target.value)}
          className={controlClass}
        >
          <option value="">{copy.noCriterion}</option>
          {criteria.map((criterion) => (
            <option key={criterion.id} value={criterion.id}>
              {criterion.description}
            </option>
          ))}
        </select>
      </Field>

      {state.ruleCode ? (
        <RuleViolation ruleCode={state.ruleCode} />
      ) : (
        <FormError message={state.error} />
      )}

      <div>
        <Button type="submit" variant="quiet" disabled={pending}>
          {pending ? copy.adding : copy.add}
        </Button>
      </div>
    </form>
  );
}
