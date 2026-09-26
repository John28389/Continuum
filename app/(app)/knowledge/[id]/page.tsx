import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NoteForm } from "@/components/knowledge/note-form";
import { NoteLinks } from "@/components/knowledge/note-links";
import { noteTypeLabel } from "@/components/knowledge/note-list";
import { PageHeader } from "@/components/shell/page-header";
import {
  getNote,
  linksOf,
  listLinksOf,
  listNotes,
  type KnowledgeNote,
  type NoteRef,
} from "@/lib/domain/knowledge";
import { ptBR } from "@/lib/i18n/pt-BR";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/hierarchy";

export const metadata: Metadata = { title: ptBR.pages.knowledge.title };

const copy = ptBR.knowledge;

const linkClass =
  "underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function notesIndex(notes: KnowledgeNote[]): Map<string, NoteRef> {
  return new Map(notes.map((note) => [note.id, note]));
}

function otherNotes(notes: KnowledgeNote[], noteId: string): { id: string; title: string }[] {
  return notes
    .filter((note) => note.id !== noteId)
    .map((note) => ({ id: note.id, title: note.title }));
}

/**
 * One note: its content, where it came from, and what it connects to.
 *
 * Editing sits behind a disclosure so the note reads as a note first. Links
 * come from both ends — what this note points to, and what points to it.
 */
export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const noteId = idSchema.safeParse(id);
  if (!noteId.success) notFound();

  const supabase = await createClient();
  const [note, notes, links] = await Promise.all([
    getNote(supabase, noteId.data),
    listNotes(supabase),
    listLinksOf(supabase, noteId.data),
  ]);

  // Row level security makes "not yours" and "does not exist" the same answer.
  if (!note) notFound();

  const connections = linksOf(note.id, links, notesIndex(notes));

  return (
    <>
      <PageHeader title={note.title} description={noteTypeLabel(note.note_type)} />

      {note.missions ? (
        <p className="text-sm text-muted-foreground">
          {copy.origin}
          {": "}
          <Link href={`/missions/${note.missions.id}`} className={linkClass}>
            {note.missions.title}
          </Link>
        </p>
      ) : null}

      <article data-testid="note-content" className="max-w-prose text-sm whitespace-pre-line">
        {note.content}
      </article>

      <details className="rounded-[--radius-base] border border-border p-4">
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
          {copy.edit}
        </summary>
        <div className="mt-4">
          <NoteForm note={note} />
        </div>
      </details>

      <NoteLinks
        noteId={note.id}
        outgoing={connections.outgoing}
        backlinks={connections.backlinks}
        candidates={otherNotes(notes, note.id)}
      />

      <Link href="/knowledge" className={`text-sm text-muted-foreground ${linkClass}`}>
        {copy.back}
      </Link>
    </>
  );
}
