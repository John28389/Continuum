import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/db/types";
import { listCycles, type Cycle } from "@/lib/domain/cycle";
import type { HistoryCursor, HistorySource, HistoryType } from "@/lib/validation/history";

type Client = SupabaseClient<Database>;

export type AuditEventRow = Database["public"]["Tables"]["audit_events"]["Row"];
export type ReviewRow = Database["public"]["Tables"]["mission_reviews"]["Row"];
export type RuleEventRow = Database["public"]["Tables"]["rule_events"]["Row"];

/**
 * The record, read back.
 *
 * The timeline is three tables merged: `audit_events` (every lifecycle change,
 * written by trigger, so no write path can forget to record itself),
 * `mission_reviews` (the reasons behind the exits) and `rule_events` (the
 * moments a rule held). Nothing in this file writes. The page that uses it has
 * no form but its filters.
 *
 * Merged here rather than by a database view: a view is a migration, and this
 * milestone reads what the schema already keeps.
 */
export type TimelineEntry =
  | { readonly source: "audit"; readonly row: AuditEventRow }
  | { readonly source: "review"; readonly row: ReviewRow }
  | { readonly source: "rule"; readonly row: RuleEventRow };

export interface TimelinePage {
  readonly entries: readonly TimelineEntry[];
  /** Where the next, older page starts; null on the last page. */
  readonly next: HistoryCursor | null;
}

export const PAGE_SIZE = 30;

// ===========================================================================
// Days
// ===========================================================================

/** Milliseconds a timezone's wall clock runs ahead of UTC at an instant. */
function zoneOffset(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instant));

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((candidate) => candidate.type === type)?.value ?? 0);

  const wall = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  return wall - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant a calendar day begins in a timezone.
 *
 * The offset is read twice: at a first guess, then at the answer, because
 * across a daylight-saving change the two differ and one correction settles it.
 */
export function startOfDay(date: string, timeZone: string): Date {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  const wallMidnight = Date.UTC(year, month - 1, day);
  const guess = wallMidnight - zoneOffset(wallMidnight, timeZone);
  return new Date(wallMidnight - zoneOffset(guess, timeZone));
}

