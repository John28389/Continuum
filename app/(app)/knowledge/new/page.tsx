import type { Metadata } from "next";
import Link from "next/link";

import { NoteForm } from "@/components/knowledge/note-form";
import { PageHeader } from "@/components/shell/page-header";
import { getMission } from "@/lib/domain/mission";
import { ptBR } from "@/lib/i18n/pt-BR";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/hierarchy";
import { NOTE_TYPES, type NoteType } from "@/lib/validation/knowledge";

export const metadata: Metadata = { title: ptBR.knowledge.newNote };

const copy = ptBR.knowledge;

const linkClass =
  "underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function asNoteType(value: string | string[] | undefined): NoteType {
  return NOTE_TYPES.find((type) => type === value) ?? "concept";
}

/**
 * A new note — optionally from a mission, which it then carries as its origin.
 *
 * The mission arrives in the URL and is looked up rather than trusted: an id
 * this user cannot see is simply ignored, and the database's composite foreign
 * key would refuse it anyway. A `type` in the URL only preselects the field —
 * the dashboard's "record a discovery" shortcut — and anything unknown falls
 * back to the usual default.
 */
export default async function NewNotePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const missionId = idSchema.safeParse(params.mission);

  const supabase = await createClient();
  const mission = missionId.success ? await getMission(supabase, missionId.data) : null;

  return (
    <>
      <PageHeader title={copy.newNote} description={copy.newDescription} />

      {mission ? (
        <p className="text-sm text-muted-foreground">
          {copy.origin}
          {": "}
          <Link href={`/missions/${mission.id}`} className={linkClass}>
            {mission.title}
          </Link>
        </p>
      ) : null}

      <NoteForm missionId={mission?.id ?? null} initialType={asNoteType(params.type)} />

      <Link href="/knowledge" className={`text-sm text-muted-foreground ${linkClass}`}>
        {copy.back}
      </Link>
    </>
  );
}
