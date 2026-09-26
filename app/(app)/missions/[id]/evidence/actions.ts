"use server";

import { revalidatePath } from "next/cache";

import { OK, toActionState, toUserMessage, type ActionState } from "@/lib/domain/errors";
import { addEvidence } from "@/lib/domain/evidence";
import { recordRuleBlock } from "@/lib/domain/rule-event";
import { ptBR } from "@/lib/i18n/pt-BR";
import { createClient } from "@/lib/supabase/server";
import { evidenceSchema } from "@/lib/validation/evidence";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("unauthenticated");
  return { supabase, user };
}

export async function addEvidenceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = evidenceSchema.safeParse({
    missionId: formData.get("missionId") ?? "",
    description: formData.get("description") ?? "",
    url: formData.get("url") ?? "",
    criterionId: formData.get("criterionId") ?? "",
  });

  if (!parsed.success) {
    // Both fields a person types have a specific, fixable answer.
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    if (field === "url") return { error: ptBR.evidence.urlInvalid };
    if (field === "description") return { error: ptBR.evidence.descriptionRequired };
    return { error: toUserMessage(null) };
  }

  const { supabase, user } = await requireUser();
  const { error } = await addEvidence(supabase, user.id, parsed.data);

  if (error) {
    // Only a refusal by a named rule — RULE-006, for a finished mission — is
    // recorded; recordRuleBlock ignores the structural constraints.
    await recordRuleBlock(supabase, user.id, error, {
      action: "evidence.add",
      mission_id: parsed.data.missionId,
    });
    return toActionState(error);
  }

  revalidatePath(`/missions/${parsed.data.missionId}/evidence`);
  revalidatePath(`/missions/${parsed.data.missionId}`);
  return OK;
}
