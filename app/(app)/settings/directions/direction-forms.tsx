"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { archiveDirectionAction, createDirectionAction, updateDirectionAction } from "./actions";
import { Button, Field, FormError, controlClass } from "@/components/ui/form";
import type { Direction } from "@/lib/domain/direction";
import { OK } from "@/lib/domain/errors";
import { ptBR } from "@/lib/i18n/pt-BR";

const copy = ptBR.hierarchy.direction;

/**
 * The fields are controlled so a refused create never wipes what was typed.
 * Only a successful create clears the form for the next one.
 */
export function CreateDirectionForm() {
  const [state, action, pending] = useActionState(createDirectionAction, OK);
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");

  const wasPending = useRef(pending);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setTitle("");
      setStatement("");
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={copy.title} htmlFor="direction-title">
        <input
          id="direction-title"
          name="title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={controlClass}
        />
      </Field>

      <Field label={copy.statement} htmlFor="direction-statement">
        <textarea
          id="direction-statement"
          name="statement"
          rows={3}
          value={statement}
          onChange={(event) => setStatement(event.target.value)}
          className={controlClass}
        />
      </Field>

      <FormError message={state.error} />

      <div>
        <Button type="submit" disabled={pending}>
          {copy.create}
        </Button>
      </div>
    </form>
  );
}

/**
 * Editing is a disclosure rather than a separate page.
 *
 * `<details>` keeps the list readable while making a correction one click away,
 * and it works before hydration — which matters for a form whose whole purpose
 * is to fix something.
 */
export function DirectionRow({ direction }: { direction: Direction }) {
  const [editState, editAction, editing] = useActionState(updateDirectionAction, OK);
  const [archiveState, archiveAction, archiving] = useActionState(archiveDirectionAction, OK);
  const [title, setTitle] = useState(direction.title);
  const [statement, setStatement] = useState(direction.statement ?? "");

  const isArchived = direction.status === "archived";

  return (
    <li className="flex flex-col gap-3 rounded-[--radius-base] border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-medium">{direction.title}</p>
          {direction.statement ? (
            <p className="max-w-prose text-sm text-muted-foreground">{direction.statement}</p>
          ) : null}
        </div>

        <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
          {isArchived ? ptBR.hierarchy.archived : ptBR.hierarchy.active}
        </span>
      </div>

      {isArchived ? null : (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            {ptBR.hierarchy.edit}
          </summary>

          <div className="mt-3 flex flex-col gap-4">
            <form action={editAction} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={direction.id} />

              <Field label={copy.title} htmlFor={`title-${direction.id}`}>
                <input
                  id={`title-${direction.id}`}
                  name="title"
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className={controlClass}
                />
              </Field>

              <Field label={copy.statement} htmlFor={`statement-${direction.id}`}>
                <textarea
                  id={`statement-${direction.id}`}
                  name="statement"
                  rows={3}
                  value={statement}
                  onChange={(event) => setStatement(event.target.value)}
                  className={controlClass}
                />
              </Field>

              <FormError message={editState.error} />

              <div>
                <Button type="submit" variant="quiet" disabled={editing}>
                  {ptBR.hierarchy.save}
                </Button>
              </div>
            </form>

            <form action={archiveAction}>
              <input type="hidden" name="id" value={direction.id} />
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