function nextDay(date: string): string {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

export interface TimeRange {
  /** Inclusive. */
  readonly start: string | null;
  /** Exclusive. */
  readonly end: string | null;
}

/**
 * The instants a set of filters covers.
 *
 * A cycle filters by its calendar, not by association: everything recorded
 * from its first day to its last, in the reader's timezone. That is the one
 * definition every source shares — a curiosity captured mid-cycle belongs to
 * no mission, and a rule event may cite none — and it answers the question the
 * filter asks: what happened during that month. With a date range as well, the
 * two overlap.
 */
export function resolveRange(
  filters: { readonly from: string | null; readonly to: string | null; readonly timeZone: string },
  cycle: Pick<Cycle, "starts_on" | "ends_on"> | null,
): TimeRange {
  // YYYY-MM-DD compares correctly as text.
  const firstDays = [filters.from, cycle?.starts_on].filter((day) => day != null).sort();
  const lastDays = [filters.to, cycle?.ends_on].filter((day) => day != null).sort();

  const first = firstDays.at(-1);
  const last = lastDays.at(0);

  return {
    start: first ? startOfDay(first, filters.timeZone).toISOString() : null,
    end: last ? startOfDay(nextDay(last), filters.timeZone).toISOString() : null,
  };
}

// ===========================================================================
// Order
// ===========================================================================

/**
 * Microseconds since the epoch.
 *
 * `Date.parse` keeps milliseconds, and the rows one transaction writes share an
 * instant to the microsecond, so the last three digits are read by hand.
 */
export function instantKey(timestamp: string): number {
  const fraction = (/\.(\d+)/.exec(timestamp)?.[1] ?? "").padEnd(6, "0");
  const millis = Date.parse(timestamp.replace(/\.\d+/, `.${fraction.slice(0, 3)}`));
  return millis * 1000 + Number(fraction.slice(3, 6));
}

/**
 * Within one instant, a status change sorts above the review that justified it
 * — they share a transaction — so the timeline reads, top down, as the
 * decision and then its reason.
 */
const SOURCE_RANK: Readonly<Record<HistorySource, number>> = { audit: 0, review: 1, rule: 2 };

/**
 * Newest first; then by table; then by id, descending.
 *
 * The id order is arbitrary, but it is total and stable, which is what a
 * cursor needs. Lowercase uuids compare as text exactly as Postgres compares
 * them as uuids, byte by byte.
 */
export function compareKeys(a: HistoryCursor, b: HistoryCursor): number {
  const byInstant = instantKey(b.createdAt) - instantKey(a.createdAt);
  if (byInstant !== 0) return byInstant;

  const byTable = SOURCE_RANK[a.source] - SOURCE_RANK[b.source];
  if (byTable !== 0) return byTable;

  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

export function entryKey(entry: TimelineEntry): HistoryCursor {
  return { createdAt: entry.row.created_at, source: entry.source, id: entry.row.id };
}

// ===========================================================================
// Pages
// ===========================================================================
//
// Keyset, not offset. An offset over three merged tables would have to read
// offset + page rows from each of them, more with every page. A cursor — the
// last entry's instant, table and id — lets each table answer with at most a
// page and one more row, however far back the reader goes.

/** Which rows of one table a query asks for. */
export type Slice =
  | { readonly kind: "first" }
  /** Rows at exactly the cursor's instant, and, in the cursor's own table, below its id. */
  | { readonly kind: "tie"; readonly at: string; readonly idBelow: string | null }
  | { readonly kind: "older"; readonly than: string };

export type SliceFetcher = (
  source: HistorySource,
  slice: Slice,
  limit: number,
) => Promise<TimelineEntry[]>;

function slicesFor(source: HistorySource, before: HistoryCursor | null): Slice[] {
  if (before === null) return [{ kind: "first" }];

  const older: Slice = { kind: "older", than: before.createdAt };
  const rank = SOURCE_RANK[source] - SOURCE_RANK[before.source];

  // This table sorts above the cursor's at that instant: all of its rows
  // there were on earlier pages.
  if (rank < 0) return [older];

  return [{ kind: "tie", at: before.createdAt, idBelow: rank === 0 ? before.id : null }, older];
}

/** Orders candidates, keeps those after the cursor, and cuts one page. */
export function takePage(
  candidates: readonly TimelineEntry[],
  before: HistoryCursor | null,
  pageSize: number = PAGE_SIZE,
): TimelinePage {
  const ordered = candidates
    .filter((entry) => before === null || compareKeys(before, entryKey(entry)) < 0)
    .sort((a, b) => compareKeys(entryKey(a), entryKey(b)));

  const entries = ordered.slice(0, pageSize);
  const last = entries.at(-1);

  return {
    entries,
    next: ordered.length > pageSize && last ? entryKey(last) : null,
  };
}

/**
 * One page, from whichever tables are asked.
 *
 * Each table contributes at most a page and one row per slice, so the true
 * next page is always among the candidates, and the extra row says whether
 * anything lies beyond it.
 */
export async function collectPage(
  fetchSlice: SliceFetcher,
  sources: readonly HistorySource[],
  before: HistoryCursor | null,
  pageSize: number = PAGE_SIZE,
): Promise<TimelinePage> {
  const batches = await Promise.all(
    sources.flatMap((source) =>
      slicesFor(source, before).map((slice) => fetchSlice(source, slice, pageSize + 1)),
    ),
  );

  return takePage(batches.flat(), before, pageSize);
}

// ===========================================================================
// Reading the tables
// ===========================================================================

const AUDIT_ENTITIES = ["mission", "curiosity", "cycle", "campaign", "direction"] as const;

export interface SourcePlan {
  /** `audit_events.entity_type` values to read; empty reads none. */
  readonly auditEntities: readonly string[];
  readonly reviews: boolean;
  readonly ruleEvents: boolean;
}

/** Which tables a type filter reads. Reviews are part of a mission's life. */
export function planSources(type: HistoryType | null): SourcePlan {
  switch (type) {
    case null:
      return { auditEntities: AUDIT_ENTITIES, reviews: true, ruleEvents: true };
    case "mission":
      return { auditEntities: ["mission"], reviews: true, ruleEvents: false };
    case "rule":
      return { auditEntities: [], reviews: false, ruleEvents: true };
    default:
      return { auditEntities: [type], reviews: false, ruleEvents: false };
  }
}

function sourcesIn(plan: SourcePlan): HistorySource[] {
  const sources: HistorySource[] = [];
  if (plan.auditEntities.length > 0) sources.push("audit");
  if (plan.reviews) sources.push("review");
  if (plan.ruleEvents) sources.push("rule");
  return sources;
}

type Condition = readonly [
  column: "created_at" | "id",
  operator: "gte" | "lt" | "eq",
  value: string,
];

/**
 * The filters for one slice of one table.
 *
 * Every value is either a bound computed here or a cursor that has already
 * been parsed, never text a person typed.
 */
export function sliceConditions(range: TimeRange, slice: Slice): Condition[] {
  const conditions: Condition[] = [];
  if (range.start) conditions.push(["created_at", "gte", range.start]);
  if (range.end) conditions.push(["created_at", "lt", range.end]);
  if (slice.kind === "older") conditions.push(["created_at", "lt", slice.than]);
  if (slice.kind === "tie") {
    conditions.push(["created_at", "eq", slice.at]);
    if (slice.idBelow !== null) conditions.push(["id", "lt", slice.idBelow]);
  }
  return conditions;
}

function supabaseFetcher(supabase: Client, plan: SourcePlan, range: TimeRange): SliceFetcher {
  return async (source, slice, limit) => {
    const conditions = sliceConditions(range, slice);

    if (source === "audit") {
      let query = supabase
        .from("audit_events")
        .select("*")
        .in("entity_type", [...plan.auditEntities]);
      for (const [column, operator, value] of conditions)
        query = query.filter(column, operator, value);
      const { data } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit);
      return (data ?? []).map((row) => ({ source, row }));
    }

    if (source === "review") {
      let query = supabase.from("mission_reviews").select("*");
      for (const [column, operator, value] of conditions)
        query = query.filter(column, operator, value);
      const { data } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit);
      return (data ?? []).map((row) => ({ source, row }));
    }

    let query = supabase.from("rule_events").select("*");
    for (const [column, operator, value] of conditions)
      query = query.filter(column, operator, value);
    const { data } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);
    return (data ?? []).map((row) => ({ source, row }));
  };
}

