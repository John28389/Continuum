"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { DodEditor } from "./dod-editor";
import { RuleViolation } from "./rule-violation";
import { createMissionAction } from "@/app/(app)/missions/actions";
import { Button, Field, FormError, controlClass } from "@/components/ui/form";
import type { Campaign } from "@/lib/domain/campaign";
import type { Cycle } from "@/lib/domain/cycle";
import { OK } from "@/lib/domain/errors";
import { ptBR } from "@/lib/i18n/pt-BR";

const copy = ptBR.mission;

/**
 * Creating a mission.
 *
 * The cycle is fixed to the open one and shown rather than chosen. RULE-005
 * binds activation to the active cycle, so a picker would mostly be an
 * opportunity to build something that cannot be started — and choosing next
 * month's mission during this month is the exact behaviour the rule exists to
 * prevent. It is still sent as a field and still checked by the database:
 * a tampered value is refused by the composite foreign key, and by RULE-005 at
 * activation.
 *
 * There is no status field, here or anywhere. The mission is created as a
 * draft and activation is a separate, deliberate act.
 *
 * The fields are controlled. React 19 resets a form's uncontrolled fields
 * after every action, including one the server refused — a RULE-003 load
 * refusal would otherwise wipe the title and reason along with the numbers.
 *
 * The campaign select additionally needs a key bump on every submission.
 * Unlike a text field, a controlled select is not defended by React against
 * the same post-action reset, so its visible selection can silently drift
 * from `campaignId` even though the field is controlled; remounting it forces
 * the DOM back to match state.
 */
export function MissionForm({ campaigns, cycle }: { campaigns: Campaign[]; cycle: Cycle }) {
  const [state, action, pending] = useActionState(createMissionAction, OK);
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [minLoadHours, setMinLoadHours] = useState("");
  const [targetLoadHours, setTargetLoadHours] = useState("");
  const [campaignSelectKey, setCampaignSelectKey] = useState(0);

  const wasPending = useRef(pending);
  useEffect(() => {
    if (wasPending.current && !pending) {
      setCampaignSelectKey((key) => key + 1);
    }
    wasPending.current = pending;
  }, [pending]);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="cycleId" value={cycle.id} />

      <Field label={copy.campaign} htmlFor="mission-campaign">
        <select
          key={campaignSelectKey}
          id="mission-campaign"
          name="campaignId"
          required
          value={campaignId}
          onChange={(event) => setCampaignId(event.target.value)}
          className={controlClass}
        >
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label={copy.cycle} htmlFor="mission-cycle">
        <input id="mission-cycle" value={cycle.label} readOnly disabled className={controlClass} />
      </Field>

      <Field label={copy.title} htmlFor="mission-title">
        <input
          id="mission-title"
          name="title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={controlClass}
        />
      </Field>

      <Field label={copy.reason} htmlFor="mission-reason" hint={copy.reasonHint}>
        <textarea
          id="mission-reason"
          name="reason"
          rows={3}
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={controlClass}
        />
      </Field>

      <Field label={copy.descriptionField} htmlFor="mission-description">
        <textarea
          id="mission-description"
          name="description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={controlClass}
        />
      </Field>

      <div className="flex flex-col gap-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={copy.minLoadField} htmlFor="mission-min-load" hint={copy.minLoadHint}>
            <input
              id="mission-min-load"
              name="minLoadHours"
              inputMode="decimal"
              required
              value={minLoadHours}
              onChange={(event) => setMinLoadHours(event.target.value)}
              className={controlClass}
            />
          </Field>

          <Field
            label={copy.targetLoadField}
            htmlFor="mission-target-load"
            hint={copy.targetLoadHint}
          >
            <input
              id="mission-target-load"
              name="targetLoadHours"
              inputMode="decimal"
              required
              value={targetLoadHours}
              onChange={(event) => setTargetLoadHours(event.target.value)}
              className={controlClass}
            />
          </Field>
        </div>

        {/* RULE-102, before the numbers are even entered. */}
        <p className="max-w-prose text-xs text-muted-foreground">{copy.loadNote}</p>
      </div>

      <DodEditor />

      {state.ruleCode ? <RuleViolation ruleCode={state.ruleCode} /> : null}
      {state.error && !state.ruleCode ? <FormError message={state.error} /> : null}

      <div>
        <Button type="submit" disabled={pending}>
          {copy.create}
        </Button>
      </div>
    </form>
  );
}
