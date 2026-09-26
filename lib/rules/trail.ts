/**
 * The Trail of Evidence.
 *
 * A mission's path told by what it left behind: when it began, the first time
 * work was done on it, the first discovery written down, the first evidence
 * recorded, half and then all of the Definition of Done, and completion.
 *
 * Only steps actually reached are returned. A step not reached is not drawn as
 * missing: nothing in the product requires a note or a piece of evidence, and a
 * trail with its gaps drawn in would turn the record into a checklist of what
 * was not done.
 *
 * "Half" is half of the Definition of Done, never half of the hours. Hours are
 * an input (RULE-102); the trail measures what remains after them. The one step
 * about effort — the first session — carries no duration, and the interface
 * draws it quieter than the steps that produced something.
 *
 * Pure, computed from rows the mission page already reads, and never stored.
 */

export const TRAIL_STEPS = [
  "created",
  "first_session",
  "first_discovery",
  "first_evidence",
  "halfway",
  "definition_of_done",
  "completed",
] as const;
export type TrailStepKey = (typeof TRAIL_STEPS)[number];

/** Effort is recorded; output and milestones are what remain. */
export type TrailStepKind = "milestone" | "effort" | "output";

export interface TrailStep {
  readonly key: TrailStepKey;
  readonly kind: TrailStepKind;
  readonly at: string;
  /** What this step left behind, in the person's own words. */
  readonly artifact: { readonly text: string; readonly href: string | null } | null;
}

export interface TrailInput {
  readonly createdAt: string;
  readonly completedAt: string | null;
  readonly sessions: readonly { readonly started_at: string }[];
  readonly notes: readonly {
    readonly id: string;
    readonly title: string;
    readonly note_type: string;
    readonly created_at: string;
  }[];
  readonly evidence: readonly { readonly description: string; readonly created_at: string }[];
  readonly criteria: readonly { readonly satisfied_at: string | null }[];
}

function earliest<T>(items: readonly T[], at: (item: T) => string): T | null {
  let first: T | null = null;
  for (const item of items) {
    if (first === null || Date.parse(at(item)) < Date.parse(at(first))) first = item;
  }
  return first;
}

export function evidenceTrail(input: TrailInput): TrailStep[] {
  const steps: TrailStep[] = [
    { key: "created", kind: "milestone", at: input.createdAt, artifact: null },
  ];

  const session = earliest(input.sessions, (item) => item.started_at);
  if (session) {
    steps.push({ key: "first_session", kind: "effort", at: session.started_at, artifact: null });
  }

  const discoveries = input.notes.filter((note) => note.note_type === "discovery");
  const discovery = earliest(discoveries, (note) => note.created_at);
  if (discovery) {
    steps.push({
      key: "first_discovery",
      kind: "output",
      at: discovery.created_at,
      artifact: { text: discovery.title, href: `/knowledge/${discovery.id}` },
    });
  }

  const evidence = earliest(input.evidence, (item) => item.created_at);
  if (evidence) {
    steps.push({
      key: "first_evidence",
      kind: "output",
      at: evidence.created_at,
      artifact: { text: evidence.description, href: null },
    });
  }

  const total = input.criteria.length;
  const satisfied = input.criteria
    .map((criterion) => criterion.satisfied_at)
    .filter((at): at is string => at !== null)
    .sort((a, b) => Date.parse(a) - Date.parse(b));

  // With a single criterion, half and all are the same moment; one step says it.
  const halfAt = total >= 2 ? satisfied[Math.ceil(total / 2) - 1] : undefined;
  if (halfAt) steps.push({ key: "halfway", kind: "milestone", at: halfAt, artifact: null });

  const allAt = total > 0 && satisfied.length === total ? satisfied.at(-1) : undefined;
  if (allAt) {
    steps.push({ key: "definition_of_done", kind: "milestone", at: allAt, artifact: null });
  }

  if (input.completedAt) {
    steps.push({ key: "completed", kind: "milestone", at: input.completedAt, artifact: null });
  }

  return steps;
}
