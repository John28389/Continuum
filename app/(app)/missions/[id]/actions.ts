"use server";

import { revalidatePath } from "next/cache";

import { OK, toActionState, toUserMessage, type ActionState } from "@/lib/domain/errors";
import { completeMission, reviewMission, setCriterionSatisfied } from "@/lib/domain/mission";
import { recordRuleBlock } from "@/lib/domain/rule-event";
import { ptBR } from "@/lib/i18n/pt-BR";
import { createClient } from "@/lib/supabase/server";
import { criterionSatisfactionSchema } from "@/lib/validation/evidence";
import { idSchema } from "@/lib/validation/hierarchy";
import { reviewSchema } from "@/lib/validation/review";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("unauthenticated");
  return { supabase, user };
}

/** The mission shows on its own page, in the list, and on the dashboard. */
function revalidate(missionId: string) {
  revalidatePath(`/missions/${missionId}`);
  revalidatePath("/missions");
  revalidatePath("/dashboard");
}

/**
 * Marks a criterion satisfied, or open again.
 *
 * Refused by the database once the mission is finished (RULE-006) or while it
 * is still a draft. Either way the page is redrawn, so what it shows is what
 * is true.
 */
export async function setCriterionSatisfiedAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = criterionSatisfactionSchema.safeParse({
    criterionId: formData.get("criterionId") ?? "",
    missionId: formData.get("missionId") ?? "",
    satisfied: formData.get("satisfied") ?? "",
  });
  if (!parsed.success) return { error: toUserMessage(null) };

  const { supabase, user } = await requireUser();
  const { error } = await setCriterionSatisfied(
    supabase,
    parsed.data.criterionId,
    parsed.data.satisfied,
  );

  revalidate(parsed.data.missionId);

  if (error) {
    await recordRuleBlock(supabase, user.id, error, {
      action: "criterion.satisfy",
      mission_id: parsed.data.missionId,
    });
    return toActionState(error);
  }

  return OK;
}

/**
 * Completion.
 *
 * Nothing is checked here. RULE-008 is a trigger that sees every criterion
 * consistently, and the interface only offers this when its mirror of that rule
 * says yes — so a refusal here means the criteria changed after the page was
 * drawn. The block is recorded, and the page redrawn so the panel names the
 * criterion that is open now beside the explanation.
 */
export async function completeMissionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const missionId = idSchema.safeParse(formData.get("missionId"));
  if (!missionId.success) return { error: toUserMessage(null) };

  const { supabase, user } = await requireUser();
  const { error } = await completeMission(supabase, missionId.data);

  revalidate(missionId.data);

  if (error) {
    await recordRuleBlock(supabase, user.id, error, {
      action: "mission.complete",
      mission_id: missionId.data,
    });
    return toActionState(error);
  }

  return OK;
}

/** A review can succeed without the page changing, so it says that it did. */
export interface ReviewState extends ActionState {
  readonly recorded?: boolean;
}

/**
 * A review of the active mission (RULE-004).
 *
 * The schema answers first, field by field, because each has a specific and
 * fixable answer. Then `review_mission()` records the justification and applies
 * the outcome in one transaction; a refusal there is recorded as a rule event
 * and explained like any other.
 *
 * Revising or ending the mission changes the page itself, which is its own
 * confirmation. Keeping it does not, so that case reports back explicitly.
 */
export async function reviewMissionAction(
  _previous: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const parsed = reviewSchema.safeParse({
    missionId: formData.get("missionId") ?? "",
    outcome: formData.get("outcome") ?? "",
    reasonCategory: formData.get("reasonCategory") ?? "",
    justification: formData.get("justification") ?? "",
  });

  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    if (field === "outcome") return { error: ptBR.review.outcomeRequired };
    if (field === "reasonCategory") return { error: ptBR.review.categoryRequired };
    if (field === "justification") return { error: ptBR.review.justificationShort };
    return { error: toUserMessage(null) };
  }

  const { supabase, user } = await requireUser();
  const { error } = await reviewMission(supabase, parsed.data);

  revalidate(parsed.data.missionId);

  if (error) {
    await recordRuleBlock(supabase, user.id, error, {
      action: "mission.review",
      mission_id: parsed.data.missionId,
    });
    return toActionState(error);
  }

  return { recorded: true };
}
