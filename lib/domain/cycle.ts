import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/types";

export type Cycle = Database["public"]["Tables"]["cycles"]["Row"];

type Client = SupabaseClient<Database>;

export interface CycleProgress {
  readonly totalDays: number;
  readonly elapsedDays: number;
  readonly remainingDays: number;
  /** Share of the cycle's calendar that has passed, 0–1. */
  readonly elapsedFraction: number;
  readonly hasEnded: boolean;
}

/** Midnight UTC for a YYYY-MM-DD string, so arithmetic is not shifted by a timezone. */
function toUtcDay(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

const DAY_MS = 86_400_000;

/**
 * How far through the cycle the calendar is.
 *
 * This measures *time*, not achievement, and the interface has to say so.
 * Hours are an input metric; a bar that fills as the month passes looks exactly
 * like a progress bar for work done, and would quietly turn the clock into a
 * score. The days-remaining figure leads for that reason.
 */
export function cycleProgress(
  cycle: Pick<Cycle, "starts_on" | "ends_on">,
  today: Date = new Date(),
): CycleProgress {
  const start = toUtcDay(cycle.starts_on);
  const end = toUtcDay(cycle.ends_on);
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  const totalDays = Math.max(1, Math.round((end - start) / DAY_MS));
  const rawElapsed = Math.round((now - start) / DAY_MS);

  const elapsedDays = Math.min(Math.max(rawElapsed, 0), totalDays);
  const remainingDays = Math.max(totalDays - elapsedDays, 0);

  return {
    totalDays,
    elapsedDays,
    remainingDays,
    elapsedFraction: elapsedDays / totalDays,
    hasEnded: now > end,
  };
}

export async function getActiveCycle(supabase: Client): Promise<Cycle | null> {
  const { data } = await supabase.from("cycles").select("*").eq("status", "active").maybeSingle();

  return data ?? null;
}

export async function listCycles(supabase: Client): Promise<Cycle[]> {
  const { data } = await supabase
    .from("cycles")
    .select("*")
    .order("starts_on", { ascending: false });

  return data ?? [];
}

/**
 * Opens a cycle.
 *
 * No check for an existing active cycle before inserting: the partial unique
 * index answers that question atomically, and a read-then-write here would be
 * both redundant and racy.
 */
export async function openCycle(
  supabase: Client,
  userId: string,
  input: { label: string; startsOn: string; endsOn: string },
) {
  return supabase.from("cycles").insert({
    user_id: userId,
    label: input.label,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    status: "active",
  });
}

/** Closes a cycle through the RPC, so the transition is recorded like any other. */
export async function closeCycle(supabase: Client, cycleId: string) {
  return supabase.rpc("close_cycle", { p_cycle_id: cycleId });
}
