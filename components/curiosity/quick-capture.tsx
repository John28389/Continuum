"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { captureCuriosityAction } from "@/app/(app)/curiosities/actions";
import { Button, FormError } from "@/components/ui/form";
import { OK } from "@/lib/domain/errors";
import { ptBR } from "@/lib/i18n/pt-BR";

const copy = ptBR.curiosity;

/**
 * Capture, in one field.
 *
 * The only requirement M12 sets: a curiosity has to be captured in seconds, or
 * it will not be captured at the moment it appears, which is the only moment
 * that matters. Nothing here asks for an area, a potential or a rationale —
 * those can be added later, from the card, if they turn out to matter at all.
 *
 * The title is controlled so a refusal never wipes what was typed, and a
 * successful capture clears the field so the same box is ready for the next
 * idea without the person doing anything else.
 */
export function QuickCapture({
  onCaptured,
  autoFocus = false,
}: {
  onCaptured?: () => void;
  autoFocus?: boolean;
}) {
  const [state, action, pending] = useActionState(captureCuriosityAction, OK);
  const [title, setTitle] = useState("");

  const wasPending = useRef(pending);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setTitle("");
      onCaptured?.();
    }
    wasPending.current = pending;
  }, [pending, state.error, onCaptured]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="curiosity-title" className="text-sm font-medium">
          {copy.titleField}
        </label>
        <input
          id="curiosity-title"
          name="title"
          required
          autoFocus={autoFocus}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-[--radius-base] border border-border-strong bg-surface-raised px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <FormError message={state.error} />

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? copy.capturing : copy.capture}
        </Button>
      </div>
    </form>
  );
}
