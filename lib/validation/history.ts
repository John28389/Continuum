import { z } from "zod";

/**
 * The History page's filters, read from the URL.
 *
 * Everything here arrives in a query string anyone can edit, so every value is
 * parsed rather than trusted, and anything that does not parse is dropped
 * rather than reported: a filter that cannot be read is no filter, and the
 * page still shows the record.
 */

/**
 * What the timeline can be narrowed to. Reviews belong with missions: a review
 * is part of a mission's life, and "missions created, activated, reviewed and
 * completed" is one story.
 */
export const HISTORY_TYPES = [
  "mission",
  "curiosity",
  "rule",
  "cycle",
  "campaign",
  "direction",
] as const;
export type HistoryType = (typeof HISTORY_TYPES)[number];

/** The three tables the timeline is read from. */
export const HISTORY_SOURCES = ["audit", "review", "rule"] as const;
export type HistorySource = (typeof HISTORY_SOURCES)[number];

/** The last entry of a page: the next page starts strictly after it. */
export interface HistoryCursor {
  readonly createdAt: string;
  readonly source: HistorySource;
  readonly id: string;
}

export interface HistoryFilters {
  readonly type: HistoryType | null;
  /** Calendar dates, YYYY-MM-DD, both inclusive, in `timeZone`. */
  readonly from: string | null;
  readonly to: string | null;
  readonly cycleId: string | null;
  /**
   * The reader's timezone, sent by the browser. The server has no other way to
   * know where a calendar day starts; without it, days are UTC days.
   */
  readonly timeZone: string;
  /** Whether the URL carried a usable timezone at all. */
  readonly hasTimeZone: boolean;
  readonly before: HistoryCursor | null;
}

type RawParams = Record<string, string | string[] | undefined>;

/** A single string, or nothing: a repeated parameter is not a filter. */
function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

const uuid = z.string().uuid();

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isTimeZone(value: string): boolean {
  if (value === "") return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function asType(value: string): HistoryType | null {
  return HISTORY_TYPES.find((type) => type === value) ?? null;
}

function asSource(value: string): HistorySource | null {
  return HISTORY_SOURCES.find((source) => source === value) ?? null;
}

// A timestamptz as PostgREST returns it, fraction and offset optional.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
const CURSOR_SEPARATOR = "~";

export function encodeCursor(cursor: HistoryCursor): string {
  return [cursor.createdAt, cursor.source, cursor.id].join(CURSOR_SEPARATOR);
}

export function parseCursor(value: string): HistoryCursor | null {
  const parts = value.split(CURSOR_SEPARATOR);
  if (parts.length !== 3) return null;

  const [createdAt = "", rawSource = "", id = ""] = parts;
  const source = asSource(rawSource);
  if (!TIMESTAMP.test(createdAt) || source === null || !uuid.safeParse(id).success) return null;

  return { createdAt, source, id: id.toLowerCase() };
}

export function parseHistoryFilters(params: RawParams): HistoryFilters {
  const from = single(params.from);
  const to = single(params.to);
  const cycleId = single(params.cycle);
  const timeZone = single(params.tz);
  const hasTimeZone = isTimeZone(timeZone);

  return {
    type: asType(single(params.type)),
    from: isCalendarDate(from) ? from : null,
    to: isCalendarDate(to) ? to : null,
    cycleId: uuid.safeParse(cycleId).success ? cycleId.toLowerCase() : null,
    timeZone: hasTimeZone ? timeZone : "UTC",
    hasTimeZone,
    before: parseCursor(single(params.before)),
  };
}

/** Whether where a day starts matters to these filters. */
export function dependsOnTimeZone(filters: HistoryFilters): boolean {
  return filters.from !== null || filters.to !== null || filters.cycleId !== null;
}

/**
 * The query string for these filters, optionally moved to another page.
 *
 * The timezone is carried only when the URL already had one, so a link never
 * pins a timezone the reader's browser did not send.
 */
export function historyQuery(
  filters: HistoryFilters,
  before: HistoryCursor | null = null,
): URLSearchParams {
  const query = new URLSearchParams();
  if (filters.type) query.set("type", filters.type);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.cycleId) query.set("cycle", filters.cycleId);
  if (filters.hasTimeZone) query.set("tz", filters.timeZone);
  if (before) query.set("before", encodeCursor(before));
  return query;
}
