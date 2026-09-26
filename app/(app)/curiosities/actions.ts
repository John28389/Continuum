"use server";

import { revalidatePath } from "next/cache";

import { captureCuriosity, promoteCuriosity, setCuriosityState } from "@/lib/domain/curiosity";
import { OK, ruleState, toActionState, toUserMessage, type ActionState } from "@/lib/domain/errors";
import { recordRuleBlock } from "@/lib/domain/rule-event";
import { createClient } from "@/lib/supabase/server";
import { captureSchema, curiosityStateSchema, promoteSchema } from "@/lib/validation/curiosity";

const CURIOSITIES = "/curiosities";
const DASHBOARD = "/dashboard";
const MISSIONS = "/missions";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("unauthenticated");
  return { supabase, user };
}

/** Capture is one field. Reachable from anywhere, so the refusal path stays this short too. */
export async function captureCuriosityAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = captureSchema.safeParse({ title: formData.get("title") ?? "" });
  if (!parsed.success) return { error: toUserMessage(null) };

  const { supabase, user } = await requireUser();
  const { error } = await captureCuriosity(supabase, user.id, parsed.data);
  if (error) return { error: toUserMessage(error) };

  revalidatePath(CURIOSITIES);
  revalidatePath(DASHBOARD);
  return OK;
}

export async function setCuriosityStateAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = curiosityStateSchema.safeParse({
    curiosityId: formData.get("curiosityId") ?? "",
    state: formData.get("state") ?? "",
  });
  if (!parsed.success) return { error: toUserMessage(null) };

  const { supabase } = await requireUser();
  const { error } = await setCuriosityState(supabase, parsed.data.curiosityId, parsed.data.state);
  if (error) return { error: toUserMessage(error) };

  revalidatePath(CURIOSITIES);
  revalidatePath(DASHBOARD);
  return OK;
}

/**
 * Promotion (RULE-007).
 *
 * A bad load pair is answered as RULE-003 before the round trip: it is the
 * same load-coherence invariant `missions_load_coherent` enforces on the row
 * this produces, reached by a different door.
 */
export async function promoteCuriosityAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = promoteSchema.safeParse({
    curiosityId: formData.get("curiosityId") ?? "",
    campaignId: formData.get("campaignId") ?? "",
    title: formData.get("title") ?? "",
    reason: formData.get("reason") ?? "",
    minLoadMinutes: formData.get("minLoadHours") ?? "",
    targetLoadMinutes: formData.get("targetLoadHours") ?? "",
  });

  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    if (field === "minLoadMinutes" || field === "targetLoadMinutes") return ruleState("RULE-003");
    return { error: toUserMessage(null) };
  }

  const { supabase, user } = await requireUser();
  const { error } = await promoteCuriosity(supabase, parsed.data);

  if (error) {
    await recordRuleBlock(supabase, user.id, error, {
      action: "curiosity.promote",
      curiosity_id: parsed.data.curiosityId,
    });
    return toActionState(error);
  }

  revalidatePath(CURIOSITIES);
  revalidatePath(MISSIONS);
  revalidatePath(DASHBOARD);
  return OK;
}
