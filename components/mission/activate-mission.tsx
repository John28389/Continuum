"use client";

import Link from "next/link";
import { useActionState } from "react";

import { RuleViolation } from "./rule-violation";
import { activateMissionAction } from "@/app/(app)/missions/actions";
import { Button, FormError } from "@/components/ui/form";
import { OK } from "@/lib/domain/errors";
import { ptBR } from "@/lib/i18n/pt-BR";

const copy = ptBR.mission;

/**
 * The activation control, and the refusal it may produce.
 *
 * The button is offered even when another mission is already active, and this
 * is deliberate. Hiding it would make RULE-001 invisible — the user would be
 * left guessing why the action is missing, and the rule would look like a
 * limitation of the interface rather than the commitment it actually is. The
 * refusal is the moment the product exists for, so it happens in the open, with
 * the reasoning and a legitimate alternative attached.
 *
 * It also means the block is proven where it is real: the database refuses,
 * every time, whatever the interface happened to render.
 */
export function ActivateMission({ missionId }: { missionId: string }) {
  const [state, action, pending] = useActionState(activateMissionAction, OK);

  return (
    <div className="flex flex-col gap-4">
      <form action={action}>
        <input type="hidden" name="id" value={missionId} />
        <Button type="submit" disabled={pending}>
          {pending ? copy.activating : copy.activate}
        </Button>
      </form>

      {state.ruleCode ? (
        <RuleViolation
          ruleCode={state.ruleCode}
          alternative={
            // Only RULE-001 has the parking lot as its answer. Offering it for
            // a missing Definition of Done would be advice to go somewhere else
            // when the fix is right here.
            state.ruleCode === "RULE-001" ? (
              <Link
                href="/curiosities"
                className="text-sm text-curiosity underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {copy.parkInstead}
              </Link>
            ) : undefined
          }
        />
      ) : null}

      {state.error && !state.ruleCode ? <FormError message={state.error} /> : null}
    </div>
  );
}
