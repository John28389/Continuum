import type { Metadata } from "next";
import Link from "next/link";

import { NoteList } from "@/components/knowledge/note-list";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button, controlClass } from "@/components/ui/form";
import { listNotes, searchNotes } from "@/lib/domain/knowledge";
import { ptBR } from "@/lib/i18n/pt-BR";
import { createClient } from "@/lib/supabase/server";
import { NOTE_TYPES, type NoteType } from "@/lib/validation/knowledge";

export const metadata: Metadata = { title: ptBR.pages.knowledge.title };

const copy = ptBR.knowledge;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** A single string, or nothing: a repeated parameter is not a search. */
function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function asNoteType(value: string): NoteType | null {
  return NOTE_TYPES.find((type) => type === value) ?? null;
}

/**
 * The notes, with search.
 *
 * A plain GET form, so searching works before hydration and the URL can be kept.
 * When there are no notes at all the page says so and nothing more: an empty
 * note list is not a problem to be solved, and nothing here asks for a note.
 */
export default async function KnowledgePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = single(params.q);
  const noteType = asNoteType(single(params.type));

  const supabase = await createClient();
  const notes = await listNotes(supabase);
  const found = searchNotes(notes, { query, type: noteType });
  const hasNotes = notes.length !== 0;
  const nothingFound = hasNotes && found.length === 0;

  return (
    <>
      <PageHeader
        title={ptBR.pages.knowledge.title}
        description={ptBR.pages.knowledge.description}
        action={
          <Link
            href="/knowledge/new"
            className="rounded-[--radius-base] border border-border-strong px-4 py-2 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {copy.newNote}
          </Link>
        }
      />

      {hasNotes ? null : <EmptyState title={copy.none} body={copy.noneBody} />}

      {hasNotes ? (
        <form method="get" role="search" className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <label htmlFor="knowledge-q" className="text-sm font-medium">
              {copy.searchLabel}
            </label>
            <input
              id="knowledge-q"
              name="q"
              type="search"
              defaultValue={query}
              className={controlClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="knowledge-type" className="text-sm font-medium">
              {copy.type}
            </label>
            <select
              id="knowledge-type"
              name="type"
              defaultValue={noteType ?? ""}
              className={controlClass}
            >
              <option value="">{copy.allTypes}</option>
              {NOTE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {copy.types[type]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="quiet">
            {copy.search}
          </Button>
        </form>
      ) : null}

      {nothingFound ? <EmptyState title={copy.noMatch} /> : null}
      {found.length !== 0 ? <NoteList notes={found} /> : null}
    </>
  );
}
