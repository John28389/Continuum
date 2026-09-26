import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";
import { ptBR } from "@/lib/i18n/pt-BR";
import type { ManualSessionInput, StopSessionInput } from "@/lib/validation/session";

export type MissionSession = Database["public"]["Tables"]["mission_sessions"]["Row"];

type Client = SupabaseClient<Database>;

// ===========================================================================
// Load progress — pure
// ===========================================================================

/**
 * Where the logged hours stand against the two loads.
 *
 * Three stages, never a percentage. A single number would have to be a ratio
 * against the target, and a ratio against the target is precisely the "more
 * hours is better" reading the product refuses (RULE-102).
 *
 * Note what is absent: there is no distance to the target and no figure for
 * hours beyond it. The minimum is the safe floor, and knowing how far away it is
 * is useful. The target is an ambition, and a countdown towards it — or a
 * surplus past it — would turn an input metric into a score.
 */
export const LOAD_STAGES = ["below_minimum", "minimum_reached", "target_reached"] as const;
export type LoadStage = (typeof LOAD_STAGES)[number];

export interface LoadProgress {
  readonly loggedMinutes: number;
  readonly minimumMinutes: number;
  readonly targetMinutes: number;
  /** Zero once the floor is reached. Never negative. */
  readonly minutesToMinimum: number;
  readonly stage: LoadStage;
}

export function loadProgress(
  loggedMinutes: number,
  loads: { min_load_minutes: number; target_load_minutes: number },
): LoadProgress {
  const logged = Math.max(0, loggedMinutes);

  const stage: LoadStage =
    logged >= loads.target_load_minutes
      ? "target_reached"
      : logged >= loads.min_load_minutes
        ? "minimum_reached"
        : "below_minimum";

  return {
    loggedMinutes: logged,
    minimumMinutes: loads.min_load_minutes,
    targetMinutes: loads.target_load_minutes,
    minutesToMinimum: Math.max(0, loads.min_load_minutes - logged),
    stage,
  };
}

/**
 * Minutes logged across finished sessions.
 *
 * A running session is excluded: its figure changes every second, and counting
 * it would make the total something you watch rather than something you read.
 *
 * Durations are differences between absolute instants, so no timezone can bend
 * them. Milliseconds are summed first and rounded once, so twenty short
 * sessions do not accumulate twenty rounding errors.
 */
export function loggedMinutes(
  sessions: readonly Pick<MissionSession, "started_at" | "ended_at">[],
): number {
  const milliseconds = sessions.reduce((total, session) => {
    if (!session.ended_at) return total;
    return total + (Date.parse(session.ended_at) - Date.parse(session.started_at));
  }, 0);

  return Math.round(milliseconds / 60_000);
}

/** A duration as a person reads it: 95 is "1h 35min", 45 is "45min", 120 is "2h". */
export function formatDuration(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;

  if (hours === 0) return `${rest}${ptBR.session.minutesShort}`;
  if (rest === 0) return `${hours}${ptBR.mission.hoursShort}`;
  return `${hours}${ptBR.mission.hoursShort} ${rest}${ptBR.session.minutesShort}`;
}

// ===========================================================================
// Reads and writes
// ===========================================================================

/** Every session of a mission, newest first. */
export async function listSessions(supabase: Client, missionId: string): Promise<MissionSession[]> {
  const { data } = await supabase
    .from("mission_sessions")
    .select("*")
    .eq("mission_id", missionId)
    .order("started_at", { ascending: false });

  return data ?? [];
}

/**
 * The session in progress, if any.
 *
 * Per user, not per mission: a person is in at most one session at a time, and
 * the overlap guard in the database is what makes `maybeSingle` honest here.
 */
export async function getRunningSession(supabase: Client): Promise<MissionSession | null> {
  const { data } = await supabase
    .from("mission_sessions")
    .select("*")
    .is("ended_at", null)
    .maybeSingle();

  return data ?? null;
}

/**
 * Starts the timer.
 *
 * No start time is sent: the column defaults to the database's now(), and
 * `stop_mission_session()` stamps the end from the same clock. An application
 * server whose clock drifts by a few seconds can therefore never produce a
 * negative or inflated duration.
 *
 * Nothing is checked first. Whether the mission is active and whether a session
 * is already running are answered by the trigger, which can see both
 * consistently; a read here would be racy and weaker.
 */
export async function startSession(supabase: Client, userId: string, missionId: string) {
  return supabase.from("mission_sessions").insert({
    user_id: userId,
    mission_id: missionId,
    source: "timer",
  });
}

export async function stopSession(supabase: Client, input: StopSessionInput) {
  return supabase.rpc("stop_mission_session", {
    p_session_id: input.sessionId,
    p_note: input.note ?? undefined,
  });
}

/**
 * Throws away a running session.
 *
 * The correction for a forgotten timer. Only a session still running can be
 * discarded this way — a finished one is part of what was recorded.
 */
export async function discardSession(supabase: Client, sessionId: string) {
  return supabase.from("mission_sessions").delete().eq("id", sessionId).is("ended_at", null);
}

/** A session remembered rather than timed. The end is derived, not typed. */
export async function logSession(supabase: Client, userId: string, input: ManualSessionInput) {
  const started = new Date(input.startedAt);
  const ended = new Date(started.getTime() + input.durationMinutes * 60_000);

  return supabase.from("mission_sessions").insert({
    user_id: userId,
    mission_id: input.missionId,
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    note: input.note,
    source: "manual",
  });
}
