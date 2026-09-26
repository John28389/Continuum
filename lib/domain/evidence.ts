import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";
import type { EvidenceInput } from "@/lib/validation/evidence";

export type MissionEvidence = Database["public"]["Tables"]["mission_evidence"]["Row"];

/**
 * Evidence keyed by the criterion it cites.
 *
 * A plain record rather than a Map, because it crosses from a server component
 * into the client-side completion panel, and props on that boundary have to be
 * serialisable.
 */
export type EvidenceIndex = Readonly<Record<string, MissionEvidence[]>>;

type Client = SupabaseClient<Database>;

/** A mission's evidence, oldest first: the order in which the output came to exist. */
export async function listEvidence(
  supabase: Client,
  missionId: string,
): Promise<MissionEvidence[]> {
  const { data } = await supabase
    .from("mission_evidence")
    .select("*")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: true });

  return data ?? [];
}

/**
 * Records a piece of evidence.
 *
 * Nothing is checked first. Whether the mission is active is the evidence
 * trigger's question; whether a cited criterion belongs to this same mission is
 * answered by the composite foreign key on (criterion_id, mission_id). A lookup
 * here would be weaker than both and could drift from them.
 */
export async function addEvidence(supabase: Client, userId: string, input: EvidenceInput) {
  return supabase.from("mission_evidence").insert({
    user_id: userId,
    mission_id: input.missionId,
    criterion_id: input.criterionId,
    description: input.description,
    url: input.url,
  });
}

/** Evidence grouped under the criterion it cites, for rendering beside the Definition of Done. */
export function evidenceByCriterion(evidence: readonly MissionEvidence[]): EvidenceIndex {
  const grouped: Record<string, MissionEvidence[]> = {};
  for (const item of evidence) {
    if (!item.criterion_id) continue;
    (grouped[item.criterion_id] ??= []).push(item);
  }
  return grouped;
}
