# Data model

All tables below exist as migrations and are verified by the adversarial suite
in `supabase/tests/`. Each entry records what the table is for and which rules
it carries.

Every planned table now exists.

## Conventions

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade` on every
  owned table
- `created_at timestamptz not null default now()`; `updated_at` maintained by a
  shared trigger
- All timestamps `timestamptz`, stored UTC. Cycle and campaign boundaries are
  `date`, since they are calendar concepts rather than instants
- Status columns are `text` with an explicit check constraint rather than
  Postgres enums, so a value can be added without a type migration
- Every foreign key is indexed
- Row level security enabled in the same migration that creates the table
- A constraint enforcing a rule carries its rule code in a SQL comment

## Planned tables

| Table                  | Purpose                                                         | Rules carried      |
| ---------------------- | --------------------------------------------------------------- | ------------------ |
| `profiles`             | Owner profile, extends `auth.users`                             | —                  |
| `directions`           | Multi-month strategic vector                                    | —                  |
| `campaigns`            | ~3 month objective under a direction                            | —                  |
| `cycles`               | Monthly execution window; one active per user                   | RULE-005           |
| `missions`             | The primary mission; one active per user                        | 001, 003–006, 008  |
| `mission_dod_criteria` | Definition-of-Done criteria as rows, so completion is checkable | RULE-002, RULE-008 |
| `mission_sessions`     | Time invested in the active mission — an input metric           | RULE-102           |
| `mission_evidence`     | Concrete output, optionally citing a criterion                  | RULE-006           |
| `mission_reviews`      | Categorised justification for leaving an active mission         | RULE-004           |
| `curiosities`          | The parking lot                                                 | RULE-007           |
| `knowledge_notes`      | Lightweight Zettelkasten notes                                  | —                  |
| `knowledge_links`      | Connections between notes                                       | —                  |
| `rules`                | Rule registry rendered by the Rules page; read-only reference   | —                  |
| `rule_events`          | When a rule blocked, was overridden, or advised                 | —                  |
| `audit_events`         | Append-only decision history                                    | —                  |

## Notes on two decisions

**`mission_dod_criteria` is not in the original conceptual list.** It was added
because a Definition of Done stored as free text cannot be enforced. As rows it
becomes checkable — a mission with zero criteria cannot be activated — it can be
satisfied item by item, and evidence has something concrete to attach to.

**`daily_states` is deferred.** It appeared in the conceptual model, but no
planned feature reads it. Tables without a function are not created.

## `missions`: the ways out (M15)

An active mission leaves by completion (RULE-008) or by a review (RULE-004),
and by nothing else. A draft was never committed to, so it may be dropped or
deleted freely.

| Refusal                                                           | Enforced by                                           |
| ----------------------------------------------------------------- | ----------------------------------------------------- |
| Active to `revised`/`abandoned` without a same-transaction review | `enforce_mission_exit_review()` (RULE-004)            |
| Active back to `draft`, by any route                              | `enforce_mission_exit_review()` (RULE-004)            |
| Deleting a mission that is not a draft                            | Delete policy `missions_delete_own_draft` (zero rows) |

## `mission_sessions`

Time is recorded as periods — `started_at`, and `ended_at` null while running —
rather than as durations, because only periods can be checked for overlap. A
duration is always derived.

The database refuses, independently of any form:

| Refusal                             | Enforced by                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------- |
| Overlapping periods, per user       | `enforce_mission_session()` trigger, under a per-user advisory lock         |
| More than one running session       | Partial unique index `mission_sessions_one_running_per_user`, and the above |
| A session on a non-active mission   | The same trigger, on insert                                                 |
| A period ending in the future       | The same trigger, against the database's `now()`                            |
| Moving a session to another mission | The same trigger, on update                                                 |
| A zero-length or backwards period   | Check constraint `mission_sessions_period_valid`                            |

The timer never sends a time. `started_at` defaults to `now()` and
`stop_mission_session()` stamps the end from the same clock, so no two machines
ever contribute to one duration.

Nothing about a session changes a mission. Reaching the target load completes
nothing (RULE-102); the adversarial suite logs past the target and asserts the
mission is still active.

## `mission_evidence`

The output side of the ledger. A description is required; a link and a cited
criterion are optional. Nothing in the product requires evidence — RULE-008
requires satisfied criteria — so this table records what exists after the work
without becoming a gate in front of it.

| Refusal                                  | Enforced by                                                     |
| ---------------------------------------- | --------------------------------------------------------------- |
| Evidence on a mission that is not active | `enforce_mission_evidence()` trigger, on insert                 |
| Citing another mission's criterion       | Composite foreign key `mission_evidence_criterion_same_mission` |
| A link that is not http or https         | Check constraint `mission_evidence_url_valid`                   |
| Any write once the mission is finished   | `enforce_mission_record_frozen()` (RULE-006)                    |

## `curiosities` and the promotion boundary (M12)

Capture needs only a title. `promote_curiosity_to_mission()` is the only path
from a curiosity to a mission (RULE-007): it accepts no status and no cycle
argument, always targets the caller's own active cycle, and produces a `draft`
mission.

The cycle boundary is derived entirely from state the schema already carries —
no new column, flag or time window. A cycle is open for promotion from the
moment it becomes `active` until the moment its first mission is activated
(`missions.activated_at` set); a draft mission sitting in the cycle does not
close the window, and the window stays closed for the rest of that cycle
regardless of what later happens to the mission that closed it.

| Refusal                                              | Enforced by                                 |
| ---------------------------------------------------- | ------------------------------------------- |
| No active cycle to promote into                      | `promote_curiosity_to_mission()` (RULE-007) |
| The active cycle already has an activated mission    | `promote_curiosity_to_mission()` (RULE-007) |
| Promoting a curiosity already `chosen` or `archived` | `promote_curiosity_to_mission()` (RULE-007) |

## `knowledge_notes` and `knowledge_links`

A light Zettelkasten: a note needs only a title and content, and nothing in the
product requires one. A link is stored once and read from both ends, as a link
on one note and a backlink on the other.

| Guarantee                             | Enforced by                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| A note cites only its owner's mission | Composite foreign key `knowledge_notes_mission_same_owner`                         |
| Deleting a mission keeps its notes    | That key's `ON DELETE SET NULL (mission_id)`, fixed 2026-09-14 and tested in `070` |
| No self-link, no duplicate link       | `knowledge_links_no_self_link`, `knowledge_links_unique_triple`                    |
| Links only between one owner's notes  | Composite foreign keys over `(note, user_id)`                                      |

## Deliberately not modelled

- No stored integrity score. Mission Integrity is computed from `missions` and
  `mission_reviews` so it cannot go stale.
- No stored progress percentage. Derived from sessions and satisfied criteria.
- No soft-delete columns. History lives in `audit_events`; archival is a status.
- No history view. The History page (M15) merges `audit_events`,
  `mission_reviews` and `rule_events` in TypeScript, paging each by cursor.
