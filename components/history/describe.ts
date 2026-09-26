import {
  jsonString,
  type AuditEventRow,
  type CycleMission,
  type ReviewRow,
  type RuleEventRow,
  type Subjects,
  type TimelineEntry,
} from "@/lib/domain/history";
import { ptBR, ruleCopy } from "@/lib/i18n/pt-BR";
import { isRuleCode } from "@/lib/rules/registry";

/**
 * One timeline entry, in words.
 *
 * Pure, and kept out of the components so every sentence the History page can
 * produce is tested. Each line states what was recorded — a mission activated,
 * a review with its category and the words written, a rule that held — and
 * nothing about what it might mean.
 */

const copy = ptBR.history;
const events = copy.events;

export type EntryKind = keyof typeof copy.kinds;

export interface DescribedEntry {
  readonly key: string;
  readonly createdAt: string;
  readonly kind: EntryKind;
  readonly headline: string;
  readonly subject: string | null;
  readonly href: string | null;
  readonly detail: string | null;
  /** Words the person wrote, shown as written. */
  readonly quote: string | null;
}

type Described = Omit<DescribedEntry, "key" | "createdAt">;

function labelIn(map: Readonly<Record<string, string>>, key: string | null): string | null {
  if (key === null || !Object.prototype.hasOwnProperty.call(map, key)) return null;
  return map[key] ?? null;
}

function isText(value: string | null): value is string {
  return value !== null && value !== "";
}

/** "Capturada → Escolhida", or nothing when either side has no label. */
function transition(
  map: Readonly<Record<string, string>>,
  from: string | null,
  to: string | null,
): string | null {
  const before = labelIn(map, from);
  const after = labelIn(map, to);
  return before && after ? `${before} → ${after}` : null;
}

/** A name when the thing still exists; a plain statement when it does not. */
function subjectOf(
  names: ReadonlyMap<string, string>,
  id: string | null,
): { text: string | null; exists: boolean } {
  if (id === null) return { text: null, exists: false };
  const name = names.get(id);
  return name === undefined ? { text: copy.removed, exists: false } : { text: name, exists: true };
}

function missionSubject(subjects: Subjects, id: string | null) {
  const subject = subjectOf(subjects.missions, id);
  return { subject: subject.text, href: subject.exists && id ? `/missions/${id}` : null };
}

const MISSION_ARRIVALS: Readonly<Record<string, string>> = {
  active: events.missionActivated,
  completed: events.missionCompleted,
  revised: events.missionRevised,
  abandoned: events.missionAbandoned,
};

const CYCLE_ARRIVALS: Readonly<Record<string, string>> = {
  planned: events.cyclePlanned,
  active: events.cycleOpened,
  closed: events.cycleClosed,
};

function describeAudit(row: AuditEventRow, subjects: Subjects): Described {
  const created = row.action.endsWith(".created");
  const status = jsonString(row.payload, "status");
  const from = jsonString(row.payload, "from");
  const to = jsonString(row.payload, "to");

  switch (row.entity_type) {
    case "mission": {
      const arrival = labelIn(MISSION_ARRIVALS, to);
      return {
        kind: "mission",
        headline: created ? events.missionCreated : (arrival ?? events.missionChanged),
        ...missionSubject(subjects, row.entity_id),
        detail: created || arrival ? null : transition(ptBR.missionStatus, from, to),
        quote: null,
      };
    }

    case "curiosity":
      return {
        kind: "curiosity",
        headline: created ? events.curiosityCaptured : events.curiosityChanged,
        subject: subjectOf(subjects.curiosities, row.entity_id).text,
        href: null,
        detail: created ? null : transition(ptBR.curiosityState, from, to),
        quote: null,
      };

    case "cycle": {
      const arrival = labelIn(CYCLE_ARRIVALS, created ? status : to);
      return {
        kind: "cycle",
        headline: arrival ?? events.cycleChanged,
        subject: subjectOf(subjects.cycles, row.entity_id).text,
        href: null,
        detail: arrival ? null : transition(copy.cycleStatus, from, to),
        quote: null,
      };
    }

    case "campaign":
      return {
        kind: "campaign",
        headline: created ? events.campaignCreated : events.campaignChanged,
        subject: subjectOf(subjects.campaigns, row.entity_id).text,
        href: null,
        detail: created ? null : transition(copy.campaignStatus, from, to),
        quote: null,
      };

    case "direction":
      return {
        kind: "direction",
        headline: created ? events.directionCreated : events.directionChanged,
        subject: subjectOf(subjects.directions, row.entity_id).text,
        href: null,
        detail: created ? null : transition(copy.directionStatus, from, to),
        quote: null,
      };

    default:
      return {
        kind: "other",
        headline: events.other,
        subject: null,
        href: null,
        detail: null,
        quote: null,
      };
  }
}

function describeReview(row: ReviewRow, subjects: Subjects): Described {
  const decision = labelIn(ptBR.review.outcomes, row.outcome);

  return {
    kind: "review",
    headline: events.reviewRecorded,
    ...missionSubject(subjects, row.mission_id),
    detail:
      [
        labelIn(ptBR.reviewCategory, row.reason_category),
        decision ? `${copy.decision}: ${decision}` : null,
      ]
        .filter(isText)
        .join(" · ") || null,
    quote: row.justification,
  };
}

function describeRule(row: RuleEventRow, subjects: Subjects): Described {
  const missionId = jsonString(row.context, "mission_id");
  const curiosityId = jsonString(row.context, "curiosity_id");
  const about = missionId
    ? missionSubject(subjects, missionId)
    : { subject: subjectOf(subjects.curiosities, curiosityId).text, href: null };

  return {
    kind: "rule",
    headline: isRuleCode(row.rule_code) ? ruleCopy(row.rule_code).name : row.rule_code,
    ...about,
    detail: [
      row.rule_code,
      labelIn(ptBR.ruleEventOutcome, row.outcome),
      labelIn(copy.attemptedActions, jsonString(row.context, "action")),
    ]
      .filter(isText)
      .join(" · "),
    quote: null,
  };
}

export function describeEntry(entry: TimelineEntry, subjects: Subjects): DescribedEntry {
  const described =
    entry.source === "audit"
      ? describeAudit(entry.row, subjects)
      : entry.source === "review"
        ? describeReview(entry.row, subjects)
        : describeRule(entry.row, subjects);

  return {
    key: `${entry.source}:${entry.row.id}`,
    createdAt: entry.row.created_at,
    ...described,
  };
}

/** "Encerrada · A premissa mudou": how a mission ended, and why when a review said so. */
export function describeOutcome(mission: Pick<CycleMission, "status" | "reasonCategory">): string {
  return [
    labelIn(ptBR.missionStatus, mission.status),
    labelIn(ptBR.reviewCategory, mission.reasonCategory),
  ]
    .filter(isText)
    .join(" · ");
}

export function describeCycleStatus(status: string): string {
  return labelIn(copy.cycleStatus, status) ?? "";
}

export interface DayGroup<T> {
  readonly day: string;
  readonly entries: T[];
}

/** Consecutive entries that share a day. The input is already in order. */
export function groupByDay<T extends { readonly createdAt: string }>(
  entries: readonly T[],
  dayOf: (createdAt: string) => string,
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];

  for (const entry of entries) {
    const day = dayOf(entry.createdAt);
    const last = groups.at(-1);
    if (last && last.day === day) {
      last.entries.push(entry);
    } else {
      groups.push({ day, entries: [entry] });
    }
  }

  return groups;
}
