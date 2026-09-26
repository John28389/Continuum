# Rules registry

This file is the authoritative statement of the rules Continuum enforces. It must
stay in agreement with two other places, and a parity test asserts the last two
match:

- `lib/rules/registry.ts` — the typed constants the application reads
- the `rules` table seed migration — what the Rules page renders

If a rule's text, severity, or enforcement level changes, all three change
together.

## Enforcement levels

| Level        | Meaning                                                                     |
| ------------ | --------------------------------------------------------------------------- |
| **HARD**     | The system blocks the action. Enforced by the database, not only by the UI. |
| **SOFT**     | The system permits it but requires explicit confirmation or justification.  |
| **ADVISORY** | The system only recommends. It never blocks.                                |

The distinction matters: it separates the few rules that are genuinely
structural from preferences that must stay flexible. The system is rigid on
invariants and flexible on variables.

---

## RULE-001 — Single active mission

**Severity:** critical · **Enforcement:** HARD

Only one primary mission may be active at a time.

**Why.** Parallel tracks are the failure mode this product exists to prevent.
Work in progress is treated as limited capacity, not as a preference. If a
second mission could be activated, every other rule here becomes decoration.

**Enforcement.** A partial unique index on `missions (user_id) where status =
'active'`. The activation RPC returns a typed violation, and the interface
explains the block and offers the curiosity parking lot instead.

**Exceptions.** None. Small recurring maintenance activities exist, but they are
not missions and never carry mission-level authority.

---

## RULE-002 — Definition of Done required

**Severity:** critical · **Enforcement:** HARD

A mission cannot be activated without at least one Definition-of-Done criterion.

**Why.** "Study web exploitation" cannot be finished, only abandoned. A mission
without a verifiable completion criterion has no honest end state, so the user
can never know they are done. Storing criteria as rows rather than prose is what
makes this checkable at all.

**Enforcement.** A `before update` trigger blocking any transition to `active`
when the mission has no rows in `mission_dod_criteria`.

**Exceptions.** Whether a criterion is _well written_ stays ADVISORY — the
system flags a vague criterion but never blocks on that judgement.

---

## RULE-003 — Minimum and target load

**Severity:** high · **Enforcement:** HARD

Every mission carries a minimum load and a target load, with target >= minimum > 0.

**Why.** The minimum is deliberately safe: an amount achievable even in an
imperfect month. The target is the desired outcome. Keeping both prevents the
system from treating maximum hours as the goal.

**Enforcement.** A check constraint on `missions`. Mirrored by a Zod schema.

**Exceptions.** Both values are variables and may be revised. Raising a target
mid-cycle on a burst of motivation requires a formal review, because the target
was sized for consistency rather than for peaks.

---

## RULE-004 — Justified exit

**Severity:** critical · **Enforcement:** HARD

Leaving an active mission requires a categorised, written justification.

**Why.** This is the rule that distinguishes an impulsive swap from a real change
of premise. Losing interest, boredom, or finding something more exciting are not
sufficient. A changed premise, a broken external dependency, a mis-sized scope, a
shift in strategy, or evidence that the mission stopped being relevant are.

**Enforcement.** Direct status updates away from `active` are blocked by a
trigger: an arrival in `revised` or `abandoned` needs a review recorded in the
same transaction, and any other destination but `completed` — in practice, back
to `draft` — is refused outright. Only `review_mission()` may perform the exit,
and it inserts the `mission_reviews` row and changes the status in a single
transaction, so a missing or uncategorised justification rolls both back.
Deletion is not a way out either: row level security lets only a draft be
deleted.

**Exceptions.** None on the mechanism. The categories themselves may be extended.

**Note on tone.** The reflection prompt — asking whether the user is changing the
rule or escaping it — is a mechanism for thought, not punishment. Wording that
shames is a defect.

---

## RULE-005 — Cycle-bound activation

**Severity:** high · **Enforcement:** HARD

A mission can only be activated within the currently active cycle.

**Why.** Choosing next month's mission during this month is how the current one
starts being abandoned mentally before it is finished. Non-binding candidates may
be listed; official selection waits for the cycle boundary.

