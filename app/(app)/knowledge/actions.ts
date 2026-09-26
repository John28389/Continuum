"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { OK, toUserMessage, type ActionState } from "@/lib/domain/errors";
import { addLink, createNote, removeLink, updateNote } from "@/lib/domain/knowledge";
import { ptBR } from "@/lib/i18n/pt-BR";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/hierarchy";
import { linkSchema, noteSchema, noteUpdateSchema } from "@/lib/validation/knowledge";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("unauthenticated");
  return { supabase, user };
}

/** Title and content each have a specific, fixable answer. */
function noteFieldMessage(path: readonly PropertyKey[] | undefined): string {
  const field = String(path?.[0] ?? "");
  if (field === "title") return ptBR.knowledge.titleRequired;
  if (field === "content") return ptBR.knowledge.contentRequired;
  return toUserMessage(null);
}

function readNote(formData: FormData) {
  return {
    title: formData.get("title") ?? "",
    content: formData.get("content") ?? "",
    noteType: formData.get("noteType") ?? "",
  };
}

/** Creates a note and opens it. From a mission, the note carries that origin. */
export async function createNoteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = noteSchema.safeParse({
    ...readNote(formData),
    missionId: formData.get("missionId") ?? "",
  });
  if (!parsed.success) return { error: noteFieldMessage(parsed.error.issues[0]?.path) };

  const { supabase, user } = await requireUser();
  const { data, error } = await createNote(supabase, user.id, parsed.data);

  if (error || !data) return { error: toUserMessage(error) };

  revalidatePath("/knowledge");
  if (parsed.data.missionId) revalidatePath(`/missions/${parsed.data.missionId}`);

  // Outside any try/catch: redirect signals by throwing.
  redirect(`/knowledge/${data.id}`);
}

export async function updateNoteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = noteUpdateSchema.safeParse({
    ...readNote(formData),
    noteId: formData.get("noteId") ?? "",
  });
  if (!parsed.success) return { error: noteFieldMessage(parsed.error.issues[0]?.path) };

  const { supabase } = await requireUser();
  const { error } = await updateNote(supabase, parsed.data);

  if (error) return { error: toUserMessage(error) };

  revalidatePath("/knowledge");
  revalidatePath(`/knowledge/${parsed.data.noteId}`);
  return OK;
}

/** Links two notes. The link is stored once and shows on both. */
export async function addLinkAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = linkSchema.safeParse({
    fromNoteId: formData.get("fromNoteId") ?? "",
    toNoteId: formData.get("toNoteId") ?? "",
    relation: formData.get("relation") ?? "",
  });

  if (!parsed.success) {
    const self = parsed.error.issues.some((issue) => issue.message === "self");
    return { error: self ? ptBR.knowledge.selfLink : toUserMessage(null) };
  }

  const { supabase, user } = await requireUser();
  const { error } = await addLink(supabase, user.id, parsed.data);

  if (error) return { error: toUserMessage(error) };

  revalidatePath(`/knowledge/${parsed.data.fromNoteId}`);
  revalidatePath(`/knowledge/${parsed.data.toNoteId}`);
  return OK;
}

export async function removeLinkAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const linkId = idSchema.safeParse(formData.get("linkId"));
  if (!linkId.success) return { error: toUserMessage(null) };

  const { supabase } = await requireUser();
  const { error } = await removeLink(supabase, linkId.data);

  if (error) return { error: toUserMessage(error) };

  // Both ends show the link, so both are redrawn.
  for (const field of ["noteId", "otherNoteId"]) {
    const noteId = idSchema.safeParse(formData.get(field));
    if (noteId.success) revalidatePath(`/knowledge/${noteId.data}`);
  }
  return OK;
}
