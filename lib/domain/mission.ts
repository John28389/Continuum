import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";
import type { MissionStatus } from "@/lib/rules/transitions";
import type { MissionInput } from "@/lib/validation/mission";

export type Mission = Database["public"]["Tables"]["missions"]["Row"];
export type DodCriterion = Database["public"]["Tables"]["mission_dod_criteria"]["Row"];

export type MissionWithCampaign = Mission & {
  campaigns: { id: string; name: string } | null;
  cycles: { id: string; label: string; status: string } | null;
};

export type MissionDetail = MissionWithCampaign & {
  mission_dod_criteria: DodCriterion[];
};

type Client = SupabaseClient<Database>;

const WITH_CONTEXT = "*, campaigns(id, name), cycles(id, label, status)";

/**
 * Every mission, newest first.
 *
 * No filtering by status: a mission that was revised or abandoned is part of
 * the record, and hiding it would make the history describe something other
 * than what happened. Ordering and grouping are the page's business.
 */
export async function listMissions(supabase: Client): Promise<MissionWithCampaign[]> {
  const { data } = await supabase
    .from("missions")
    .select(WITH_CONTEXT)
    .order("created_at", { ascending: false });

  return (data as MissionWithCampaign[] | null) ?? [];
}

export type ActiveMission = MissionWithCampaign & {
  mission_dod_criteria: Pick<DodCriterion, "id" | "satisfied_at">[];
};

/**
 * The one active mission, or none, with its criteria.
 *
 * The criteria come along so the dashboard can lead with output — how much of
 * the Definition of Done is satisfied — and put hours after it, where an input
 * metric belongs.
 *
 * `maybeSingle` is honest here rather than convenient: RULE-001 is a partial
 * unique index, so "more than one" is not a state the database can be in.
 */
export async function getActiveMission(supabase: Client): Promise<ActiveMission | null> {
  const { data } = await supabase
    .from("missions")
    .select(`${WITH_CONTEXT}, mission_dod_criteria(id, satisfied_at)`)
    .eq("status", "active")
    .maybeSingle();

  return (data as ActiveMission | null) ?? null;
}

export async function getMission(supabase: Client, id: string): Promise<MissionDetail | null> {
  const { data } = await supabase
    .from("missions")
    .select(`${WITH_CONTEXT}, mission_dod_criteria(*)`)
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const detail = data as MissionDetail;
  return {
    ...detail,
    mission_dod_criteria: [...detail.mission_dod_criteria].sort(
      (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
    ),
  };
}

/**
 * Creates a draft mission together with its Definition of Done.
 *
 * The status is not a parameter and never will be: a mission enters the world
 * as a draft and reaches `active` only through `activate_mission()`, where the
 * triggers can see the criteria and the active cycle.
 *
 * The criteria need the mission's id, so this is necessarily two statements. If
 * the second fails the first is undone by hand, because the alternative — a
 * draft with no Definition of Done — is a mission the user cannot activate and
 * has no obvious way to diagnose. Doing it in one transaction would mean a new
 * RPC, and the mission table is not the place to add write paths casually.
 */
export async function createMission(supabase: Client, userId: string, input: MissionInput) {
  const { data: mission, error } = await supabase
    .from("missions")
    .insert({
      user_id: userId,
      campaign_id: input.campaignId,
      cycle_id: input.cycleId,
      title: input.title,
      reason: input.reason,
      description: input.description,
      min_load_minutes: input.minLoadMinutes,
      target_load_minutes: input.targetLoadMinutes,
    })
    .select("id")
    .single();

  if (error || !mission) return { data: null, error };

  const { error: criteriaError } = await supabase.from("mission_dod_criteria").insert(
    input.criteria.map((description, index) => ({
      user_id: userId,
      mission_id: mission.id,
      description,
      position: index,
    })),
  );

  if (criteriaError) {
    await supabase.from("missions").delete().eq("id", mission.id);
    return { data: null, error: criteriaError };
  }

  return { data: mission, error: null };
}

/**
 * Activation, through the RPC.
 *
 * Nothing is checked here first. RULE-001 is a unique index, RULE-002 and
 * RULE-005 are triggers, and all three depend on rows this function cannot see
 * consistently — another mission's status, the criteria list, the active cycle.
 * A pre-check would be racy, and it would put the rule in two places, one of
 * which is weaker.
 */
export async function activateMission(supabase: Client, missionId: string) {
  return supabase.rpc("activate_mission", { p_mission_id: missionId });
}

/** Missions that could legitimately be activated next, for the interface to offer. */
export function isActivatable(status: MissionStatus): boolean {
  return status === "draft";
}

/**
 * Marks a criterion satisfied, or open again.
 *
 * Through an RPC so the timestamp comes from the database clock, like every
 * other instant in the record. Allowed only while the mission is active; after
 * that the Definition of Done is part of a finished record and is frozen by
 * trigger (RULE-006).
 */
export async function setCriterionSatisfied(
  supabase: Client,
  criterionId: string,
  satisfied: boolean,
) {
  return supabase.rpc("set_criterion_satisfied", {
    p_criterion_id: criterionId,
    p_satisfied: satisfied,
  });
}

/**
 * Completion, through the RPC.
 *
 * Nothing is checked here. RULE-008 is a trigger that can see every criterion
 * consistently; the same trigger closes a session still running at this
 * moment. A pre-check here would be racy and would put the rule in two places.
 */
export async function completeMission(supabase: Client, missionId: string) {
  return supabase.rpc("complete_mission", { p_mission_id: missionId });
}

/**
 * The mission completed in this cycle, if there is one.
 *
 * What the dashboard shows once the work is done. Finishing early means the
 * person is free, so the dashboard's honest answer to "what am I doing now" is
 * that this is finished — not an empty state inviting them to start something.
 */
export async function getCompletedMissionInCycle(
  supabase: Client,
  cycleId: string,
): Promise<MissionWithCampaign | null> {
  const { data } = await supabase
    .from("missions")
    .select(WITH_CONTEXT)
    .eq("cycle_id", cycleId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as MissionWithCampaign | null) ?? null;
}

/**
 * A review of the active mission, through the RPC (RULE-004).
 *
 * `review_mission()` records the justification and applies the outcome in one
 * transaction, so a mission can never leave `active` with its reason lost; the
 * exit trigger refuses any other way out. Nothing is checked here first.
 *
 * Typed structurally rather than against the review schema, so this domain file
 * keeps depending on the database types and nothing above them.
 */
export async function reviewMission(
  supabase: Client,
  input: { missionId: string; reasonCategory: string; justification: string; outcome: string },
) {
  return supabase.rpc("review_mission", {
    p_mission_id: input.missionId,
    p_reason_category: input.reasonCategory,
    p_justification: input.justification,
    p_outcome: input.outcome,
  });
}
