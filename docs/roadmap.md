# Roadmap

The remaining milestones. `docs/status.md` says which one is next.

Each milestone ends at a checkpoint: run its verification, report the real
output, append to `docs/decisions.md`, print the git commands, and stop. The
owner runs every push.

**Scope fences are binding.** They exist because this product's own argument is
that doing one thing at a time is what makes the thing get finished.

---

## M9 — Mission lifecycle UI and enforcement UX

**Objective.** Create, activate and view the primary mission — and make
RULE-001's block a useful moment rather than a dead end.

**Depends on.** M8. **Invariants touched.** RULE-001, RULE-002, RULE-003,
RULE-005. Audit for bypass paths first.

**Files expected.**

- `app/(app)/missions/{page,new}/`, `app/(app)/missions/[id]/page.tsx`
- `components/mission/{mission-form,dod-editor,mission-card,rule-violation}.tsx`
- `lib/domain/mission.ts`, `lib/validation/mission.ts`
- `lib/rules/measurability.ts` — the advisory RULE-101 heuristic
- `tests/unit/mission-validation.test.ts`, `tests/unit/measurability.test.ts`
- `tests/e2e/mission-core.spec.ts`

**Acceptance criteria.**

1. Creating a mission requires title, reason, campaign, cycle, minimum load,
   target load, and at least one Definition-of-Done criterion.
2. **Attempting to activate a second mission is blocked**, names RULE-001,
   explains why the rule exists, and offers the curiosity parking lot as the
   legitimate alternative. Not a dead end and not a telling-off.
3. A criterion with no observable outcome triggers the RULE-101 advisory —
   "esta missão ainda não possui um critério de conclusão verificável" — which
   **never blocks**. Judging whether prose is measurable stays with the user.
4. Every rule violation renders as an explanation. No stack trace, no SQL, no
   bare error code.
5. Each block writes a `rule_events` row, so the behavioural history has data
   to draw on later.
6. Loads are entered in hours and stored in minutes; the form never implies
   more hours is better.
7. End-to-end: create, activate, attempt a second, see the explanation, confirm
   the first mission is still the active one.

**Verification.**

```bash
npm run verify && npm run test:e2e
```

Then look at it. Screenshot the block. A refusal that reads as punishment is a
defect even when every test passes.

**Scope fence.** No sessions, no evidence, no completion — those are M10 and
M11. No editing of a mission's load after activation; that needs a review and
belongs with M13.

**Failure modes.**

- **The block enforced only in the UI.** The end-to-end test must confirm the
  server refuses, not merely that a button was disabled.
- The RULE-101 advisory hardening into a block, which would break the
  rigid-invariants / flexible-variables split.
- Wording that shames. The prompt is for reflection.
- Hours presented as the primary progress measure.

---

## M10 — Sessions and progress

**Objective.** Track time as an input metric, visibly subordinate to output.

**Files.** `app/(app)/missions/[id]/sessions/`,
`components/mission/{session-timer,session-list,load-progress}.tsx`,
`lib/domain/session.ts`, a `mission_sessions` migration,
`supabase/tests/050_sessions.test.sql`, `tests/unit/load-progress.test.ts`.

**Acceptance criteria.**

1. Start and stop a session, or log one manually. Overlapping sessions are
   refused **by the database**.
2. Progress shows hours against both minimum and target — never a single
   percentage that implies more is better.
3. Reaching the target load does **not** complete the mission, and the interface
   says so plainly (RULE-102).
4. Sessions carry an optional note.
5. Starting a session is one action from the dashboard.

**Scope fence.** No evidence, no completion.

**Failure modes.** Hours rendered as the primary progress bar — the likeliest
drift in the whole project. Timezone errors in duration. A timer that needs
babysitting.

---

## M11 — Evidence, Definition of Done, completion

**Objective.** Close the loop on output, and honour finishing early.

**Files.** `app/(app)/missions/[id]/evidence/`,
`components/mission/{evidence-form,evidence-list,completion-panel}.tsx`,
`lib/domain/evidence.ts`, a `mission_evidence` migration,
`supabase/tests/060_evidence.test.sql`, `tests/e2e/mission-complete.spec.ts`.

