import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";
import type { LinkInput, NoteInput, NoteUpdateInput } from "@/lib/validation/knowledge";

export type KnowledgeNote = Database["public"]["Tables"]["knowledge_notes"]["Row"];
export type KnowledgeLink = Database["public"]["Tables"]["knowledge_links"]["Row"];
export type NoteDetail = KnowledgeNote & { missions: { id: string; title: string } | null };
export type NoteRef = Pick<KnowledgeNote, "id" | "title" | "note_type">;
/** A note as its mission lists it. When it was written is part of the mission's trail. */
export type MissionNoteRef = NoteRef & Pick<KnowledgeNote, "created_at">;

type Client = SupabaseClient<Database>;

// ===========================================================================
// Search — pure
// ===========================================================================

export interface NoteSearch {
  readonly query?: string;
  readonly type?: string | null;
}

/** Lowercase and strip accents, so "relatório" and "relatorio" find each other. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Search over title and content, filtered by type, newest first.
 *
 * In memory, deliberately. This is one person's notes, and doing it here means
 * no user text is ever spliced into a PostgREST filter expression, where a comma
 * or a parenthesis would change what the query means. A full-text index would
 * be the scalable version, and a migration; revisit if the notes outgrow a page.
 *
 * Every word must match, anywhere in the title or content.
 */
export function searchNotes<
  T extends Pick<KnowledgeNote, "title" | "content" | "note_type" | "updated_at">,
>(notes: readonly T[], search: NoteSearch = {}): T[] {
  const terms = normalise(search.query ?? "")
    .split(/\s+/)
    .filter(Boolean);

  return notes
    .filter((note) => !search.type || note.note_type === search.type)
    .filter((note) => {
      const haystack = normalise(`${note.title}\n${note.content}`);
      return terms.every((term) => haystack.includes(term));
    })
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}

/** The first lines of a note, flattened, for the list. */
export function excerpt(content: string, length = 160): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length <= length ? flat : `${flat.slice(0, length - 1).trimEnd()}…`;
}

// ===========================================================================
// Links and backlinks — pure
// ===========================================================================

export interface LinkedNote {
  readonly linkId: string;
  readonly relation: string;
  readonly note: NoteRef;
}

export interface NoteLinks {
  /** Links this note makes to others. */
  readonly outgoing: LinkedNote[];
  /** Links other notes make to this one. */
  readonly backlinks: LinkedNote[];
}

/**
 * A link is stored once, from one note to another, and read from both ends.
 * That is what "bidirectional with visible backlinks" means here: nobody has to
 * create the reverse link, and the two sides can never disagree.
 *
 * A link whose other note is not in `notesById` is left out rather than shown
 * as a dangling title.
 */
export function linksOf(
  noteId: string,
  links: readonly Pick<KnowledgeLink, "id" | "from_note_id" | "to_note_id" | "relation">[],
  notesById: ReadonlyMap<string, NoteRef>,
): NoteLinks {
  const outgoing: LinkedNote[] = [];
  const backlinks: LinkedNote[] = [];

  for (const link of links) {
    if (link.from_note_id === noteId) {
      const other = notesById.get(link.to_note_id);
      if (other) outgoing.push({ linkId: link.id, relation: link.relation, note: other });
    } else if (link.to_note_id === noteId) {
      const other = notesById.get(link.from_note_id);
      if (other) backlinks.push({ linkId: link.id, relation: link.relation, note: other });
    }
  }

  const byTitle = (a: LinkedNote, b: LinkedNote) =>
    a.note.title.localeCompare(b.note.title, "pt-BR");
  return { outgoing: outgoing.sort(byTitle), backlinks: backlinks.sort(byTitle) };
}

// ===========================================================================
// Reads and writes
// ===========================================================================

export async function listNotes(supabase: Client): Promise<KnowledgeNote[]> {
  const { data } = await supabase
    .from("knowledge_notes")
    .select("*")
    .order("updated_at", { ascending: false });

  return data ?? [];
}

export async function getNote(supabase: Client, id: string): Promise<NoteDetail | null> {
  const { data } = await supabase
    .from("knowledge_notes")
    .select("*, missions(id, title)")
    .eq("id", id)
    .maybeSingle();

  return (data as NoteDetail | null) ?? null;
}

/** Both directions, as two plain equality queries: no filter string is built from input. */
export async function listLinksOf(supabase: Client, noteId: string): Promise<KnowledgeLink[]> {
  const [from, to] = await Promise.all([
    supabase.from("knowledge_links").select("*").eq("from_note_id", noteId),
    supabase.from("knowledge_links").select("*").eq("to_note_id", noteId),
  ]);

  return [...(from.data ?? []), ...(to.data ?? [])];
}

/** The notes that came from a mission, oldest first: the order they were written in. */
export async function listNotesForMission(
  supabase: Client,
  missionId: string,
): Promise<MissionNoteRef[]> {
  const { data } = await supabase
    .from("knowledge_notes")
    .select("id, title, note_type, created_at")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: true });

  return data ?? [];
}

export async function createNote(supabase: Client, userId: string, input: NoteInput) {
  return supabase
    .from("knowledge_notes")
    .insert({
      user_id: userId,
      title: input.title,
      content: input.content,
      note_type: input.noteType,
      mission_id: input.missionId,
    })
    .select("id")
    .single();
}

/** The origin mission is not editable: it is where the note came from. */
export async function updateNote(supabase: Client, input: NoteUpdateInput) {
  return supabase
    .from("knowledge_notes")
    .update({ title: input.title, content: input.content, note_type: input.noteType })
    .eq("id", input.noteId);
}

/**
 * Links a note to another.
 *
 * The composite foreign keys on (note, user_id) refuse a link to someone else's
 * note, the check constraint refuses a self-link, and the unique triple refuses
 * a duplicate; nothing is looked up here first.
 */
export async function addLink(supabase: Client, userId: string, input: LinkInput) {
  return supabase.from("knowledge_links").insert({
    user_id: userId,
    from_note_id: input.fromNoteId,
    to_note_id: input.toNoteId,
    relation: input.relation,
  });
}

export async function removeLink(supabase: Client, linkId: string) {
  return supabase.from("knowledge_links").delete().eq("id", linkId);
}
