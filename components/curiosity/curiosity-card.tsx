"use client";

import { useActionState } from "react";

import { PromoteDialog } from "./promote-dialog";
import { setCuriosityStateAction } from "@/app/(app)/curiosities/actions";
import { ContentClassBadge } from "@/components/ui/content-class";
import { FormError, controlClass } from "@/components/ui/form";
import type { CampaignWithDirection } from "@/lib/domain/campaign";
import type { Curiosity } from "@/lib/domain/curiosity";
import { OK } from "@/lib/domain/errors";
import { ptBR } from "@/lib/i18n/pt-BR";
import { SETTABLE_CURIOSITY_STATES } from "@/lib/validation/curiosity";

const copy = ptBR.curiosity;

/** A `chosen` curiosity already became a mission; the only story left is the link to it. */
function isOpen(state: string): boolean {
  return state !== "chosen";
}

function StateControl({ curiosity }: { curiosity: Curiosity }) {
  const [state, action, pending] = useActionState(setCuriosityStateAction, OK);

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="curiosityId" value={curiosity.id} />
      <select
        name="state"
        defaultValue={curiosity.state}
        disabled={pending}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        aria-label={copy.filterLabel}
        className={controlClass}
      >
        {SETTABLE_CURIOSITY_STATES.map((value) => (
          <option key={value} value={value}>
            {ptBR.curiosityState[value]}
          </option>
        ))}
      </select>
      <FormError message={state.error} />
    </form>
  );
}

export function CuriosityCard({
  curiosity,
  campaigns,
}: {
  curiosity: Curiosity;
  campaigns: CampaignWithDirection[];
}) {
  return (
    <article
      data-testid="curiosity-card"
      className="flex flex-col gap-3 rounded-[--radius-base] border border-border p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="font-medium">{curiosity.title}</p>
        <ContentClassBadge kind="curiosity" />
      </div>

      {curiosity.state === "chosen" ? (
        <p className="text-sm text-muted-foreground">{ptBR.curiosityState.chosen}</p>
      ) : (
        <div className="max-w-48">
          <StateControl curiosity={curiosity} />
        </div>
      )}

      {isOpen(curiosity.state) ? (
        <details>
          <summary className="cursor-pointer text-sm text-curiosity hover:underline">
            {copy.promote}
          </summary>
          <div className="mt-3">
            <PromoteDialog
              curiosityId={curiosity.id}
              title={curiosity.title}
              campaigns={campaigns}
            />
          </div>
        </details>
      ) : null}
    </article>
  );
}