**Acceptance criteria.**

1. Evidence attaches to the mission and optionally to a specific criterion.
2. Completion is offered only when every criterion is satisfied, and the reason
   it is unavailable is always visible.
3. On completion the interface shows `MISSÃO CONCLUÍDA` and **stops**. No
   remaining percentage, no suggestion to do more, no manufactured work.
4. A completed mission is read-only; reopening is refused server-side
   (RULE-006).
5. End-to-end: create → activate → session → evidence → satisfy → complete →
   confirm reopening fails.

**Decide and record.** Whether "all criteria satisfied" becomes a HARD database
rule with its own registry entry, or stays enforced in `complete_mission`. It
was deliberately deferred here from M3.

**Failure modes.** Any nudge after completion. Hours gating completion instead
of criteria.

---

## M12 — Curiosity parking lot

**Objective.** Capture in seconds; keep curiosity off the active line.

**Invariants touched.** RULE-007.

**Files.** `app/(app)/curiosities/`,
`components/curiosity/{quick-capture,curiosity-list,curiosity-card,promote-dialog}.tsx`,
`lib/domain/curiosity.ts`, `tests/e2e/curiosity-capture.spec.ts`.

**Acceptance criteria.**

1. Quick capture needs **only a title**, is reachable from anywhere, and has a
   keyboard shortcut.
2. Capture is comfortable at 375px. This is the mobile path that matters most.
3. The dashboard shows a **count only**, never the list.
4. Promotion is available only at a cycle boundary and produces a `draft`
   mission — verified server-side, not merely hidden in the interface.
5. States `captured | waiting | candidate | chosen | archived` are filterable.

**Failure modes.** A capture form asking for area, potential and rationale up
front, which kills the "few seconds" requirement and therefore the whole
mechanism. The full list leaking onto the dashboard.

---

## M13 — Rules page and reflection UX

**Objective.** Make the rules visible, legible, and honest about what is
actually enforced.

**Files.** `app/(app)/rules/`,
`components/rules/{rule-card,severity-badge,enforcement-badge}.tsx`,
`components/mission/reflection-prompt.tsx`.

**Acceptance criteria.**

1. Every rule shows name, description, rationale, severity, enforcement level
   and exceptions.
2. The page reads enforcement metadata **from the `rules` table**, so it cannot
   claim a protection that does not exist. Prose comes from `lib/i18n/pt-BR.ts`.
3. HARD, SOFT and ADVISORY are visually distinct.
4. Leaving an active mission surfaces the reflection prompt — "você está mudando
   a regra ou tentando escapar dela?" — as reflection, never punishment.
5. The review flow requires a `reason_category` and a written justification,
   then calls `review_mission()` (RULE-004).
6. Recent rule events are visible per rule.

**Scope fence.** No AI-generated reflection text. Deterministic copy only.

---

## M14 — Knowledge notes and links

**Objective.** Lightweight Zettelkasten. Useful, never bureaucratic.

**Acceptance criteria.** A note needs only title and content. Notes link
bidirectionally with visible backlinks. A note can be created from a mission in
one action and carries that origin. Search over title, content and type.
**Nothing anywhere requires a note** — no prompts, no completion gates.

**Scope fence.** No graph visualisation, no AI summarisation, no tag taxonomy.

---

## M15 — History and audit browsing

**Objective.** Make `audit_events` legible.

**Acceptance criteria.** A chronological timeline of missions created,
activated, reviewed and completed, curiosities captured, and rules triggered.
Filterable by entity type, date range and cycle. Past cycles browsable with
their missions and outcomes. Strictly read-only — no edit or delete affordance
exists. Pagination handles volume.

**Scope fence.** No analytics or pattern detection. No psychological framing,
ever: observations about recorded behaviour, never a diagnosis.

---

## M16 — Mission Integrity and Trail of Evidence

**Objective.** Sophisticated, meaningful gamification.

`lib/rules/integrity.ts` already exists and is unit-tested; this milestone
renders it.

