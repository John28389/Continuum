"use server";

import { revalidatePath } from "next/cache";

import { archiveCampaign, createCampaign, updateCampaign } from "@/lib/domain/campaign";
import { OK, toUserMessage, type ActionState } from "@/lib/domain/errors";
import { createClient } from "@/lib/supabase/server";
import { campaignSchema, idSchema } from "@/lib/validation/hierarchy";

const PATH = "/settings/campaigns";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("unauthenticated");
  return { supabase, user };
}

function read(formData: FormData) {
  return campaignSchema.safeParse({
    directionId: formData.get("directionId") ?? "",
    name: formData.get("name") ?? "",
    objective: formData.get("objective") ?? "",
    description: formData.get("description") ?? "",
    successCriteria: formData.get("successCriteria") ?? "",
    startsOn: formData.get("startsOn") ?? "",
    endsOn: formData.get("endsOn") ?? "",
  });
}

export async function createCampaignAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = read(formData);
  if (!parsed.success) return { error: toUserMessage(null) };

  const { supabase, user } = await requireUser();
  const { error } = await createCampaign(supabase, user.id, parsed.data);

  if (error) return { error: toUserMessage(error) };

  revalidatePath(PATH);
  return OK;
}

export async function updateCampaignAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  const parsed = read(formData);
  if (!id.success || !parsed.success) return { error: toUserMessage(null) };

  const { supabase } = await requireUser();
  const { error } = await updateCampaign(supabase, id.data, parsed.data);

  if (error) return { error: toUserMessage(error) };

  revalidatePath(PATH);
  return OK;
}

export async function archiveCampaignAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: toUserMessage(null) };

  const { supabase } = await requireUser();
  const { error } = await archiveCampaign(supabase, id.data);

  if (error) return { error: toUserMessage(error) };

  revalidatePath(PATH);
  return OK;
}
