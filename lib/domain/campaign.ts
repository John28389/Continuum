import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";
import type { CampaignInput } from "@/lib/validation/hierarchy";

export type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
export type CampaignWithDirection = Campaign & {
  directions: { id: string; title: string } | null;
};

type Client = SupabaseClient<Database>;

export async function listCampaigns(supabase: Client): Promise<CampaignWithDirection[]> {
  const { data } = await supabase
    .from("campaigns")
    .select("*, directions(id, title)")
    .order("starts_on", { ascending: false });

  return (data as CampaignWithDirection[] | null) ?? [];
}

/**
 * A campaign carries user_id as well as direction_id.
 *
 * The pair is checked by a composite foreign key against the direction's
 * (id, user_id), so attaching a campaign to someone else's direction is refused
 * by the schema rather than by a lookup here that could be forgotten.
 */
export async function createCampaign(supabase: Client, userId: string, input: CampaignInput) {
  return supabase.from("campaigns").insert({
    user_id: userId,
    direction_id: input.directionId,
    name: input.name,
    objective: input.objective,
    description: input.description,
    success_criteria: input.successCriteria,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
  });
}

export async function updateCampaign(supabase: Client, id: string, input: CampaignInput) {
  return supabase
    .from("campaigns")
    .update({
      direction_id: input.directionId,
      name: input.name,
      objective: input.objective,
      description: input.description,
      success_criteria: input.successCriteria,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
    })
    .eq("id", id);
}

export async function archiveCampaign(supabase: Client, id: string) {
  return supabase.from("campaigns").update({ status: "archived" }).eq("id", id);
}