**Acceptance criteria.**

1. Integrity is **computed, never stored**: missions completed, revised, ended,
   reviews by category, and blocked attempts to break a commitment.
2. Presented as counts and history — **no score, level, XP, streak, coin, badge
   or leaderboard**. A unit test already guards this.
3. Trail of Evidence renders: created → first session → first discovery → first
   evidence → 50% → Definition of Done → completed.
4. The trail emphasises what remains after the effort, not the effort.

**Note.** "Abandoned on impulse" is deliberately absent — RULE-004 makes it
unreachable, so the figure would be a permanent zero. See `docs/decisions.md`.

---

## M17 — Personal agent, advisory only (dropped)

**Dropped on 2026-09-15 by the owner.** It needs a paid API, and Continuum must
stay free to run: the Anthropic API has no free tier. See `docs/decisions.md`.
The spec below is kept for reference only, in case a free option is ever
chosen.

**Objective.** A guidance layer with **zero write authority**.

**Depends on.** M16. The deterministic core must be complete first.
**Manual prerequisite.** The owner adds `ANTHROPIC_API_KEY` to `.env.local`.
Server only, never `NEXT_PUBLIC_`.

**Acceptance criteria.**

1. Runs server-side only; the key never reaches the browser, verified by the
   same bundle grep used in M6.
2. Receives read-only projections: direction, campaign, active mission,
   progress, rules, curiosities, history, evidence, recent decisions.
3. Has **no tool that writes**. Any suggested change is executed by the user
   through the normal interface, hitting the same RPCs.
4. Reproduces the specified behaviours: refuses to endorse an impulsive swap;
   resists opportunistic target inflation; recognises a genuine premise change
   and directs the user to a formal review.
5. Never issues psychological diagnoses. Behavioural observations only.
6. A prompt-injection test: instruction-shaped text inside a curiosity or note
   does not cause the agent to claim authority it lacks or assert a rule changed.

**Failure modes.** **Giving the agent a write tool "just for convenience"** —
that collapses the entire architecture. If it ever seems necessary, stop and
ask. Feed it the `rules` table rather than a paraphrase.

---

## M18 — Polish and readiness

**Acceptance criteria.** The dashboard answers the five questions in seconds and
shows only current mission, cycle status, curiosity count and four shortcuts.
Keyboard navigation and screen-reader labels across all seven areas; contrast
passes WCAG AA. Error and empty states everywhere. Curiosity capture comfortable
at 375px. Full-loop end-to-end green. `README.md` gets a fresh clone running
without asking a question.

**Failure mode.** The dashboard accreting panels until it violates the very
thing it is for.

---

## M6-cloud — Cloud project and deployment

**Done on 2026-09-15.** The schema was pushed to the cloud project
(`rgkbprsaxjkmvcpzmsnq`), all 13 migrations. The invariant suite passes against
it, 10 of 10, and public sign-up is disabled. The application is live at
https://continuum-danilo.vercel.app. See `docs/decisions.md`.

**The owner's steps, in the Supabase dashboard.**

| #   | Action                                                             | Where                        |
| --- | ------------------------------------------------------------------ | ---------------------------- |
| 1   | Save the database password in a password manager                   | dashboard                    |
| 2   | Copy the Project URL and the publishable key                       | Project Settings → API       |
| 3   | Paste both into `.env.local`; never into a chat                    | local file                   |
| 4   | Disable public sign-up; create the single user manually            | Auth → Providers, then Users |
| 5   | Set Site URL and redirect URLs for localhost and the Vercel domain | Auth → URL Configuration     |
| 6   | Apply the schema with `npx supabase db push`                       | owner's terminal             |
| 7   | Add the two public variables to Vercel, Production and Preview     | Vercel dashboard             |

**Acceptance criteria.** Cloud schema matches local; login works against it; the
invariant suite passes against it; sign-up is refused by the project's own
configuration.

**Failure modes.** Redirect URL mismatch causes a login loop. Schema drift if
anything was changed by hand in the dashboard — reconcile with a migration,
never by patching the cloud directly.
