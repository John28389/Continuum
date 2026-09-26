import Link from "next/link";

import { excerpt, type KnowledgeNote } from "@/lib/domain/knowledge";
import { ptBR } from "@/lib/i18n/pt-BR";
import { NOTE_TYPES, type NoteType } from "@/lib/validation/knowledge";

/** A type's label, or nothing for a value outside the vocabulary. */
export function noteTypeLabel(type: string): string {
  return (NOTE_TYPES as readonly string[]).includes(type)
    ? ptBR.knowledge.types[type as NoteType]
    : "";
}

/** Notes, as titles with their type and first lines. */
export function NoteList({ notes }: { notes: KnowledgeNote[] }) {
  return (
    <ul data-testid="note-list" className="flex flex-col gap-2">
      {notes.map((note) => (
        <li
          key={note.id}
          className="flex flex-col gap-1 rounded-[--radius-base] border border-border px-4 py-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Link
              href={`/knowledge/${note.id}`}
              className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {note.title}
            </Link>
            <span className="font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
              {noteTypeLabel(note.note_type)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{excerpt(note.content)}</p>
        </li>
      ))}
    </ul>
  );
}
