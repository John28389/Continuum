"use client";

import Link from "next/link";
import { useActionState } from "react";

import { addLinkAction, removeLinkAction } from "@/app/(app)/knowledge/actions";
import { Button, Field, FormError, controlClass } from "@/components/ui/form";
import type { LinkedNote } from "@/lib/domain/knowledge";
import { OK } from "@/lib/domain/errors";
import { ptBR } from "@/lib/i18n/pt-BR";
import { LINK_RELATIONS, type LinkRelation } from "@/lib/validation/knowledge";

const copy = ptBR.knowledge;

function relationLabel(relation: string): string {
  return (LINK_RELATIONS as readonly string[]).includes(relation)
    ? copy.relations[relation as LinkRelation]
    : "";
}

function LinkRow({ noteId, link }: { noteId: string; link: LinkedNote }) {
  const [state, action, pending] = useActionState(removeLinkAction, OK);

  return (
    <li className="flex flex-col gap-1 rounded-[--radius-base] border border-border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-xs text-muted-foreground">
            {relationLabel(link.relation)}
          </span>
          <Link
            href={`/knowledge/${link.note.id}`}
            className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {link.note.title}
          </Link>
        </span>
        <form action={action}>
          <input type="hidden" name="linkId" value={link.linkId} />
          <input type="hidden" name="noteId" value={noteId} />
          <input type="hidden" name="otherNoteId" value={link.note.id} />
          <Button
            type="submit"
            variant="quiet"
            disabled={pending}
            aria-label={`${copy.removeLink}: ${link.note.title}`}
          >
            {copy.remove}
          </Button>
        </form>
      </div>
      <FormError message={state.error} />
    </li>
  );
}

function AddLinkForm({
  noteId,
  candidates,
}: {
  noteId: string;
  candidates: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(addLinkAction, OK);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="fromNoteId" value={noteId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={copy.relation} htmlFor="link-relation">
          <select
            id="link-relation"
            name="relation"
            defaultValue="relates_to"
            className={controlClass}
          >
            {LINK_RELATIONS.map((relation) => (
              <option key={relation} value={relation}>
                {copy.relations[relation]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={copy.linkTo} htmlFor="link-target">
          <select
            id="link-target"
            name="toNoteId"
            required
            defaultValue=""
            className={controlClass}
          >
            <option value="" disabled>
              {copy.chooseNote}
            </option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <FormError message={state.error} />
      <div>
        <Button type="submit" variant="quiet" disabled={pending}>
          {copy.addLink}
        </Button>
      </div>
    </form>
  );
}

/**
 * A note's connections, from both ends.
 *
 * Each link is stored once and read twice: as "Ligações" on the note that made
 * it and as "Referenciada por" on the note it points to. Nobody creates the
 * reverse link, so the two sides can never disagree.
 */
export function NoteLinks({
  noteId,
  outgoing,
  backlinks,
  candidates,
}: {
  noteId: string;
  outgoing: LinkedNote[];
  backlinks: LinkedNote[];
  candidates: { id: string; title: string }[];
}) {
  return (
    <section aria-labelledby="note-links" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 id="note-links" className="text-sm font-medium">
          {copy.links}
        </h2>
        {outgoing.length !== 0 ? (
          <ul data-testid="note-outgoing" className="flex flex-col gap-2">
            {outgoing.map((link) => (
              <LinkRow key={link.linkId} noteId={noteId} link={link} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{copy.linksEmpty}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{copy.backlinks}</h3>
        {backlinks.length !== 0 ? (
          <ul data-testid="note-backlinks" className="flex flex-col gap-2">
            {backlinks.map((link) => (
              <LinkRow key={link.linkId} noteId={noteId} link={link} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{copy.backlinksEmpty}</p>
        )}
      </div>

      {candidates.length !== 0 ? (
        <AddLinkForm noteId={noteId} candidates={candidates} />
      ) : (
        <p className="text-xs text-muted-foreground">{copy.noOtherNotes}</p>
      )}
    </section>
  );
}
