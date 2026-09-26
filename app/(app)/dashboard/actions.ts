"use server";

import { revalidatePath } from "next/cache";

import { closeCycle, openCycle } from "@/lib/domain/cycle";
import { OK, toUserMessage, type ActionState } from "@/lib/domain/errors";
import { createClient } from "@/lib/supabase/server";
import { cycleSchema, idSchema } from "@/lib/validation/hierarchy";

const PATH = "/dashboard";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("unauthenticated");
  return { supabase, user };
}

/**
 * Opens a cycle.
 *
 * No pre-check for an existing active cycle: the partial unique index answers
 * that atomically, and the refusal is translated below. Checking first would be
 * racy and would put the rule in two places, one of which is weaker.
 */
export async function openCycleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = cycleSchema.safeParse({
    label: formData.get("label") ?? "",
    startsOn: formData.get("startsOn") ?? "",
    endsOn: formData.get("endsOn") ?? "",
  });

  if (!parsed.success) return { error: toUserMessage(null) };

  const { supabase, user } = await requireUser();
  const { error } = await openCycle(supabase, user.id, parsed.data);

  if (error) return { error: toUserMessage(error) };

  revalidatePath(PATH);
  return OK;
}

export async function closeCycleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: toUserMessage(null) };

  const { supabase } = await requireUser();
  const { error } = await closeCycle(supabase, id.data);

  if (error) return { error: toUserMessage(error) };

  revalidatePath(PATH);
  return OK;
}
