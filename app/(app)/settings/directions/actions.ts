"use server";

import { revalidatePath } from "next/cache";

import { archiveDirection, createDirection, updateDirection } from "@/lib/domain/direction";
import { OK, toUserMessage, type ActionState } from "@/lib/domain/errors";
import { createClient } from "@/lib/supabase/server";
import { directionSchema, idSchema } from "@/lib/validation/hierarchy";

const PATH = "/settings/directions";

/**
 * Every write goes through a server action.
 *
 * No client component touches Supabase directly, so there is exactly one
 * audited path into the data and validation cannot drift into the browser
 * where it is advisory at best.
 */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("unauthenticated");
  return { supabase, user };
}

export async function createDirectionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = directionSchema.safeParse({
    title: formData.get("title") ?? "",
    statement: formData.get("statement") ?? "",
  });

  if (!parsed.success) return { error: toUserMessage(null) };

  const { supabase, user } = await requireUser();
  const { error } = await createDirection(supabase, user.id, parsed.data);

  if (error) return { error: toUserMessage(error) };

  revalidatePath(PATH);
  return OK;
}

export async function updateDirectionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  const parsed = directionSchema.safeParse({
    title: formData.get("title") ?? "",
    statement: formData.get("statement") ?? "",
  });

  if (!id.success || !parsed.success) return { error: toUserMessage(null) };

  const { supabase } = await requireUser();
  // Row level security scopes the update to the owner; no ownership check here.
  const { error } = await updateDirection(supabase, id.data, parsed.data);

  if (error) return { error: toUserMessage(error) };

  revalidatePath(PATH);
  return OK;
}

export async function archiveDirectionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: toUserMessage(null) };

  const { supabase } = await requireUser();
  const { error } = await archiveDirection(supabase, id.data);

  if (error) return { error: toUserMessage(error) };

  revalidatePath(PATH);
  return OK;
}
