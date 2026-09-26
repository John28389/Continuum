"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { promoteCuriosityAction } from "@/app/(app)/curiosities/actions";
import { RuleViolation } from "@/components/mission/rule-violation";
import { Button, Field, FormError, controlClass } from "@/components/ui/form";
import type { CampaignWithDirection } from "@/lib/domain/campaign";
import { OK } from "@/lib/domain/errors";
import { ptBR } from "@/lib/i18n/pt-BR";

const copy = ptBR.curiosity;

/**
 * Promotion into a draft mission (RULE-007).
 *
 * Offered whenever the curiosity is still open, whatever the actual boundary
 * state is — hiding the control when the window happens to be closed would
 * make the rule invisible instead of explaining it. The refusal, when it
 * comes, names the rule and says why: the same choice already made for
 * activating a mission into RULE-001.
 *
 * No cycle field: the database always targets the caller's own active cycle,
 * so there is nothing here to choose or to get wrong.
 */
export function PromoteDialog({
  curiosityId,
  title,
  campaigns,
}: {
  curiosityId: string;
  title: string;
  campaigns: CampaignWithDirection[];
}) {
  const [state, action, pending] = useActionState(promoteCuriosityAction, OK);
  const [missionTitle, setMissionTitle] = useState(title);
  const [reason, setReason] = useState("");
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
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

  if (campaigns.length === 0) {
    return <p className="text-sm text-muted-foreground">{copy.needsCampaign}</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="curiosityId" value={curiosityId} />

      <Field label={copy.campaign} htmlFor={`promote-campaign-${curiosityId}`}>
        <select
          key={campaignSelectKey}
          id={`promote-campaign-${curiosityId}`}
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

      <Field label={ptBR.mission.title} htmlFor={`promote-title-${curiosityId}`}>
        <input
          id={`promote-title-${curiosityId}`}
          name="title"
          required
          value={missionTitle}
          onChange={(event) => setMissionTitle(event.target.value)}
          className={controlClass}
        />
      </Field>

      <Field label={copy.reason} htmlFor={`promote-reason-${curiosityId}`}>
        <textarea
          id={`promote-reason-${curiosityId}`}
          name="reason"
          rows={2}
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={controlClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={copy.minLoadField} htmlFor={`promote-min-${curiosityId}`}>
          <input
            id={`promote-min-${curiosityId}`}
            name="minLoadHours"
            inputMode="decimal"
            required
            value={minLoadHours}
            onChange={(event) => setMinLoadHours(event.target.value)}
            className={controlClass}
          />
        </Field>

        <Field label={copy.targetLoadField} htmlFor={`promote-target-${curiosityId}`}>
          <input
            id={`promote-target-${curiosityId}`}
            name="targetLoadHours"
            inputMode="decimal"
            required
            value={targetLoadHours}
            onChange={(event) => setTargetLoadHours(event.target.value)}
            className={controlClass}
          />
        </Field>
      </div>

      {state.ruleCode ? (
        <RuleViolation ruleCode={state.ruleCode} />
      ) : (
        <FormError message={state.error} />
      )}

      <div>
        <Button type="submit" variant="quiet" disabled={pending}>
          {pending ? copy.promoteConfirming : copy.promoteConfirm}
        </Button>
      </div>
    </form>
  );
}
