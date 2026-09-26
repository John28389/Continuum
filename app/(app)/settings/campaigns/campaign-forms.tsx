"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { archiveCampaignAction, createCampaignAction, updateCampaignAction } from "./actions";
import { Button, Field, FormError, controlClass } from "@/components/ui/form";
import type { CampaignWithDirection } from "@/lib/domain/campaign";
import type { Direction } from "@/lib/domain/direction";
import { OK, type ActionState } from "@/lib/domain/errors";
import { ptBR } from "@/lib/i18n/pt-BR";

const copy = ptBR.hierarchy.campaign;

/**
 * The fields, shared by create and edit.
 *
 * A campaign must belong to a direction. The select offers only active ones,
 * and the composite foreign key on (direction_id, user_id) is what actually
 * enforces it — so a tampered form value is refused by the schema rather than
 * silently attaching the campaign somewhere it does not belong.
 *
 * The fields are controlled so a refused submit never wipes what was typed.
 * `clearOnSuccess` is only set by the create form: a successful edit should
 * keep showing what was just saved, not blank itself.
 */
function CampaignFields({
  directions,
  campaign,
  idPrefix,
  state,
  pending,
  clearOnSuccess = false,
}: {
  directions: Direction[];
  campaign?: CampaignWithDirection;
  idPrefix: string;
  state: ActionState;
  pending: boolean;
  clearOnSuccess?: boolean;
}) {
  const [directionId, setDirectionId] = useState(campaign?.direction_id ?? directions[0]?.id ?? "");
  const [name, setName] = useState(campaign?.name ?? "");
  const [objective, setObjective] = useState(campaign?.objective ?? "");
  const [successCriteria, setSuccessCriteria] = useState(campaign?.success_criteria ?? "");
  const [startsOn, setStartsOn] = useState(campaign?.starts_on ?? "");
  const [endsOn, setEndsOn] = useState(campaign?.ends_on ?? "");
  // Unlike a text field, a controlled select is not defended by React against
  // the post-action form reset, so its visible selection can silently drift
  // from `directionId` even though the field is controlled.
  // Bumping this key remounts the select after every submission, forcing the
  // DOM back to match state.
  const [directionSelectKey, setDirectionSelectKey] = useState(0);

  const wasPending = useRef(pending);
  useEffect(() => {
    if (clearOnSuccess && wasPending.current && !pending && !state.error) {
      setDirectionId(directions[0]?.id ?? "");
      setName("");
      setObjective("");
      setSuccessCriteria("");
      setStartsOn("");
      setEndsOn("");
    }
    wasPending.current = pending;
  }, [clearOnSuccess, pending, state.error, directions]);

  const wasPendingForSelect = useRef(pending);
  useEffect(() => {
    if (wasPendingForSelect.current && !pending) {
      setDirectionSelectKey((key) => key + 1);
    }
    wasPendingForSelect.current = pending;
  }, [pending]);

  return (
    <>
      <Field label={copy.belongsTo} htmlFor={`${idPrefix}-direction`}>
        <select
          key={directionSelectKey}
          id={`${idPrefix}-direction`}
          name="directionId"
          required
          value={directionId}
          onChange={(event) => setDirectionId(event.target.value)}
          className={controlClass}
        >
          <option value="" disabled>
            {copy.belongsTo}
          </option>
          {directions.map((direction) => (
            <option key={direction.id} value={direction.id}>
              {direction.title}
            </option>
          ))}
        </select>
      </Field>

      <Field label={copy.name} htmlFor={`${idPrefix}-name`}>
        <input
          id={`${idPrefix}-name`}
          name="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={controlClass}
        />
      </Field>

      <Field label={copy.objective} htmlFor={`${idPrefix}-objective`}>
        <input
          id={`${idPrefix}-objective`}
          name="objective"
          required
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          className={controlClass}
        />
      </Field>

      <Field label={copy.successCriteria} htmlFor={`${idPrefix}-criteria`}>
        <textarea
          id={`${idPrefix}-criteria`}
          name="successCriteria"
          rows={2}
          value={successCriteria}
          onChange={(event) => setSuccessCriteria(event.target.value)}
          className={controlClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={ptBR.hierarchy.startsOn} htmlFor={`${idPrefix}-starts`}>
          <input
            id={`${idPrefix}-starts`}
            name="startsOn"
            type="date"
            required
            value={startsOn}
            onChange={(event) => setStartsOn(event.target.value)}
            className={controlClass}
          />
        </Field>

        <Field label={ptBR.hierarchy.endsOn} htmlFor={`${idPrefix}-ends`}>
          <input
            id={`${idPrefix}-ends`}
            name="endsOn"
            type="date"
            required
            value={endsOn}
            onChange={(event) => setEndsOn(event.target.value)}
            className={controlClass}
          />
        </Field>
      </div>
    </>
  );
}

export function CreateCampaignForm({ directions }: { directions: Direction[] }) {
  const [state, action, pending] = useActionState(createCampaignAction, OK);

  return (
    <form action={action} className="flex flex-col gap-4">
      <CampaignFields
        directions={directions}
        idPrefix="new"
        state={state}
        pending={pending}
        clearOnSuccess
      />
      <FormError message={state.error} />
      <div>
        <Button type="submit" disabled={pending}>
          {copy.create}
        </Button>
      </div>
    </form>
  );
}

export function CampaignRow({
  campaign,
  directions,
}: {
  campaign: CampaignWithDirection;
  directions: Direction[];
}) {
  const [editState, editAction, editing] = useActionState(updateCampaignAction, OK);
  const [archiveState, archiveAction, archiving] = useActionState(archiveCampaignAction, OK);

  const isArchived = campaign.status === "archived";

  return (
    <li className="flex flex-col gap-3 rounded-[--radius-base] border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-medium">{campaign.name}</p>
          <p className="max-w-prose text-sm text-muted-foreground">{campaign.objective}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {campaign.starts_on} — {campaign.ends_on}
          </p>
        </div>

        <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
          {isArchived ? ptBR.hierarchy.archived : ptBR.hierarchy.active}
        </span>
      </div>

      {isArchived ? null : (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            {ptBR.hierarchy.edit}
          </summary>

          <div className="mt-3 flex flex-col gap-4">
            <form action={editAction} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={campaign.id} />
              <CampaignFields
                directions={directions}
                campaign={campaign}
                idPrefix={campaign.id}
                state={editState}
                pending={editing}
              />
              <FormError message={editState.error} />
              <div>
                <Button type="submit" variant="quiet" disabled={editing}>
                  {ptBR.hierarchy.save}
                </Button>
              </div>
            </form>

            <form action={archiveAction}>
              <input type="hidden" name="id" value={campaign.id} />
              <FormError message={archiveState.error} />
              <Button type="submit" variant="danger" disabled={archiving}>
                {ptBR.hierarchy.archive}
              </Button>
            </form>
          </div>
        </details>
      )}
    </li>
  );
}