export async function listTimeline(
  supabase: Client,
  query: {
    readonly type: HistoryType | null;
    readonly range: TimeRange;
    readonly before: HistoryCursor | null;
  },
  pageSize: number = PAGE_SIZE,
): Promise<TimelinePage> {
  const plan = planSources(query.type);
  return collectPage(
    supabaseFetcher(supabase, plan, query.range),
    sourcesIn(plan),
    query.before,
    pageSize,
  );
}

// ===========================================================================
// What each entry is about
// ===========================================================================

/** A string field of a jsonb object, or null. Written by the server, but still jsonb. */
export function jsonString(value: Json, key: string): string | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const field = value[key];
  return typeof field === "string" ? field : null;
}

/** Names by id, per kind of thing. An id missing from its map was deleted. */
export interface Subjects {
  readonly missions: ReadonlyMap<string, string>;
  readonly curiosities: ReadonlyMap<string, string>;
  readonly cycles: ReadonlyMap<string, string>;
  readonly campaigns: ReadonlyMap<string, string>;
  readonly directions: ReadonlyMap<string, string>;
}

type SubjectKind = keyof Subjects;

const AUDIT_SUBJECT: Readonly<Record<string, SubjectKind>> = {
  mission: "missions",
  curiosity: "curiosities",
  cycle: "cycles",
  campaign: "campaigns",
  direction: "directions",
};