**Enforcement.** A trigger requiring the mission's `cycle_id` to match the user's
active cycle at activation. Candidates remain `draft` and are not activatable.

**Exceptions.** Preliminary planning is allowed and expected. It simply cannot
result in an active mission.

---

## RULE-006 — Completion is terminal

**Severity:** high · **Enforcement:** HARD

A completed mission can never be reopened.

**Why.** History has to be trustworthy for the integrity record to mean anything.
If completion can be revoked, the record becomes editable and stops describing
what actually happened.

**Enforcement.** A trigger raising on any update that moves status out of
`completed`. The record is frozen at the storage layer as well: triggers on
`mission_dod_criteria`, `mission_evidence` and `mission_sessions` refuse any
change once the mission is completed, revised or abandoned, so read-only is a
property of the database rather than of the interface. A session still running
when a mission leaves `active` is closed at that moment. A finished mission
cannot be deleted, so its record — and the justification that ended it — stays.

**Exceptions.** None. Follow-up work becomes a new mission.

---

## RULE-007 — Curiosities are parked, never promoted directly

**Severity:** critical · **Enforcement:** HARD

A curiosity can only ever be promoted into a `draft` mission, never an active
one, and only at a cycle boundary: the currently active cycle, before that
cycle's first mission has been activated.

**Why.** Ideas must not be lost, and must also not become priorities the moment
they arrive. Capture keeps them safe; the parking lot keeps them out of the
active line until a cycle boundary makes evaluation appropriate.

**What counts as the boundary.** Defined entirely from state the schema
already carries, so evaluating it needs no new column or arbitrary time
window: the boundary is open for a cycle from the moment it becomes active
until the moment its first mission is activated (`missions.activated_at` set).
A draft mission sitting in the cycle does not close the window — only an
activation does, and it stays closed for the rest of that cycle regardless of
what happens to the mission afterwards (completed, revised or abandoned).

**Enforcement.** `promote_curiosity_to_mission()` produces a `draft` mission
and accepts no status parameter, and no cycle parameter either — it always
targets the caller's currently active cycle, checked against the same
`activated_at` condition, so the boundary cannot be routed around by naming a
different cycle. Combined with RULE-005, a curiosity cannot become the active
mission mid-cycle by any path.

**Exceptions.** None on the mechanism.

---

## RULE-008 — Completion by the Definition of Done

**Severity:** critical · **Enforcement:** HARD

A mission can only be completed from `active`, and only when every
Definition-of-Done criterion is satisfied.

**Why.** Completion is decided by the criteria, not by the hours (RULE-102). If
a mission could be marked complete with criteria still open, the Definition of
Done would be decoration and the integrity record would stop describing whether
anything was actually finished.

**Enforcement.** A `before insert or update` trigger on `missions` refuses any
arrival in `completed` that does not come from `active`, and any that finds no
criteria or a criterion without `satisfied_at`. It lives in the trigger rather
than in `complete_mission()` alone, so a direct `UPDATE` cannot route around it.
Criteria can be satisfied only while the mission is active.

**Exceptions.** None on the mechanism. Criteria can be marked and unmarked
freely while the mission is active. Whether a criterion is honestly met remains
the user's judgement, optionally backed by linked evidence — the system does not
require evidence per criterion, because that would make it cost more than it
saves.

---

## Advisory rules

These guide without blocking. They are recorded so the Rules page can explain
system behaviour the user will actually encounter.

### RULE-101 — Measurable completion criteria

**Severity:** medium · **Enforcement:** ADVISORY

When a Definition-of-Done criterion has no observable outcome, the system flags
it: the mission does not yet have a verifiable completion criterion. It never
blocks — judging whether prose is measurable is exactly the kind of decision that
should stay with the user.

### RULE-102 — Hours are not learning

**Severity:** medium · **Enforcement:** ADVISORY

Reaching the target load never completes a mission. Time invested is an input
metric; completion is determined by Definition-of-Done criteria and evidence. The
interface must never present hours as the primary measure of progress.

### RULE-103 — Finishing early ends the cycle's obligation

**Severity:** medium · **Enforcement:** ADVISORY

When a mission is completed before the cycle ends, the user is free. The system
must not manufacture work, suggest additional effort, or present the remaining
days as a deficit.
