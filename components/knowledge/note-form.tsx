"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { createNoteAction, updateNoteAction } from "@/app/(app)/knowledge/actions";
import { Button, Field, FormError, controlClass } from "@/components/ui/form";
import { OK } from "@/lib/domain/errors";
import { ptBR } from "@/lib/i18n/pt-BR";
import { NOTE_TYPES } from "@/lib/validation/knowledge";

const copy = ptBR.knowledge;

interface EditableNote {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly note_type: string;
}

/**
 * Writing a note, or editing one.
 *
 * Two required fields and a type that already has a sensible answer. Anything
 * more — tags, areas, a summary, a link to fill in first — would make writing a
 * note cost more than it returns, and then notes stop being written.
 *
 * The submit is quiet: knowledge is never styled like the mission.
 *
 * The fields are controlled so a refused save never wipes what was written —
 * ten rows of content lost to one validation error would be the worst version
 * of this bug.
 *
 * The type select additionally needs a key bump on every submission. Unlike a
 * text field, a controlled select is not defended by React against the same
 * post-action reset, so its visible selection can silently drift from
 * `noteType` even though the field is controlled; remounting it forces the
 * DOM back to match state.
 */
export function NoteForm({
  note,
  missionId = null,
  initialType = "concept",
}: {
  note?: EditableNote;
  missionId?: string | null;
  /** The type a new note starts with, when the way in already says it. */
  initialType?: string;
}) {
  const [state, action, pending] = useActionState(note ? updateNoteAction : createNoteAction, OK);
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [noteType, setNoteType] = useState(note?.note_type ?? initialType);
  const [typeSelectKey, setTypeSelectKey] = useState(0);

  const wasPending = useRef(pending);
  useEffect(() => {
    if (wasPending.current && !pending) {
      setTypeSelectKey((key) => key + 1);
    }
    wasPending.current = pending;
  }, [pending]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {note ? <input type="hidden" name="noteId" value={note.id} /> : null}
      {missionId ? <input type="hidden" name="missionId" value={missionId} /> : null}

      <Field label={copy.title} htmlFor="note-title">
        <input
          id="note-title"
          name="title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={controlClass}
        />
      </Field>

      <Field label={copy.content} htmlFor="note-content">
        <textarea
          id="note-content"
          name="content"
          rows={10}
          required
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className={controlClass}
        />
      </Field>

      <Field label={copy.type} htmlFor="note-type">
        <select
          key={typeSelectKey}
          id="note-type"
          name="noteType"
          value={noteType}
          onChange={(event) => setNoteType(event.target.value)}
          className={controlClass}
        >
          {NOTE_TYPES.map((type) => (
            <option key={type} value={type}>
              {copy.types[type]}
            </option>
          ))}
        </select>
      </Field>

      <FormError message={state.error} />

      <div>
        <Button type="submit" variant="quiet" disabled={pending}>
          {note ? copy.save : copy.create}
        </Button>
      </div>
    </form>
  );
}
