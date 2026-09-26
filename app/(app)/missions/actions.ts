"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { OK, ruleState, toActionState, toUserMessage, type ActionState } from "@/lib/domain/errors";
import { activateMission, createMission } from "@/lib/domain/mission";
import { recordRuleBlock, recordRuleEvent } from "@/lib/domain/rule-event";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/hierarchy";
import { missionSchema, ruleForIssuePath } from "@/lib/validation/mission";

const MISSIONS = "/missions";
const DASHBOARD = "/dashboard";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("unauthenticated");
  return { supabase, user };
}

export async function createMissionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = missionSchema.safeParse({
    campaignId: formData.get("campaignId") ?? "",
    cycleId: formData.get("cycleId") ?? "",
    title: formData.get("title") ?? "",
    reason: formData.get("reason") ?? "",
    description: formData.get("description") ?? "",
    minLoadMinutes: formData.get("minLoadHours") ?? "",
    targetLoadMinutes: formData.get("targetLoadHours") ?? "",
    // Repeated inputs, one per row of the Definition of Done. Blank rows are
    // dropped by the schema rather than refused.
    criteria: formData.getAll("criteria").map(String),
  });

  const { supabase, user } = await requireUser();

  if (!parsed.success) {
    // A schema failure that mirrors a hard rule is still that rule blocking,
    // and is presented and recorded as one. Answering here rather than at the
    // database is a courtesy of latency, not a different kind of event.
    const ruleCode = parsed.error.issues
      .map((issue) => ruleForIssuePath(issue.path))
      .find((code) => code !== null);

    if (ruleCode) {
      await recordRuleEvent(supabase, user.id, ruleCode, { action: "mission.create" });
      return ruleState(ruleCode);
    }

    return { error: toUserMessage(null) };
  }

  const { data, error } = await createMission(supabase, user.id, parsed.data);

  if (error || !data) {
    await recordRuleBlock(supabase, user.id, error, { action: "mission.create" });
    return toActionState(error);
  }

  revalidatePath(MISSIONS);
  revalidatePath(DASHBOARD);

  // Outside any try/catch: redirect signals by throwing.
  redirect(`${MISSIONS}/${data.id}`);
}

/**
 * Activation.
 *
 * Nothing is checked before calling the RPC. RULE-001 is a unique index and
 * RULE-002 and RULE-005 are triggers; asking here first would be racy and would
 * put each rule in two places, one of which cannot see the rows it needs.
 *
 * When the database refuses, two things happen: the refusal is turned into an
 * explanation carrying the rule code, so the interface can say why the rule
 * exists and what to do instead, and the block is recorded in `rule_events`.
 * The record is what later lets the system say how often it held a line — the
 * only honest version of that figure, since RULE-004 makes an impulsive
 * abandonment unrecordable by construction.
 */
export async function activateMissionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: toUserMessage(null) };

  const { supabase, user } = await requireUser();
  const { error } = await activateMission(supabase, id.data);

  if (error) {
    await recordRuleBlock(supabase, user.id, error, {
      action: "mission.activate",
      mission_id: id.data,
    });
    return toActionState(error);
  }

  revalidatePath(MISSIONS);
  revalidatePath(`${MISSIONS}/${id.data}`);
  revalidatePath(DASHBOARD);
  return OK;
}
