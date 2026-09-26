"use server";

import { revalidatePath } from "next/cache";

import { OK, toUserMessage, type ActionState } from "@/lib/domain/errors";
import { discardSession, logSession, startSession, stopSession } from "@/lib/domain/session";
import { ptBR } from "@/lib/i18n/pt-BR";
import { recogniseError } from "@/lib/rules/errors";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/hierarchy";
import { manualSessionSchema, stopSessionSchema } from "@/lib/validation/session";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("unauthenticated");
  return { supabase, user };
}

/** The timer shows on the dashboard as well as on the mission's own pages. */
function revalidate(missionId: string | null) {
  revalidatePath("/dashboard");
  if (missionId) {
    revalidatePath(`/missions/${missionId}`);
    revalidatePath(`/missions/${missionId}/sessions`);
  }
}

function missionIdFrom(formData: FormData): string | null {
  const parsed = idSchema.safeParse(formData.get("missionId"));
  return parsed.success ? parsed.data : null;
}

/**
 * Starts the timer.
 *
 * Whether the mission is active and whether a session is already running are
 * the database's questions, answered by the session trigger. The one thing
 * done here is to phrase an overlap correctly: when *starting*, the only thing
 * a new open-ended session can collide with is one already running, and "this
 * period overlaps another session" would be a true sentence that explains
 * nothing.
 */
export async function startSessionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const missionId = missionIdFrom(formData);
  if (!missionId) return { error: toUserMessage(null) };

  const { supabase, user } = await requireUser();
  const { error } = await startSession(supabase, user.id, missionId);

  if (error) {
    const recognised = recogniseError(error);
    if (
      recognised?.kind === "constraint_violation" &&
      (recognised.constraint === "mission_sessions_no_overlap" ||
        recognised.constraint === "mission_sessions_one_running_per_user")
    ) {
      return { error: ptBR.session.alreadyRunning };
    }
    return { error: toUserMessage(error) };
  }

  revalidate(missionId);
  return OK;
}

export async function stopSessionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = stopSessionSchema.safeParse({
    sessionId: formData.get("sessionId") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { error: toUserMessage(null) };

  const { supabase } = await requireUser();
  const { error } = await stopSession(supabase, parsed.data);

  if (error) return { error: toUserMessage(error) };

  revalidate(missionIdFrom(formData));
  return OK;
}

/** The correction for a forgotten timer. Finished sessions are not offered. */
export async function discardSessionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessionId = idSchema.safeParse(formData.get("sessionId"));
  if (!sessionId.success) return { error: toUserMessage(null) };

  const { supabase } = await requireUser();
  const { error } = await discardSession(supabase, sessionId.data);

  if (error) return { error: toUserMessage(error) };

  revalidate(missionIdFrom(formData));
  return OK;
}

export async function logSessionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = manualSessionSchema.safeParse({
    missionId: formData.get("missionId") ?? "",
    startedAt: formData.get("startedAt") ?? "",
    durationMinutes: formData.get("durationHours") ?? "",
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    // Say which field, since both have a specific and fixable answer.
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    if (field === "durationMinutes") return { error: ptBR.session.durationInvalid };
    if (field === "startedAt") return { error: ptBR.session.startInvalid };
    return { error: toUserMessage(null) };
  }

  const { supabase, user } = await requireUser();
  const { error } = await logSession(supabase, user.id, parsed.data);

  if (error) return { error: toUserMessage(error) };

  revalidate(parsed.data.missionId);
  return OK;
}