export function subjectIds(entries: readonly TimelineEntry[]): Record<SubjectKind, string[]> {
  const ids: Record<SubjectKind, Set<string>> = {
    missions: new Set(),
    curiosities: new Set(),
    cycles: new Set(),
    campaigns: new Set(),
    directions: new Set(),
  };

  for (const entry of entries) {
    if (entry.source === "audit") {
      const kind = AUDIT_SUBJECT[entry.row.entity_type];
      if (kind) ids[kind].add(entry.row.entity_id);
    } else if (entry.source === "review") {
      ids.missions.add(entry.row.mission_id);
    } else {
      const mission = jsonString(entry.row.context, "mission_id");
      const curiosity = jsonString(entry.row.context, "curiosity_id");
      if (mission) ids.missions.add(mission);
      if (curiosity) ids.curiosities.add(curiosity);
    }
  }

  return {
    missions: [...ids.missions],
    curiosities: [...ids.curiosities],
    cycles: [...ids.cycles],
    campaigns: [...ids.campaigns],
    directions: [...ids.directions],
  };
}

async function labels(
  ids: readonly string[],
  query: (ids: string[]) => PromiseLike<{ data: { id: string; label: string }[] | null }>,
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await query([...ids]);
  return new Map((data ?? []).map((row) => [row.id, row.label]));
}

export async function resolveSubjects(
  supabase: Client,
  entries: readonly TimelineEntry[],
): Promise<Subjects> {
  const ids = subjectIds(entries);

  const [missions, curiosities, cycles, campaigns, directions] = await Promise.all([
    labels(ids.missions, (in_) =>
      supabase.from("missions").select("id, label:title").in("id", in_),
    ),
    labels(ids.curiosities, (in_) =>
      supabase.from("curiosities").select("id, label:title").in("id", in_),
    ),
    labels(ids.cycles, (in_) => supabase.from("cycles").select("id, label").in("id", in_)),
    labels(ids.campaigns, (in_) =>
      supabase.from("campaigns").select("id, label:name").in("id", in_),
    ),
    labels(ids.directions, (in_) =>
      supabase.from("directions").select("id, label:title").in("id", in_),
    ),
  ]);

  return { missions, curiosities, cycles, campaigns, directions };
}

// ===========================================================================
// Cycles and how their missions ended
// ===========================================================================

export interface CycleMission {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  /** Why it ended, for a mission that left through a review. */
  readonly reasonCategory: string | null;
}

export interface CycleRecord {
  readonly cycle: Cycle;
  readonly missions: readonly CycleMission[];
}

type MissionSummary = Pick<
  Database["public"]["Tables"]["missions"]["Row"],
  "id" | "title" | "status" | "cycle_id"
>;
type ExitReview = Pick<ReviewRow, "mission_id" | "reason_category" | "outcome">;

/**
 * Each cycle with its missions, in the order they were created.
 *
 * A review is attached only where its outcome is the mission's final status: a
 * mission reviewed and kept, then completed, ended by its criteria, not by that
 * review.
 */
export function groupCycleRecords(
  cycles: readonly Cycle[],
  missions: readonly MissionSummary[],
  exits: readonly ExitReview[],
): CycleRecord[] {
  const exitCategory = new Map(
    exits.map((review) => [`${review.mission_id}:${review.outcome}`, review.reason_category]),
  );

  return cycles.map((cycle) => ({
    cycle,
    missions: missions
      .filter((mission) => mission.cycle_id === cycle.id)
      .map((mission) => ({
        id: mission.id,
        title: mission.title,
        status: mission.status,
        reasonCategory: exitCategory.get(`${mission.id}:${mission.status}`) ?? null,
      })),
  }));
}

export async function listCycleRecords(supabase: Client): Promise<CycleRecord[]> {
  const [cycles, missions, exits] = await Promise.all([
    listCycles(supabase),
    supabase
      .from("missions")
      .select("id, title, status, cycle_id")
      .order("created_at", { ascending: true }),
    supabase
      .from("mission_reviews")
      .select("mission_id, reason_category, outcome")
      .in("outcome", ["revised", "abandoned"]),
  ]);

  return groupCycleRecords(cycles, missions.data ?? [], exits.data ?? []);
}
