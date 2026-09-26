import { describe, expect, it } from "vitest";

import {
  describeCycleStatus,
  describeEntry,
  describeOutcome,
  groupByDay,
} from "@/components/history/describe";
import type { Json } from "@/lib/db/types";
import type { Cycle } from "@/lib/domain/cycle";
import {
  collectPage,
  compareKeys,
  entryKey,
  groupCycleRecords,
  instantKey,
  planSources,
  resolveRange,
  sliceConditions,
  startOfDay,
  subjectIds,
  type AuditEventRow,
  type SliceFetcher,
  type Subjects,
  type TimelineEntry,
} from "@/lib/domain/history";
import { ptBR } from "@/lib/i18n/pt-BR";
import {
  encodeCursor,
  historyQuery,
  parseCursor,
  parseHistoryFilters,
  type HistoryCursor,
} from "@/lib/validation/history";

const USER = "00000000-0000-4000-8000-000000000000";

function id(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

function audit(n: number, createdAt: string, fields: Partial<AuditEventRow> = {}): TimelineEntry {
  return {
    source: "audit",
    row: {
      id: id(n),
      user_id: USER,
      entity_type: "curiosity",
      entity_id: id(10_000 + n),
      action: "curiosity.created",
      payload: { status: "captured" },
      created_at: createdAt,
      ...fields,
    },
  };
}

function review(n: number, createdAt: string, missionId = id(1)): TimelineEntry {
  return {
    source: "review",
    row: {
      id: id(n),
      user_id: USER,
      mission_id: missionId,
      reason_category: "premise_changed",
      justification: "A ferramenta que a missão pressupunha foi descontinuada.",
      outcome: "abandoned",
      created_at: createdAt,
    },
  };
}

function ruleEvent(n: number, createdAt: string, context: Json = {}): TimelineEntry {
  return {
    source: "rule",
    row: {
      id: id(n),
      user_id: USER,
      rule_code: "RULE-001",
      outcome: "blocked",
      context,
      created_at: createdAt,
    },
  };
}

// ===========================================================================
// Filters
// ===========================================================================

describe("history filters", () => {
  it("reads nothing into an empty query", () => {
    expect(parseHistoryFilters({})).toEqual({
      type: null,
      from: null,
      to: null,
      cycleId: null,
      timeZone: "UTC",
      hasTimeZone: false,
      before: null,
    });
  });

  it("keeps what parses", () => {
    expect(
      parseHistoryFilters({
        type: "curiosity",
        from: "2026-08-01",
        to: "2026-08-31",
        cycle: id(7).toUpperCase(),
        tz: "America/Sao_Paulo",
      }),
    ).toMatchObject({
      type: "curiosity",
      from: "2026-08-01",
      to: "2026-08-31",
      cycleId: id(7),
      timeZone: "America/Sao_Paulo",
      hasTimeZone: true,
    });
  });

  it("drops what does not, rather than failing the page", () => {
    expect(
      parseHistoryFilters({
        // Reviews are read with missions; there is no separate type.
        type: "review",
        from: "2026-02-30",
        to: "31/08/2026",
        cycle: "not-a-uuid",
        tz: "Mars/Olympus_Mons",
        before: "garbage",
      }),
    ).toEqual(parseHistoryFilters({}));
  });

  it("ignores a repeated parameter", () => {
    expect(parseHistoryFilters({ type: ["mission", "rule"] }).type).toBeNull();
  });

  it("round-trips a cursor", () => {
    const cursor: HistoryCursor = {
      createdAt: "2026-09-14T19:43:19.123456+00:00",
      source: "review",
      id: id(42),
    };
    expect(parseCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("refuses a malformed cursor", () => {
    for (const bad of [
      "",
      "a~b~c",
      `2026-09-14T10:00:00+00:00~audit~not-a-uuid`,
      `2026-09-14T10:00:00+00:00~other~${id(1)}`,
      `2026-09-14~audit~${id(1)}`,
      `2026-09-14T10:00:00+00:00~audit~${id(1)}~extra`,
    ]) {
      expect(parseCursor(bad), bad).toBeNull();
    }
  });

  it("carries a timezone into links only when the URL had one", () => {
    expect(historyQuery(parseHistoryFilters({ type: "rule" })).toString()).toBe("type=rule");
    expect(historyQuery(parseHistoryFilters({ type: "rule", tz: "Asia/Tokyo" })).toString()).toBe(
      "type=rule&tz=Asia%2FTokyo",
    );
  });
});

// ===========================================================================
// Days and ranges
// ===========================================================================

describe("where a day starts", () => {
  it("is midnight in UTC", () => {
    expect(startOfDay("2026-09-14", "UTC").toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });

  it("is three hours later in São Paulo", () => {
    expect(startOfDay("2026-09-14", "America/Sao_Paulo").toISOString()).toBe(
      "2026-09-14T03:00:00.000Z",
    );
  });

  it("is the evening before in Tokyo", () => {
    expect(startOfDay("2026-09-14", "Asia/Tokyo").toISOString()).toBe("2026-09-13T15:00:00.000Z");
  });

  it("follows a daylight-saving change on either side", () => {
    expect(startOfDay("2026-03-08", "America/New_York").toISOString()).toBe(
      "2026-03-08T05:00:00.000Z",
    );
    expect(startOfDay("2026-03-09", "America/New_York").toISOString()).toBe(
      "2026-03-09T04:00:00.000Z",
    );
    expect(startOfDay("2026-11-01", "America/New_York").toISOString()).toBe(
      "2026-11-01T04:00:00.000Z",
    );
    expect(startOfDay("2026-11-02", "America/New_York").toISOString()).toBe(
      "2026-11-02T05:00:00.000Z",
    );
  });
});

describe("the time range", () => {
  it("is open without filters", () => {
    expect(resolveRange({ from: null, to: null, timeZone: "UTC" }, null)).toEqual({
      start: null,
      end: null,
    });
  });

  it("includes the whole of the last day, in the reader's timezone", () => {
    expect(
      resolveRange({ from: "2026-08-01", to: "2026-08-31", timeZone: "America/Sao_Paulo" }, null),
    ).toEqual({ start: "2026-08-01T03:00:00.000Z", end: "2026-09-01T03:00:00.000Z" });
  });

  it("is a cycle's calendar when a cycle is chosen", () => {
    expect(
      resolveRange(
        { from: null, to: null, timeZone: "UTC" },
        { starts_on: "2026-08-01", ends_on: "2026-08-30" },
      ),
    ).toEqual({ start: "2026-08-01T00:00:00.000Z", end: "2026-08-31T00:00:00.000Z" });
  });

  it("narrows to where a date range and a cycle overlap", () => {
    expect(
      resolveRange(
        { from: "2026-07-20", to: "2026-08-10", timeZone: "UTC" },
        { starts_on: "2026-08-01", ends_on: "2026-08-30" },
      ),
    ).toEqual({ start: "2026-08-01T00:00:00.000Z", end: "2026-08-11T00:00:00.000Z" });
  });
});

// ===========================================================================
// Order and pages
// ===========================================================================

describe("timeline order", () => {
  it("reads the microseconds Date.parse drops", () => {
    expect(instantKey("2026-09-14T10:00:00.000002+00:00")).toBeGreaterThan(
      instantKey("2026-09-14T10:00:00.000001+00:00"),
    );
    expect(instantKey("2026-09-14T10:00:00+00:00")).toBe(
      instantKey("2026-09-14T10:00:00.000000+00:00"),
    );
    expect(instantKey("2026-09-14T10:00:00.5+00:00")).toBe(
      instantKey("2026-09-14T10:00:00.500000+00:00"),
    );
  });

  it("puts a status change above the review recorded in the same transaction", () => {
    const at = "2026-09-14T10:00:00.5+00:00";
    expect(
      compareKeys(
        { createdAt: at, source: "audit", id: id(1) },
        { createdAt: at, source: "review", id: id(9) },
      ),
    ).toBeLessThan(0);
  });

  it("breaks the remaining ties by id, descending", () => {
    const at = "2026-09-14T10:00:00+00:00";
    expect(
      compareKeys(
        { createdAt: at, source: "rule", id: id(9) },
        { createdAt: at, source: "rule", id: id(1) },
      ),
    ).toBeLessThan(0);
  });
});

/** Answers slices the way the database does, from memory. */
function memoryFetcher(all: readonly TimelineEntry[], limits: number[] = []): SliceFetcher {
  return async (source, slice, limit) => {
    limits.push(limit);
    return all
      .filter((entry) => entry.source === source)
      .filter((entry) => {
        const at = instantKey(entry.row.created_at);
        if (slice.kind === "first") return true;
        if (slice.kind === "older") return at < instantKey(slice.than);
        return (
          at === instantKey(slice.at) && (slice.idBelow === null || entry.row.id < slice.idBelow)
        );
      })
      .sort((a, b) => compareKeys(entryKey(a), entryKey(b)))
      .slice(0, limit);
  };
}

// Heavy ties on purpose. One transaction writes several rows at one instant,
// and a cursor that cannot step through a tie loses or repeats them.
const INSTANTS = [
  "2026-09-14T10:00:00.000001+00:00",
  "2026-09-14T10:00:00+00:00",
  "2026-09-14T09:59:59.999999+00:00",
];

function instantFor(n: number): string {
  return INSTANTS[Math.floor(n / 5) % INSTANTS.length] ?? "2026-09-14T10:00:00+00:00";
}

const RECORD: TimelineEntry[] = Array.from({ length: 75 }, (_, n) => {
  if (n % 3 === 0) return audit(n, instantFor(n));
  if (n % 3 === 1) return review(n, instantFor(n));
  return ruleEvent(n, instantFor(n));
});

const ALL_SOURCES = ["audit", "review", "rule"] as const;

function keyOf(entry: TimelineEntry): string {
  return `${entry.source}:${entry.row.id}`;
}

describe("pagination", () => {
  it("walks the whole record once, in order, a page at a time", async () => {
    const fetcher = memoryFetcher(RECORD);
    const seen: string[] = [];
    let before: HistoryCursor | null = null;
    let pages = 0;

    do {
      const page = await collectPage(fetcher, ALL_SOURCES, before, 10);
      expect(page.entries.length).toBeLessThanOrEqual(10);
      seen.push(...page.entries.map(keyOf));
      before = page.next;
      pages += 1;
      expect(pages, "the walk must end").toBeLessThan(20);
    } while (before !== null);

    const expected = [...RECORD].sort((a, b) => compareKeys(entryKey(a), entryKey(b))).map(keyOf);
    expect(seen).toEqual(expected);
    expect(pages).toBe(8);
  });

  it("says there is nothing further on the last page", async () => {
    const page = await collectPage(memoryFetcher(RECORD.slice(0, 5)), ALL_SOURCES, null, 10);
    expect(page.entries).toHaveLength(5);
    expect(page.next).toBeNull();
  });

  it("asks each table for no more than a page and one row", async () => {
    const limits: number[] = [];
    const first = await collectPage(memoryFetcher(RECORD, limits), ALL_SOURCES, null, 10);
    await collectPage(memoryFetcher(RECORD, limits), ALL_SOURCES, first.next, 10);
    expect(Math.max(...limits)).toBe(11);
  });

  it("reads only the tables a type needs; reviews come with missions", () => {
    expect(planSources(null)).toEqual({
      auditEntities: ["mission", "curiosity", "cycle", "campaign", "direction"],
      reviews: true,
      ruleEvents: true,
    });
    expect(planSources("mission")).toEqual({
      auditEntities: ["mission"],
      reviews: true,
      ruleEvents: false,
    });
    expect(planSources("rule")).toEqual({ auditEntities: [], reviews: false, ruleEvents: true });
    expect(planSources("campaign")).toEqual({
      auditEntities: ["campaign"],
      reviews: false,
      ruleEvents: false,
    });
  });

  it("builds a tie slice from the range and the cursor, and nothing else", () => {
    expect(
      sliceConditions(
        { start: "2026-08-01T03:00:00.000Z", end: null },
        { kind: "tie", at: "2026-09-14T10:00:00+00:00", idBelow: id(5) },
      ),
    ).toEqual([
      ["created_at", "gte", "2026-08-01T03:00:00.000Z"],
      ["created_at", "eq", "2026-09-14T10:00:00+00:00"],
      ["id", "lt", id(5)],
    ]);
  });
});

// ===========================================================================
// In words
// ===========================================================================

const SUBJECTS: Subjects = {
  missions: new Map([[id(1), "Fundamentos de web exploitation"]]),
  curiosities: new Map([[id(2), "Fuzzing de protocolos"]]),
  cycles: new Map([[id(3), "Agosto"]]),
  campaigns: new Map(),
  directions: new Map(),
};

const AT = "2026-09-14T10:00:00+00:00";
const events = ptBR.history.events;

describe("describing an entry", () => {
  it("names a mission's activation and links to the mission", () => {
    const entry = audit(10, AT, {
      entity_type: "mission",
      entity_id: id(1),
      action: "mission.status_changed",
      payload: { from: "draft", to: "active" },
    });

    expect(describeEntry(entry, SUBJECTS)).toMatchObject({
      key: `audit:${id(10)}`,
      kind: "mission",
      headline: events.missionActivated,
      subject: "Fundamentos de web exploitation",
      href: `/missions/${id(1)}`,
      detail: null,
    });
  });

  it("says a record was removed rather than inventing a name or a link", () => {
    const entry = audit(11, AT, {
      entity_type: "mission",
      entity_id: id(99),
      action: "mission.created",
      payload: { status: "draft" },
    });

    expect(describeEntry(entry, SUBJECTS)).toMatchObject({
      headline: events.missionCreated,
      subject: ptBR.history.removed,
      href: null,
    });
  });

  it("shows a review's category, its decision and the words written", () => {
    expect(describeEntry(review(12, AT), SUBJECTS)).toMatchObject({
      kind: "review",
      headline: events.reviewRecorded,
      subject: "Fundamentos de web exploitation",
      detail: "A premissa mudou · Decisão: Encerrar",
      quote: "A ferramenta que a missão pressupunha foi descontinuada.",
    });
  });

  it("names the rule, what it did, and what was being attempted", () => {
    const entry = ruleEvent(13, AT, { action: "mission.activate", mission_id: id(1) });

    expect(describeEntry(entry, SUBJECTS)).toMatchObject({
      kind: "rule",
      headline: ptBR.rules["RULE-001"].name,
      subject: "Fundamentos de web exploitation",
      detail: "RULE-001 · Bloqueou · Ativar missão",
    });
  });

  it("shows a curiosity's change of state", () => {
    const entry = audit(14, AT, {
      entity_id: id(2),
      action: "curiosity.status_changed",
      payload: { from: "captured", to: "chosen" },
    });

    expect(describeEntry(entry, SUBJECTS)).toMatchObject({
      kind: "curiosity",
      headline: events.curiosityChanged,
      subject: "Fuzzing de protocolos",
      detail: "Capturada → Escolhida",
    });
  });

  it("closes a cycle by name", () => {
    const entry = audit(15, AT, {
      entity_type: "cycle",
      entity_id: id(3),
      action: "cycle.status_changed",
      payload: { from: "active", to: "closed" },
    });

    expect(describeEntry(entry, SUBJECTS)).toMatchObject({
      kind: "cycle",
      headline: events.cycleClosed,
      subject: "Agosto",
    });
  });

  it("falls back plainly on a value it has no words for", () => {
    const entry = audit(16, AT, {
      entity_type: "mission",
      entity_id: id(1),
      action: "mission.status_changed",
      payload: { from: "draft", to: "something_new" },
    });

    expect(describeEntry(entry, SUBJECTS)).toMatchObject({
      headline: events.missionChanged,
      detail: null,
    });
  });

  it("collects the ids each kind of subject needs, once each", () => {
    const ids = subjectIds([
      review(20, AT, id(1)),
      ruleEvent(21, AT, { mission_id: id(1), curiosity_id: id(2) }),
      audit(22, AT, { entity_type: "cycle", entity_id: id(3) }),
    ]);

    expect(ids).toEqual({
      missions: [id(1)],
      curiosities: [id(2)],
      cycles: [id(3)],
      campaigns: [],
      directions: [],
    });
  });
});

describe("cycles and outcomes", () => {
  const cycle = (n: number, label: string) =>
    ({
      id: id(n),
      label,
      status: "closed",
      starts_on: "2026-08-01",
      ends_on: "2026-08-31",
    }) as Cycle;

  it("gathers each cycle's missions, and the reason where a review ended one", () => {
    const records = groupCycleRecords(
      [cycle(1, "Agosto"), cycle(2, "Julho")],
      [
        { id: id(10), title: "Concluída", status: "completed", cycle_id: id(1) },
        { id: id(11), title: "Encerrada", status: "abandoned", cycle_id: id(1) },
      ],
      [{ mission_id: id(11), reason_category: "premise_changed", outcome: "abandoned" }],
    );

    expect(records.map((record) => record.missions.length)).toEqual([2, 0]);
    expect(records[0]?.missions.map(describeOutcome)).toEqual([
      "Concluída",
      "Encerrada · A premissa mudou",
    ]);
  });

  it("attaches a review only where its decision is how the mission ended", () => {
    const [record] = groupCycleRecords(
      [cycle(1, "Agosto")],
      [{ id: id(10), title: "Concluída depois", status: "completed", cycle_id: id(1) }],
      [{ mission_id: id(10), reason_category: "scope_error", outcome: "abandoned" }],
    );

    expect(record?.missions[0]?.reasonCategory).toBeNull();
  });

  it("labels a cycle's status in words", () => {
    expect(describeCycleStatus("closed")).toBe("Encerrado");
    expect(describeCycleStatus("unknown")).toBe("");
  });
});

describe("days", () => {
  it("groups consecutive entries that share a day", () => {
    const groups = groupByDay(
      [{ createdAt: "a1" }, { createdAt: "a2" }, { createdAt: "b1" }],
      (createdAt) => createdAt.slice(0, 1),
    );

    expect(groups.map((group) => [group.day, group.entries.length])).toEqual([
      ["a", 2],
      ["b", 1],
    ]);
  });
});

describe("history copy", () => {
  /**
   * Observations about the record, never about the person. The words below
   * characterise behaviour or assign blame, and none of them belongs on a page
   * that only reads back what happened.
   */
  it("describes what was recorded, never the person who recorded it", () => {
    const text = JSON.stringify(ptBR.history).toLowerCase();

    for (const word of [
      "impuls",
      "procrastin",
      "fracass",
      "falhou",
      "pregui",
      "culpa",
      "deveria",
      "inconsistente",
      "disciplina",
      "padrão",
      "tendência",
    ]) {
      expect(text, word).not.toContain(word);
    }
  });
});
