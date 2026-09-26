# Decision log

Decisions a future session could not re-derive from the code. Newest last.
Each entry: what was decided, why, and what would justify revisiting it.

---

## 2026-09-08 — Milestone M0: harness bootstrap

### Product-level decisions confirmed with the owner

- **UI strings in pt-BR, code and schema in English.** The interface is read by a
  Portuguese speaker; the codebase stays portable and consistent with the
  ecosystem. One locale, so a typed string map rather than an i18n framework.
- **Single-user lockdown.** Public sign-up is disabled and the owner's account is
  created manually. The schema stays `user_id`-scoped and RLS-enforced anyway, so
  multi-user remains possible without a migration, but the attack surface of a
  publicly reachable deployment holding personal behavioural data stays minimal.
- **Derived engineering docs only.** The repository documents schema,
  constraints, and enforcement. The product specification stays local and private
  and is never copied, quoted, or named in a committed artifact.
- **Full test depth.** Unit tests, an adversarial SQL invariant suite, and a
  core-loop E2E. The invariants are the product, so the layer that enforces them
  gets the strongest verification.

### Build order: database before interface

Milestones M1–M5 build and adversarially verify the entire deterministic core
against a local Postgres in Docker, with no cloud project and no UI. The
enforcement layer is therefore proven before anything depends on it, and the
cloud project is not a prerequisite for most of the work.

### Toolchain version constraints

Three version choices were forced by real incompatibilities discovered while
installing, not by preference:

- **TypeScript pinned to 6.0.3, not the latest 7.0.2.** `typescript-eslint@8.70.0`
  declares `typescript >=4.8.4 <6.1.0`. Installing TypeScript 7 breaks typed
  linting outright. Revisit when typescript-eslint supports 7.x.
- **ESLint pinned to 9.39.5, not 10.10.0.** `eslint-config-next@16.3.4` bundles
  `eslint-plugin-react@7.37.5`, whose peer range stops at `eslint ^9.7`. Under
  ESLint 10 it throws `contextOrFilename.getFilename is not a function` and
  linting fails entirely. npm reports 9.39.5 as end-of-life, which is accepted
  deliberately: a supported-but-broken lint step is worth less than a
  deprecated-but-working one. Revisit when eslint-plugin-react supports ESLint 10.
- **`baseUrl` removed from `tsconfig.json`.** TypeScript 6 makes it a hard error.
  `paths` alone resolves relative to the config file, which is what was wanted.

Two dependencies from the original plan were dropped as unnecessary rather than
installed: `@eslint/eslintrc`, because `eslint-config-next@16` ships a native
flat config, and `vite-tsconfig-paths`, because Vite now resolves tsconfig paths
natively via `resolve.tsconfigPaths`.

`vitest.config` uses the `.mts` extension so Vite loads it as ESM; as `.ts` it
was being loaded as CommonJS and warned about a future breaking change.

### Design tokens

The four content classes — mission, maintenance, curiosity, leisure — are
defined as first-class CSS tokens rather than ad-hoc component styles. The
product requires that these never read as equally urgent, so making them tokens
means a future component cannot accidentally flatten the distinction. Light and
dark are both supported, driven by `prefers-color-scheme` with a class escape
hatch.

### Node version

Local Node is 26.2.0; Next.js 16.3.4 requires `>=20.9.0`, so the local runtime is
supported. `engines.node` is pinned to the same range. Before the first
deployment, confirm the Vercel project's Node version matches, since a build-time
mismatch would surface only there.

---

## 2026-09-09 — Milestones M1 to M5: the deterministic core

The schema, its enforcement objects, and the adversarial suite are written. The
suite has not yet been executed: see the blocker at the end of this entry.

### Enforcement placement

Each hard rule is enforced by the cheapest mechanism that cannot be bypassed:

| Rule     | Mechanism                                                       |
| -------- | --------------------------------------------------------------- |
| RULE-001 | Partial unique index `missions_one_active_per_user`             |
| RULE-002 | `missions_enforce_activation` trigger, before insert or update  |
| RULE-003 | `missions_load_coherent` check constraint                       |
| RULE-004 | `missions_enforce_exit_review` trigger                          |
| RULE-005 | `missions_enforce_activation` trigger, against the active cycle |
| RULE-006 | `missions_enforce_terminal_state` trigger                       |
| RULE-007 | `promote_curiosity_to_mission` accepts no status argument       |

Partial unique indexes are preferred to triggers where they fit, because they
hold under concurrency and cannot be sidestepped by any write path at all.

### RULE-004 without a session flag

The obvious implementation is a transaction-local flag that only
`review_mission()` sets, with the trigger checking it. That was rejected: a flag
is something any caller can set for itself, so the rule would be enforced by
convention rather than by the database.

Instead the trigger requires that a matching `mission_reviews` row exist with
`created_at >= now()`. Since `now()` is the transaction start time and is
constant for its duration, that identifies a review written in the same
transaction. The justification and the transition therefore commit together or
not at all, and the rule is satisfied by _any_ correct caller rather than by one
blessed function.

### No SECURITY DEFINER anywhere in the schema

The canonical Supabase pattern for creating a profile row is a definer trigger
on `auth.users`. It was avoided: the profile is instead created by the
application on first sign-in, as the user, through an ordinary RLS-checked
insert.

This keeps the count of privileged functions at zero, which is what makes the
static guard "no SECURITY DEFINER in migrations" a bright line rather than a
list of blessed exceptions. The only definer function in the repository is a
test helper that creates fixture users, and it lives in `supabase/tests/`, which
never reaches a cloud project.

### Ownership enforced by composite foreign keys

Child tables reference `(parent_id, user_id)` against a `unique (id, user_id)`
on the parent, rather than referencing `id` alone. Attaching a campaign to
another user's direction is therefore refused by the schema, instead of relying
on the application to check ownership on every write.

### Mission Integrity drops "abandoned on impulse"

The metric was originally to include a count of missions abandoned on impulse.
RULE-004 makes that state unreachable: leaving an active mission requires a
categorised justification, so an impulsive abandonment cannot be recorded
because it cannot happen. A permanently zero counter would be theatre.

The informative figure is the inverse — how often the system held the line — so
`impulseAttemptsBlocked` counts blocked rule events instead. Integrity remains
counts and history only: no score, level, streak, or badge. A unit test asserts
no such key appears in the record, guarding the product decision rather than the
implementation.

### Static migration guards

Because the SQL suite needs a running database and the invariant tests are the
point of the project, a second, weaker layer was added that runs anywhere:
`tests/unit/migrations-guard.test.ts` parses the migrations and asserts that
every table enables RLS and has a policy, that no function is `SECURITY
DEFINER`, that the enforcement indexes and triggers still exist, that the
activation trigger covers the update path and is `FOR EACH ROW`, that the audit
trail has no update or delete policy, and that only registered rule codes are
raised.

Registry parity is checked the same way: `tests/unit/registry-parity.test.ts`
parses the seed out of the migration rather than querying Postgres, so the Rules
page can never silently disagree with what is enforced, even in an environment
with no database.

These are a floor, not a substitute. Only `npm run test:db` demonstrates that a
second active mission is actually refused.

### test:db skips rather than fails without a database

`npm run verify` must be runnable on a machine where the local stack is not up,
so the runner reports a loud SKIPPED banner and exits zero. That is a real gap
rather than a pass, so it says so in those words, and `CONTINUUM_REQUIRE_DB=1`
turns a skip back into a failure — which is what any pipeline gating a release
should set.

### Blocker: Docker Desktop cannot start its engine

The adversarial suite has never been executed, because Docker Desktop on this
machine fails during service startup:

```
starting services: initializing Inference manager: listening on
unix://...\Docker\run\dockerInference: remove ...\dockerInference:
The file cannot be accessed by the system
```

`dockerInference` is present as a directory entry but cannot be stat'd — an
orphaned Unix-socket reparse point. Docker Desktop cannot remove it, so startup
aborts, the engine's named pipe never appears, and image pulls hang forever.
Network connectivity from the WSL VM was verified as working, so this is not a
firewall or proxy problem.

The remedy is outside the project directory and belongs to the machine's owner.
Until it is resolved, every database-level claim in this repository is written
but unverified.

---

## 2026-09-09 — The invariant suite runs, and what it caught

The Docker blocker is resolved. Two separate faults were involved: a stale
`dockerInference` socket that aborted service startup, and a WSL integration
error against a distro running WSL 1, which the proxy does not support. The
second is noisy but harmless — it concerns running `docker` from inside that
distro, not the engine — so the engine came up once the socket was cleared.

All six SQL files pass. Getting there required fixing four real defects, three
of them in the tests rather than the schema, which is the outcome the harness
was designed to produce: it refused to let a broken test look like a passing
one.

### Schema bug: the audit trigger assumed a column name

`record_audit_event` referenced `new.status` directly. Curiosities track their
lifecycle in `state`, so every update to a curiosity failed with
`record "old" has no field "status"` — including the one inside
`promote_curiosity_to_mission`, which meant RULE-007's own promotion path was
broken. Static analysis could never have caught this: the function compiles
fine and only fails when a trigger fires on a table that spells the column
differently.

The lifecycle column is now passed as a trigger argument and read through
`to_jsonb`, so a table can name it whatever it likes.

### The suite was not idempotent

`psql --single-transaction` COMMITs on success. The first run therefore
committed its fixtures and the `tests` schema, and the second run failed on
duplicate users. Each script is now wrapped in an explicit transaction that
always rolls back, so a run leaves nothing behind — no fixtures, no test users,
no test schema in the database.

### Row level security refuses UPDATE and DELETE silently

This one is worth remembering, because it is easy to get backwards. A table
with RLS enabled and no UPDATE policy does not raise on an UPDATE: the rows are
simply invisible to the statement, so it succeeds and affects zero rows. Only
INSERT produces an actual error (42501), because there is no row to hide.

Tests asserting that `audit_events` and `rules` are immutable were therefore
written wrongly — they expected an error and got success. The protection was
real the whole time; the assertion was measuring the wrong thing. There is now
an `assert_no_rows_affected` helper for exactly this case, paired with a
follow-up assertion that the rows still exist, so "zero rows affected" cannot be
confused with "the table was empty".

### The rule code lives in DETAIL

`assert_refused` compared the expected value against the SQLSTATE and the
message, but `raise_rule_violation` puts the rule code in DETAIL so that every
hard rule can share one SQLSTATE and still be told apart. The helper now checks
DETAIL too.

### RULE-007 is asserted from the catalogue

The original test called the function with an extra `status` argument and
expected a refusal. The helper correctly rejected that as a BROKEN TEST: an
undefined function signature is a broken statement, not the database refusing an
operation. The rule rests on the function's shape, so it is now asserted against
`pg_proc` — exactly one overload, and no argument whose name contains "status".

### The suite is demonstrably able to fail

Verified rather than assumed, per the testing doctrine:

- run twice in a row: green both times, so the rollback works
- drop `missions_one_active_per_user`, and `020` fails with "expected the
  database to refuse, but the statement succeeded: a second mission cannot be
  activated while one is already active"
- `npm run db:reset` restores it, and the suite returns to green

The same was done for the TypeScript side: changing RULE-003's severity in the
registry makes the parity test fail against the migration seed.

---

## 2026-09-09 — Milestone M6: single-user authentication

Built and verified against the local stack. 16 end-to-end tests pass on desktop
and mobile viewports; `npm run verify` is green.

### The cloud project was never a prerequisite

M6 was originally written as blocked on creating a Supabase cloud project. That
was wrong, and checking rather than assuming saved the wait: the local stack
already runs Supabase Auth with Mailpit capturing outbound mail, so the entire
flow builds and tests locally. A cloud project is needed to deploy, not to
develop, and that work moved to M6-cloud immediately before the first
deployment.

### Password, not magic link

This is a daily-use tool. A mail round-trip on every sign-in is exactly the kind
of friction the product exists to remove, and it also makes the end-to-end
deterministic. Recorded rather than assumed, and reversible.

### Next.js 16 renamed middleware to proxy

`middleware.ts` is deprecated in favour of `proxy.ts`, and the exported function
is renamed too. The proxy runtime is Node.js and is not configurable; edge is
unsupported there. Every Supabase SSR guide still describes `middleware.ts`, so
this would have been written wrongly from memory. The framework ships its own
docs under `node_modules/next/dist/docs/`, which is where this came from.

### No SECURITY DEFINER for profile creation

The canonical Supabase pattern is a definer trigger on `auth.users`. Avoided:
the profile row is created by the application on first sign-in, as the user,
through an ON CONFLICT DO NOTHING insert that row level security checks. The
schema therefore still contains zero privileged functions, which is what makes
the migration guard a bright line rather than a list of exceptions.

### Sign-out is local scope

`signOut()` defaults to global scope and revokes every refresh token the user
holds anywhere. Signing out on the desktop would also end the session on the
phone, which is wrong for a tool expected to be open in more than one place.
The parallel end-to-end tests surfaced this as two failures that looked like
flake and were not.

### `[auth.email] enable_signup` does not mean what it says

The most expensive finding of this milestone. Setting it to `false` disabled
email as an authentication **provider** — existing users could no longer log in
at all, not merely register. The CLI maps it to `GOTRUE_EXTERNAL_EMAIL_ENABLED`.

Registration is blocked by the top-level `[auth] enable_signup = false`, which
maps to `GOTRUE_DISABLE_SIGNUP`. Both properties are now asserted directly
against the running service: a password grant succeeds, and `/auth/v1/signup`
returns `signup_disabled`. The reasoning is recorded in `config.toml` itself, so
nobody flips it back on a plausible-sounding reading of the name.

### Creating an auth user by hand needs two undocumented details

The end-to-end fixture cannot register, since sign-up is disabled, so it writes
the user directly. Two things fail confusingly if missed:

- The password must be a real bcrypt hash. The SQL suite's helper uses an inert
  one, which suffices for `auth.uid()` but cannot authenticate.
- The token columns must be empty strings, not NULL. Auth scans them into a
  non-nullable string and answers a login attempt with "Database error querying
  schema", which reads like a broken database rather than a malformed fixture.

Both were found by experiment against the running service.

### Login does not reveal whether an account exists

One message for every failure. Distinguishing "no such account" from "wrong
password" turns the form into a way to enumerate registered addresses. A test
asserts the two cases produce identical text.

### The redirect target is validated

`?next=` is honoured only for same-origin relative paths. An absolute URL would
make the login form an open redirect, bouncing the user to an attacker's page
carrying the trust of having just authenticated.

---

## 2026-09-09 — Milestone M7: application shell

Seven areas, a persistent rail on desktop and a drawer on small screens. 78 unit
tests and 30 end-to-end tests pass across desktop and mobile viewports.

### Two silent framework defaults, found by looking rather than reasoning

Neither produced a console error, and neither would have been caught by reading
the code.

**Next blocks cross-origin dev resources, and treats `127.0.0.1` as a different
origin from `localhost`.** The dev server binds `localhost`; the end-to-end
tests address it by IP, which is more deterministic than a hostname that may
resolve to `::1`. The result was that `_next` dev resources were refused, the
client bundle never loaded, and **nothing on the page hydrated** — silently.
Server-rendered links still worked, so most tests passed; only the drawer, which
needs JavaScript, failed. `allowedDevOrigins: ["127.0.0.1"]` fixes it.

The diagnosis came from opening the page and checking whether any DOM node
carried a React fiber key. Exactly one did: the devtools overlay. That is the
kind of thing a test suite reports as "element not found" and a person reports
as "the menu button does nothing".

**The proxy matcher excluded `_next/static` and `_next/image` but not `_next`
itself.** Framework internals live under that prefix too. This was not the cause
of the hydration failure, but running an auth redirect across framework routes
is wrong regardless, so the exclusion now covers the whole prefix.

### Navigation is data, and the tests hold it to seven

`NAV_ITEMS` is a single typed list. Tests assert there are exactly seven, that
each has a label in the string map, that each route resolves to a real page
file, and that each has a title and description. A navigation entry that 404s is
worse than one that does not exist.

### Content-class colours are for content, never chrome

The active navigation item uses neutral emphasis rather than the mission colour.
If chrome borrowed those colours, mission-level weight would stop meaning
anything when it appeared on something that actually is a mission.

### The hardcoded-string guard is mutation-tested

A test walks every `.tsx` file under `app/` and `components/`, failing on
literal text between JSX tags or in `aria-label`, `placeholder`, `title` and
`alt`. It was verified by injecting a literal into a real component and watching
it go red, then reverting — a guard that cannot fail is worse than none, and
regex-based guards fail that way easily.

### Sign-out moved to Settings

It was on the dashboard, which is reserved for what is being worked on right
now. The end-to-end tests were updated to follow rather than being pinned to the
old location.

### Two accessibility details the tests would not have caught alone

The drawer overlay was originally a labelled button, which meant "Fechar menu"
resolved to two controls. It is now hidden from assistive technology, leaving
the X button and Escape as the accessible paths.

The "close on navigation" effect was removed rather than kept: link clicks
already close the drawer, and setting state from an effect to react to a render
causes a second render pass for something the click already knew.

### Looking at the result changed it

Screenshots showed the dashboard heading reading "Missão" directly beside a
badge reading "MISSÃO". Every test passed. The heading is now "Missão atual".

---

## 2026-09-09 — Milestone M8: direction, campaign and cycle

101 unit tests, 6 SQL invariant files and 35 end-to-end tests pass.

### The invariant guard earned its place

Running the procedure before writing any code caught a defect that would have
shipped silently. `cycles_one_active_per_user` was mapped to RULE-005 in the
constraint table, so a person opening a second **cycle** would have been shown
RULE-005's message — which talks about **missions** being activated in the wrong
cycle. The refusal would have been correct and the explanation nonsense.

The index is a precondition for RULE-005 rather than RULE-005 itself, so it now
resolves to its own message. Recognised database errors are therefore of three
kinds, not two: a rule violation, a named constraint that is not one of the
seven rules, and a not-found.

A unit test now asserts the cycle message mentions cycles, is _not_ RULE-005's
text, and leaks no SQL.

### No read-then-write before opening a cycle

`openCycleAction` does not check for an existing active cycle before inserting.
The partial unique index answers that atomically; checking first would be racy
and would put the rule in two places, the weaker of which would eventually drift.

### The cycle bar shows time, and says so

Days remaining leads. The elapsed bar is drawn in the maintenance colour rather
than the mission colour, and is labelled "% do tempo do ciclo decorrido".

A bar that fills as the month passes looks exactly like a progress bar for work
done. Left unlabelled it would quietly turn the calendar into a score, which is
the opposite of the rule that hours are an input metric. The distinction is
invisible to a test and obvious in a screenshot.

### Editing is a disclosure, not a page

Directions and campaigns are edited through a `<details>` block in the list.
Keeps the list readable, avoids a route per record, and works before hydration —
which matters for a form whose purpose is to fix something.

### Ownership is enforced by the schema, not by the form

The campaign form offers only the user's active directions, but that select is a
convenience. The composite foreign key on `(direction_id, user_id)` is what
makes attaching a campaign to someone else's direction impossible, so a tampered
form value is refused by the database rather than trusted.

### Archiving, never deleting

A direction that shaped past campaigns is part of the record of what was pursued
and why. Deleting it would rewrite that history; the status column preserves it.

### A clever test replaced with a deterministic one

The refusal was first driven from two browser tabs: open a cycle in one, submit
the stale form in the other. It failed intermittently, and the page snapshot
showed the second tab's form re-rendered from scratch with the error discarded.

Before treating that as a product bug, the case was reproduced by hand: load the
dashboard, insert a conflicting cycle underneath it, submit. The message
rendered correctly and the form kept its place. The application was right; the
test was measuring cross-tab router-cache behaviour rather than the refusal.

It now provokes the conflict by changing the database under a loaded page, which
is both deterministic and closer to what actually happens to a person.

### Data-mutating end-to-end tests run serially, on one project

The suite runs against two viewports. These tests mutate shared per-user state,
and the single-active-cycle rule means two concurrent runs would fight over the
one slot and fail in ways that look like bugs. They are serial and chromium-only,
with the reason recorded in the file.

---

## 2026-09-09 — Milestone M9: mission lifecycle and enforcement UX

### No migration, and why that is the right answer

M9 added no SQL. RULE-001, RULE-002, RULE-003, RULE-005 and RULE-006 were
already enforced by `20260908170500_missions.sql` — a partial unique index, two
`BEFORE INSERT OR UPDATE ... FOR EACH ROW` triggers and a check constraint — and
`020_mission_invariants.test.sql` already attempts each violation on both the
insert and the update path, including a multi-row update, with positive
controls. The milestone was the interface catching up to enforcement that
existed. The bypass audit confirmed no new bypass path: every write goes
through RLS-scoped inserts or `activate_mission()`, which is SECURITY INVOKER.

### Status is never an input

`missionSchema` has no status field and `createMission` passes none. A mission
enters the world as a draft and reaches `active` only through the RPC, where the
triggers can see the criteria list and the active cycle. This is the single
assumption RULE-001, RULE-002 and RULE-005 all rest on, so a unit test asserts
the schema's exact key set — a future field named `status` fails the suite rather
than quietly making three rules optional.

### The activate button is offered even when it cannot succeed

A draft mission shows "Ativar missão" whether or not another mission is running.
Hiding or disabling it was rejected twice over. It would make RULE-001 invisible
— the user would see a missing button and read it as a limitation of the
interface rather than the commitment it is — and it would move the block into the
UI, where the roadmap's own failure mode says it must not live. The refusal is
the moment the milestone exists for, so it happens in the open, with the rule
named, the reason it exists stated, and the parking lot offered as the way
forward. The end-to-end test clicks that button and then asserts _in SQL_ that
exactly one mission is active.

### A schema failure that mirrors a hard rule speaks that rule's language

Submitting a mission with no Definition of Done is caught by Zod before the
database sees it. Reporting that as "algo não funcionou" would hide a rule the
user is entitled to see explained, so `ruleForIssuePath` maps the failing field
back to RULE-002 or RULE-003 and the interface renders the same explanation it
would have rendered for a database refusal. To the person in front of it these
are the same event, and they are recorded in `rule_events` alike.

### Rule events are written by the server action, not by a trigger

A refusal aborts its own transaction, so anything the database wrote while
refusing would roll back with it. The event has to be recorded afterwards, by
whoever is still standing. `recordRuleBlock` ignores its own failure: losing the
bookkeeping is much the lesser loss compared with replacing the explanation the
user is waiting for.

### RULE-101 fires only when _no_ criterion is verifiable

The advisory's own words are "esta missão ainda não possui um critério de
conclusão verificável". With one good criterion sitting beside one vague one that
sentence is simply false, so the mission-level note stays quiet and a much
quieter per-criterion hint carries the observation instead. Firing it per
criterion would have made the system say something untrue.

The heuristic deliberately under-flags. A missed vague criterion costs silence; a
wrongly flagged good one costs nagging, and a system that nags about prose is one
the user starts ignoring — which is how an advisory dies. Consumption nouns
(aula, capítulo, página, módulo) are excluded from the artefact list on purpose:
"assistir às aulas" names something countable but no outcome, and treating it as
verifiable would let the advisory bless exactly the criterion it exists to
question. Stems are matched only at a word start, because "lab" inside "trabalho"
would be the worst available false positive.

A test asserts RULE-101 is still registered ADVISORY and that the module contains
no `throw`. Hardening this into a gate is the failure mode the roadmap names, and
every individual step towards it looks like an improvement.

### Hours in, minutes stored, and never one number

Loads are entered in hours (accepting the decimal comma a pt-BR keyboard
produces) and stored as minutes. The 744-hour ceiling is a typo guard, not a
rule: it is the number of hours in the longest possible month. The database has
no such bound and must not grow one.

Minimum and target are always rendered as two separate named figures, never as a
bar and never as a percentage. A single number would have to be a ratio against
the target, and a ratio against the target is precisely the "more hours is
better" reading the product refuses.

### Creation is two statements with a compensating delete

Criteria need the mission's id, so creation cannot be one insert. If the criteria
insert fails, the mission row is deleted rather than left behind: a draft with no
Definition of Done cannot be activated and gives the user nothing to diagnose.
Doing it atomically would mean a new RPC, and write paths into `missions` are not
worth adding casually.

### The cycle is shown, not chosen

The create form binds the mission to the open cycle and displays it read-only.
RULE-005 binds activation to the active cycle, so a picker would mostly be an
opportunity to build something that cannot be started — and choosing next month's
mission during this month is the behaviour the rule exists to prevent. The value
is still sent and still checked: the composite foreign key refuses another user's
cycle, and RULE-005 refuses the wrong one at activation.

### The end-to-end suite runs on one worker

Adding a second data-mutating spec made the existing arrangement unsound. The
application is single-user and its rules are one-at-a-time — one active cycle,
one active mission — so two spec files running concurrently fight over the same
slot and fail in ways that look like product bugs. The suite cannot be more
parallel than the domain it tests.

`hierarchy.spec.ts` now deletes missions before cycles and campaigns. They are
referenced ON DELETE RESTRICT, so a mission left behind by the mission spec would
make that cleanup fail rather than clean.

### The copy guard flagged code, and the code moved

`i18n-coverage` scans for text between an angle bracket pair, which reads a
trailing arrow-function expression sitting immediately before a `return (` as
hardcoded copy. Four new files tripped it. The guard was left alone and the code
changed — named helpers with block bodies — because weakening a check that
protects the product's tone to accommodate a formatting accident is the wrong
trade. The helpers read better anyway.

### `next-env.d.ts` moved to `.next/dev/types`

Regenerated by this version of Next on `dev`. Committed with the milestone so the
tree stays clean; it is generated and must not be hand-edited.

---

## 2026-09-10 — Milestone M10: sessions and progress

### Overlap is a locked trigger, not an exclusion constraint — owner's call

The idiomatic answer is `exclude using gist (user_id with =, tstzrange(...) with
&&)`, which needs the `btree_gist` extension for the uuid equality. It is
available locally but not installed, and enabling an extension the milestone
did not list is a stop condition in the working agreement. The same guarantee is
met without it: `enforce_mission_session()` takes a transaction-scoped advisory
lock keyed on the user, then checks for an overlapping period. A concurrent
writer for the same user blocks until the first commits, and under READ
COMMITTED the check that follows takes a fresh snapshot and sees the committed
row.

**Revisit if** the owner is content to enable `btree_gist` (it is a standard
contrib extension, available on Supabase cloud). A forward migration would then
add the exclusion constraint and drop the lock and the `exists` check. The SQL
suite would not need to change — it asserts refusals by name, and the constraint
could keep the name `mission_sessions_no_overlap`.

### A second guard that turned out to matter

A partial unique index, `mission_sessions_one_running_per_user`, sits beside
the trigger. It is implied by the overlap check — two open-ended periods always
overlap — and was added as belt and braces. The red check for this milestone
disabled the overlap check in the live database, and the suite went red
_because the index still refused the second running session_. It holds on its
own, which is the point of declaring the one case a forgotten tab makes likely.

### Sessions only on the active mission

Not in the acceptance criteria, and not a new registry rule: derived from two
that exist. Time logged against a draft is time on a track never committed to —
the parallel work RULE-001's rationale names — and time added to a completed,
revised or abandoned mission would edit a record RULE-006 says is final. The
trigger refuses the insert.

Only the insert. A session already running when its mission leaves `active`
must remain stoppable, or completion would strand a timer that can never end.
`mission_id` is immutable on update, so hours cannot be moved onto a mission
they were not spent on.

**Left for M11:** what `complete_mission()` does with a session still running
at completion, and whether a completed mission's finished sessions become
read-only. Both belong with completion, which the M10 fence excludes.

### One clock for every instant

The timer never sends a time. `started_at` defaults to the database's `now()`,
`stop_mission_session()` stamps the end with `now()`, and the future check
compares against `now()`. Mixing in `clock_timestamp()` anywhere would let a
timer trip its own future check, and letting the application server send times
would let clock drift produce negative or inflated durations.

### The trigger must step aside for the check constraint

The SQL suite caught this. A backwards period reached the overlap query, where
building a `tstzrange` from it raised `22000 range lower bound must be less than
or equal to range upper bound` — before `mission_sessions_period_valid` could
refuse it, because BEFORE triggers run ahead of check constraints. The person
would have seen the generic fallback instead of an explanation. The trigger now
hands such a row on to the constraint.

### Refusals carry a constraint name, not a rule code

None of the session refusals is one of the seven rules. The trigger raises with
`USING CONSTRAINT = ...` and puts the same name in the message, so
`lib/rules/errors.ts` recognises them exactly as it recognises a real check
constraint, through `NAMED_CONSTRAINTS`, and each has its own pt-BR explanation.
Giving them rule codes would have meant inventing rules to fit an error format.

When _starting_ a session, the only thing a new open-ended period can collide
with is one already running, so the start action rephrases an overlap as "já
há uma sessão em andamento". The general sentence would be true and would
explain nothing.

### Timezones: the browser converts, the browser formats

`profiles.timezone` defaults to `'UTC'` and nothing sets it, so the server
cannot know which timezone a person means. Two consequences:

- A manually logged session is entered as a local date and time and converted
  to an absolute instant in the browser, where that timezone — with that date's
  daylight-saving rule — is known. The schema refuses a timestamp without an
  offset, so a form that forgot to convert fails loudly.
- Wall-clock times are formatted in client components. `useSyncExternalStore`
  returns null on the server and during hydration, so the first client render
  matches the server's and React then fills in the local value.

Durations are differences between instants and need neither. The end-to-end
spec runs in `America/Sao_Paulo`, logs 09:00, and asserts the stored instant is
12:00 UTC.

Setting `profiles.timezone` from the browser would let server components format
times too. Not done: it is a settings feature, and nothing else needs it yet.

### Load progress has no bar, no percentage, no target countdown

Three figures — logged, minimum, target — in the neutral chrome, labelled as an
input metric, placed after the Definition of Done wherever they appear. A
distance is shown to the minimum, because the safe floor is worth knowing about.
None is shown to the target and nothing is shown beyond it: a countdown towards
an ambition, or a surplus past it, turns an input metric into a score. At the
target, RULE-102's own sentence says that this finishes nothing.

A unit test asserts `LoadProgress`'s exact key set and that none of its numbers
is a fraction, so a convenient `percent` field fails the suite before any screen
can draw it.

### The dashboard leads with output

The current mission shows, in order: how many Definition-of-Done criteria are
satisfied, the timer, then hours. Nothing can satisfy a criterion until M11, so
the first line reads "0 de N" for now; it is there so that hours are never the
only progress-shaped thing on the screen.

### The timer needs no babysitting

The start lives in the database, so closing the tab, reloading or switching
devices changes nothing. The display ticks every thirty seconds, since it shows
minutes and a per-second counter invites watching. A forgotten timer is
corrected by discarding it — deleting the running session — and logging the real
period by hand. The database sets no maximum session length, deliberately: a cap
would turn a forgotten timer into a refusal to stop it. The 24-hour limit on
manual entry is a typo guard in Zod only.

A running session is excluded from logged totals: a figure that changes while
you read it is not a record yet.

### Manual entry is a start and a duration

Not a start and an end: a duration cannot be entered backwards, and a session
crossing midnight needs no special case. `hoursAsMinutes` is now exported from
the mission schema and shared, so the decimal comma is parsed in one place.

### M9's hours printed with a full stop

`minutesToHours` returns a number, and interpolated into JSX it prints "1.5".
Whole-hour loads hid it; session totals would not. `formatHours` formats for
pt-BR and the mission card and detail page now use it.

---

## 2026-09-11 — Milestone M11: evidence, Definition of Done, completion

> **Verification pending.** Written, and green on everything that runs without a
> database: 186 unit tests, lint, format. Nothing database-backed has run —
> `db:reset`, `db:types`, `test:db`, `build`, `test:e2e`. Docker lost the ability
> to start its WSL 2 engine on the Windows machine mid-milestone, because WSL 2
> is disabled there by an enterprise policy. The migration below has therefore
> not been applied anywhere yet. `docs/status.md` has the resume steps.

### "All criteria satisfied" is a HARD rule: RULE-008

Deferred here from M3, and decided with the owner. The database refuses
completion unless the mission comes from `active` and has at least one criterion
and none open. It is a trigger on `missions` covering INSERT and UPDATE, not a
check inside `complete_mission()`: before M11 that RPC checked nothing, and a
direct `UPDATE` could complete a mission — straight from `draft`, and with zero
criteria. An RPC-only rule would have been decoration.

It has a registry entry, a seed row in a new migration, pt-BR copy, and a line
in the invariant table, which now lists eight. The Rules page (M13) will
show it, since it reads the `rules` table.

### RULE-006 now freezes the whole record, at the storage layer

"Completed missions render read-only" was a statement about the interface. M11
makes it a database fact. One trigger function, `enforce_mission_record_frozen()`,
refuses every write to a finished mission's criteria (insert, update and
delete), evidence (update and delete; insert is refused by the evidence trigger,
in RULE-006's words) and sessions (update and delete). "Finished" means
completed, revised or abandoned — the terminal states RULE-006 already covered.
On update both the old and the new mission are checked, so a row cannot be moved
off a finished mission either.

Delete is guarded because removing a criterion rewrites a Definition of Done as
surely as editing one.

A mission being deleted should be invisible to its children's triggers by the
time the cascade reaches them, so the freeze is not expected to block the
cascade; the end-to-end resets exercise exactly this, and it is among the checks
still pending. Whether a finished mission should be deletable at all is a
separate question — `missions_delete_own` has allowed it since M3 — and belongs
with M15, where history is designed.

### A timer does not outlive its mission

Resolves the question M10 left open. When a mission leaves `active`, a BEFORE
UPDATE trigger on `missions` closes any session still running on it, at that
moment. BEFORE, so the frozen-record trigger on sessions still sees an active
mission and lets the close through; if a later guard refuses the transition, the
whole transaction rolls back and the timer keeps running. A session begun in the
same transaction has no length yet, and is removed rather than stamped with a
zero duration that the period check would refuse.

### Criteria are satisfied only while the mission is live

Through `set_criterion_satisfied()`, which stamps the database clock like every
other instant. Refused on a draft (named constraint) and on a finished mission
(RULE-006); a criterion also cannot arrive on a draft already satisfied.
Unmarking is allowed while active: realising a criterion was not met is honest,
and should cost no more than claiming it.

### Evidence is optional per criterion, and nothing requires it

The acceptance criteria say evidence attaches "optionally to a specific
criterion", and RULE-008 requires satisfied criteria, not evidence. Requiring
evidence per criterion, or at least one per mission, was considered and
rejected: it would make recording output cost more than recording hours, which
is backwards for a product whose argument is that output matters more. Linked
evidence is shown beside each criterion instead, where its absence is visible.

A cited criterion must belong to the same mission, by composite foreign key on
`(criterion_id, mission_id)`, which needed `unique (id, mission_id)` on the
criteria. Removing a criterion un-cites its evidence rather than deleting it —
`on delete set null (criterion_id)`, Postgres 15 or later — because the output
still exists. Links are http and https only, by check constraint, by Zod, and by
a render-time guard: a link is the one piece of user input the product turns
into something clickable.

### Completion is offered only when ready; the server is still what is tested

Unlike RULE-001's activate button (M9), the complete button is not shown until
every criterion is satisfied: the acceptance criteria say "offered only when",
and the reason it is unavailable is always on screen, as the open criteria by
name. The block is still proven where it is real. The end-to-end spec draws the
page with everything satisfied, reopens a criterion underneath it, and presses
the button: RULE-008's explanation must appear, the page must redraw naming the
open criterion, and `rule_events` must record the block.

### Finishing stops the interface

On completion the mission page shows MISSÃO CONCLUÍDA — adding "o ciclo ainda não
terminou…" while the cycle is running — and stops. The loads leave its facts,
and hours render as a bare record with no minimum, target or "faltam": "12h of a
24h minimum" beside a finished mission reads as having fallen short (RULE-103).
The dashboard, which would otherwise fall back to an empty state inviting the
person to activate something, shows the completed mission instead.

The cycle panel keeps its days remaining. Beside "there is nothing left to do
here", it reads as how long the person is free rather than as a deficit.

### Registry parity reads every seed

Migrations are forward-only, so a rule added later arrives in a later file. The
parity test read only the first seeding INSERT; it now unions every seed, in
migration order, and asserts each rule is seeded exactly once.

### Existing positive controls take the new legitimate path

`020` and `050` completed missions whose criteria were never satisfied. RULE-008
now refuses that, correctly, so both satisfy the criteria first. The refusals
they assert are unchanged.

### The copy guard, again

Four more false positives — nested JSX ternaries, a generic on `Promise.resolve`,
a component with two returns — fixed in the code rather than in the guard, as
M10 recorded.

---

## 2026-09-11 — Milestone M13: rules page and reflection UX

> **No-database phase.** Written and unit-tested only; `build`, `test:e2e` and
> any visual check are pending (see the verification debt in `docs/status.md`).
> M13 changes no schema: it reads `rules` and `rule_events` and calls
> `review_mission()`, all of which exist since M4–M5 and are proven by the `030`
> and `040` suites.

### Why M13 before M12

Decided with the owner when Docker became unavailable. M12's acceptance
criterion 4 — promotion only at a cycle boundary, verified server-side — needs a
new rule inside `promote_curiosity_to_mission()`, which means a migration, and
"cycle boundary" has no definition yet, which is a data-model decision. Neither
belongs in a phase where SQL cannot run. M13, M14 and M15 need no schema change.

### The page trusts the table, and only where both sources agree

Severity and enforcement level come from the `rules` row, not from
`registry.ts`: the acceptance criterion is that the page cannot claim a
protection that does not exist, and the table is the record of what exists. A
row marked inactive is hidden; a registry rule absent from the table is not
shown; a table row this application has no copy for is skipped rather than
rendered with invented text. `rulesToDisplay()` in `lib/rules/rule-display.ts`
does this, purely, and is tested case by case — including the table overriding
the registry.

### Three levels, three looks; severity stays quiet

HARD is a solid badge, SOFT outlined in the warning colour, ADVISORY dashed and
muted like the advisory note on a mission. Severity is deliberately not colour
coded: it says how much a rule matters to the product, not how alarmed the
reader should be, and a page of red badges would read as a list of threats.

### Recent events are a glimpse, not a log

The last three per rule, taken from the most recent 200 overall. The full record
is M15's page. Dates are formatted client-side in the reader's timezone, as
everywhere since M10.

### The review is collapsed, asks first, and has no default

The reflection prompt lives in a closed disclosure at the bottom of an active
mission: a permanently open "leave this mission" form would be an invitation.
Opened, it asks "você está mudando a regra ou tentando escapar dela?", says what
is and is not a reason to stop, and offers the parking lot before any field.
The outcome — keep, revise, end — has no default: keeping is recorded as a
decision too, and it is what `computeIntegrity()` counts as `reviewsKept`. The
submit button is quiet, so ending a mission is never the most prominent thing on
its page.

Keeping changes nothing visible, so that path answers with an explicit
"revisão registrada"; revising or ending redraws the page as a finished mission,
which is its own confirmation. The action's `recorded` flag lives in a local
`ReviewState` rather than in the shared `ActionState`.

### Specific messages, in the product's language

A missing outcome, a missing category and a short justification each get their
own message — from the schema first and, through three new `NAMED_CONSTRAINTS`,
from the `mission_reviews` constraints if the form is ever bypassed. The
textarea deliberately has no `minLength`: the browser would have answered in its
own words, before ours.

---

## 2026-09-14 — Milestone M14: knowledge notes and links

> **No-database phase.** Written and unit-tested only; `build`, `test:e2e` and a
> visual check are pending (see the verification debt in `docs/status.md`). M14
> changes no schema: `knowledge_notes` and `knowledge_links` exist since M5 with
> row level security, and their generated types were already present.

### A schema defect, found by reading rather than by running

`knowledge_notes_mission_same_owner` (M5) is a composite foreign key over
`(mission_id, user_id)` with `ON DELETE SET NULL`. Postgres nulls every
referencing column, so deleting a mission that has notes tries to set `user_id`
— which is `NOT NULL` — to null, and the delete fails. Nothing in the interface
deletes missions yet, but the end-to-end resets do.

The fix, once a database exists, is a migration changing it to
`ON DELETE SET NULL (mission_id)` — the form M11 used for evidence — with an SQL
test that deletes a mission carrying notes. Until then `knowledge.spec` deletes
its notes before and after every test, so it cannot break the next spec's reset.
Recorded in the verification debt.

### Search runs in memory

Title and content, every word required, case- and accent-insensitive, filtered
by type, newest first. This is one person's notes. Doing it in TypeScript means
no user text is ever spliced into a PostgREST `or` filter, where a comma or a
parenthesis would change what the query means; a full-text index would be the
scalable version, and a migration. Revisit if the notes outgrow a page. The
search is a plain GET form, so it works before hydration and the URL can be kept.

### A link is stored once and read from both ends

"Ligações" on the note that made it, "Referenciada por" on the note it points
to. Nobody creates the reverse link, so the two sides cannot disagree, and either
end can remove it. Lookups are two plain equality queries rather than an `or`
filter assembled around an id.

### A note from a mission, with a fixed origin

"Criar nota a partir desta missão" opens the note form already bound to the
mission — that is the one action; the note still needs a title and content, the
only two required fields. The origin is part of the record: the edit schema does
not accept it.

The link appears on draft and active missions only. A completed mission lists
its notes as part of its record but offers no new action beneath MISSÃO
CONCLUÍDA (RULE-103); a note written afterwards can still be created from the
Knowledge area.

### Nothing requires a note

No prompt, reminder, count or encouraging empty state anywhere; a unit test
scans the knowledge copy for demanding phrasing. The note submit is quiet —
knowledge is never styled like the mission.

### Deliberately not done

No graph, no tags, no AI summary: the scope fence. No delete for notes either:
it was not in the acceptance criteria, and a Zettelkasten loses more to an
accidental deletion than to clutter. Editing is included, because a note that
cannot be corrected stops being trusted.

---

## 2026-09-14 — The verification debt, paid: M11, M13, M14

Docker Desktop started again on the Windows machine, and the three milestones
written without a database were verified together, in the order the debt
recorded: `db:reset` (the M11 migration applied for the first time),
`db:types`, `CONTINUUM_REQUIRE_DB=1 npm run verify`, the full end-to-end suite,
and a look at every new screen.

Final numbers: 233 unit tests, 9 SQL invariant files, 61 end-to-end tests (33
skipped: the mobile project does not run data-mutating specs), production build
clean. `060` and `070` passed on their first execution.

### What running it found

- **`040` still counted ten rules.** RULE-008 made it eleven, eight of them
  HARD. The count was updated and an explicit check that RULE-008 is seeded as
  an active hard rule added, so the test asserts the rule and not only a number.
- **Two end-to-end locators were ambiguous** — a type label that also appears
  as an option in the collapsed edit form, and `role="alert"` that also matches
  Next's route announcer. Test defects; fixed in the tests.
- **The review form lost its fields after a server-side refusal.** React 19
  resets a form's uncontrolled fields after every action, a refused one
  included. A justification one character short wiped the decision and the
  category, and the browser's `required` then blocked the resubmission. The
  review form now uses controlled fields. The same pattern affects other forms
  and is recorded as a known issue in `docs/status.md`.
- **The knowledge-note key defect** found by reading in M14 is fixed by
  `20260914172741_knowledge_note_mission_fk` (`ON DELETE SET NULL (mission_id)`)
  and proven by `070`: a mission with notes can be deleted, the notes survive
  with their owner, and a note still cannot cite another user's mission.

### What the phase taught

Nothing that was written blind was wrong in its logic: the new SQL suite passed
first time, and so did every M11 and M14 end-to-end test once its locators were
unambiguous. What only running could find was the interaction between parts —
a count elsewhere that a new rule changed, and a framework behaviour (the form
reset) that no unit test can see. That is the argument for the phase's rules:
write no SQL blind, keep the debt visible, and pay it at the first chance.

---

## 2026-09-14 — The form-reset known issue, closed before M15

The owner chose to close the known issue recorded above — forms losing their
fields after a server-side refusal — before starting M15, rather than carrying
it to M18. No invariant, RPC or migration is touched; this is UI only, so the
bypass audit does not apply.

The review form (M13) already established the pattern: controlled fields, so
React 19's post-action form reset (which fires on every settled action,
refusal included, and is not limited to uncontrolled fields the way the
original note in `docs/status.md` assumed) has nothing to touch. The same
pattern is now applied to the remaining forms named in the known issue —
`mission-form.tsx`, `evidence-form.tsx`, `note-form.tsx`, `session-log-form.tsx`
— plus the M8 hierarchy forms, `direction-forms.tsx` and `campaign-forms.tsx`,
which the note also named but M9–M14 never revisited.

Forms that stay on the same page after a successful submission (evidence,
manual session log, the direction and campaign "create" forms) now clear
themselves only on success, tracked via a `pending` transition rather than
comparing `state` — the shared `OK` object is one constant reference, so a
successful action is not a new value to diff against. Forms that redirect on
success (mission create, note create) need no such handling; the edit-in-place
forms (direction, campaign, note update) simply keep the controlled value,
matching what was just saved.

**A second, sharper defect surfaced only by clicking through it in a browser:**
a controlled `<select>` is not defended by React the way a controlled text
field is. React re-applies a text field's `value` on every render regardless,
but a `<select>`'s DOM selection can be silently reset by the same post-action
mechanism without React's controlled `value` prop forcing a re-sync — because
nothing about the component's own state changed, React has no reason to
recommit that node. Concretely: the evidence form's "critério" select reverted
to "nenhum critério específico" after a refused submission, even though
`criterionId` was still held in state and the description and link survived
correctly right next to it. No unit test catches this — it needs a live DOM.

Fixed the same way in all four affected selects (mission's campaign, evidence's
criterion, the note's type, the campaign form's direction): a `key` bumped by
its own effect on every `pending` → idle transition, forcing the select to
remount and re-apply the controlled value fresh. Kept as a separate effect from
the "clear on success" one after `eslint-plugin-react-hooks`'s
`set-state-in-effect` rule flagged the combined version — nested conditionals
ending in a trailing unconditional `setState` read as a cascading-render risk
to the rule's static analysis, even though both branches were correctly guarded
at runtime. Two small single-purpose effects satisfy the rule and are, on
reflection, clearer to read than the merged one was.

Verified against the local stack: `CONTINUUM_REQUIRE_DB=1 npm run verify`
green (233 unit tests, 9 SQL invariant files, production build), and every
touched form driven by hand in a browser — the mission form through a real
RULE-003 refusal with the title, reason, description and both loads surviving;
the session log through a future-dated refusal with duration and note intact;
the evidence form through an invalid-link refusal with the description, link
_and_ the previously-broken criterion selection intact, then a successful
submit correctly clearing it; the note form's type select surviving a save in
place. `npm run test:e2e` was not part of this verification: on this machine it
currently fails at the very first sign-in (`toHaveURL` times out at 5s) on
`main` as well as on this change — confirmed by stashing this work and
re-running the identical spec unmodified — because sign-in itself takes
roughly 8 seconds end to end on this machine right now, longer than
Playwright's default assertion timeout. Unrelated to this fix and not
investigated further; worth a look before the e2e suite is trusted again.

---

## 2026-09-14 — Milestone M12: curiosity parking lot

### The cycle-boundary definition, decided with the owner

M12 had been deferred since 2026-09-11 (see "Why M13 before M12", above) for
exactly one reason: RULE-007's acceptance criterion that promotion happens
"only at a cycle boundary, verified server-side" had no definition, and
picking one is a data-model decision the code cannot make for itself.

Investigating what already exists narrowed the real choices considerably. A
draft mission's `cycle_id` is set at creation time, not at activation, and
`enforce_mission_activation()` later refuses activation unless that same
`cycle_id` still matches whichever cycle is active _then_ — so a curiosity
promoted "between cycles", with no active cycle to attach it to, would have
nothing valid to reference. The boundary therefore has to be a window on the
_currently active_ cycle, not a gap between two cycles.

Three candidates were put to the owner: (a) open until the cycle's first
mission is activated, closed after; (b) a fixed N-day window from the cycle's
start; (c) one explicit "review the parking lot" action per cycle, gating a
flag. The owner chose (a), explicitly ruling out a magic-number window and an
extra review flow for the MVP, and specifying the exact rule by hand: a draft
mission sitting in the cycle must **not** close the window — only an
_activation_ does. That is what `promote_curiosity_to_mission()` now checks,
derived entirely from `cycles.status` and `missions.activated_at`: no new
column, flag or constant anywhere in the schema.

### The function no longer accepts a cycle

`p_cycle_id` is gone from `promote_curiosity_to_mission()`'s signature. It
always resolves the caller's own active cycle internally, for the same reason
it has never accepted a status: a boundary a caller can step around by naming
a different cycle is not a boundary. The SQL test asserts this structurally,
the same way it already asserted no `status` argument exists — by reading
`pg_proc`, not by trying to call a signature that was never there.

### Closed in passing: re-promoting an already-chosen curiosity

Auditing the function for bypass paths turned
up a second, unrelated gap: nothing stopped calling
`promote_curiosity_to_mission()` twice on the same curiosity. A second call
would have silently overwritten `promoted_mission_id`, orphaning the first
mission's back-reference and producing two drafts from one idea. Closed with
one more check: a curiosity already `chosen` or `archived` refuses promotion,
under the same RULE-007 code — it is the same "how curiosities become
missions" invariant, reached by a different door.

### One blocked message covers three refusal reasons

`promote_curiosity_to_mission()` now raises RULE-007 for three different
conditions (never active, boundary closed, already promoted), and
`toUserMessage()` renders exactly one fixed string per rule code — it has no
mechanism for a refusal to carry contextual detail to the client, and adding
one would be new machinery for a problem the codebase already has a precedent
for solving without it. RULE-005 already raises for two distinct reasons ("no
active cycle" and "wrong cycle") under one blended message
(`lib/i18n/pt-BR.ts`); RULE-007's blocked text was widened the same way,
worded to stay true regardless of which check actually tripped.

### The dashboard count, defined

"A count only" needed a precise definition of what is being counted. `chosen`
already became a mission and `archived` was explicitly dismissed, so neither
reads as still "in" the parking lot; `countOpenCuriosities` counts
`captured`, `waiting` and `candidate` only.

### Capture, reachable from anywhere

A floating control mounted once in `app/(app)/layout.tsx`
(`components/curiosity/global-capture.tsx`), plus the "C" key as the
shortcut — chosen as a bare, unmodified letter (rejected only while an input,
textarea, select or contenteditable element has focus) to match the
single-keystroke convention common to this kind of quick-capture affordance,
and because a modifier combination is one more thing to remember for an
action whose entire premise is that it has to be effortless. The panel closes
itself the instant capture succeeds, so it never lingers as a second thing to
dismiss.

### Verification

`CONTINUUM_REQUIRE_DB=1 npm run verify` green: 234 unit tests (one new file,
`curiosity-validation.test.ts`), 9 SQL invariant files including the extended
`040_curiosities_knowledge_rules.test.sql` (the boundary window, a draft not
closing it, re-promotion refused, no active cycle refused), production build
clean. `tests/e2e/curiosity-capture.spec.ts` added, covering capture at
375px, the global shortcut, a successful promotion, and the boundary refusal
naming RULE-007 in the open, the same way RULE-001 already does for a
mission.

---

## 2026-09-14 — Milestone M15: history and audit browsing

**Invariants touched:** RULE-004 and RULE-006, in enforcement only — the
database now refuses two ways out of an active mission it used to allow. No
rule's text, severity or level changed. The History page itself reads and
writes nothing.

### Two doors out of an active mission, closed before the history was built

M11 left one question for this milestone: whether a finished mission should be
deletable at all. Probing the local stack for bypass paths
found a wider hole than the question named:

- `missions_delete_own` (M3) let the owner delete any mission. Deleting an
  active mission is leaving it without a review — RULE-004 by another route —
  and deleting a finished one removes it from the record, together with its
  `mission_reviews` row, by cascade. The history this milestone renders would
  then describe something other than what happened.
- `enforce_mission_exit_review()` demanded a review only for an arrival in
  `revised` or `abandoned`. A direct `UPDATE … set status = 'draft'` on an
  active mission succeeded with no justification at all. With a draft-only
  delete policy alone, that would still have been active → draft → deleted.

The owner decided that only a draft may be deleted: policy
`missions_delete_own_draft`, row level security, so a refused delete hides the
row and affects zero rows, like every refused delete in this schema. The active
→ draft transition is refused under RULE-004 — `lib/rules/transitions.ts` has
always said active leads only to completed, revised or abandoned. Closing it
was not a separate decision: it is the same invariant, and without it the
owner's decision would not hold. M12 treated re-promotion the same way.

Migration `20260914194319_mission_exit_and_deletion`. The new
`080_mission_exit_and_deletion.test.sql` attempts every route — active to
draft, and deleting an active, a completed, an abandoned and a revised mission
— and asserts both justifications survive. The positive control deletes a draft
and then checks the row is really gone, because `assert_allowed` alone passes
on a delete that row level security quietly hid. Run before the migration
existed, the file failed at its first assertion.

Nothing in the interface deletes a mission. `createMission()` rolls back by
deleting a draft, which is still allowed; the end-to-end resets delete as the
database owner and are unaffected.

### Three tables, merged by cursor, with no migration

The timeline reads `audit_events` (every lifecycle change of missions,
curiosities, cycles, campaigns and directions, written by trigger since M4 and
M5), `mission_reviews` (the reasons behind exits, and the decisions to keep a
mission) and `rule_events` (the blocks). `audit_events` alone has neither the
justification nor the blocks. A database view would have been a migration for
something the application can do.

Pages are keyset, not offset. The cursor is the last entry's instant, table and
id, and each table answers with at most a page and one row, however far back
the reader goes. Order: newest first, then table (audit, review, rule), then id
descending. Ties are real — one transaction writes several rows at one `now()`
— so the cursor steps into an instant. In the cursor's own table the next page
continues below its id, tables ranked after it restart at that instant, and
tables ranked before it continue strictly older. `Date.parse` drops
microseconds, so ordering reads them by hand. A unit test walks a heavily tied
record through every page and asserts each entry appears exactly once, in
order; the end-to-end spec puts a page boundary in the middle of forty rows
written by one statement.

A status change sorts above the review from the same transaction, so the list
reads as the decision, then its reason. Both are shown: the audit row says what
happened, the review says why.

There are "older" and "back to newest" links, and no "previous": keyset
pagination has no cheap way back, and the record is read newest first.

### Reviews are filtered with missions

Six types: missions (with their reviews), curiosities, rules, cycles, campaigns
and directions. "Missions created, activated, reviewed and completed" is one
story, and a separate review filter would split it.

### A cycle filters by its calendar

Choosing a cycle means everything recorded from its first day to its last, not
everything associated with it. It is the one definition every source shares — a
curiosity captured mid-cycle belongs to no mission, and a rule event may cite
none — and it answers what the filter asks: what happened that month. A draft
prepared before its cycle began is therefore outside that cycle's slice of the
timeline; the Cycles tab lists every cycle's missions by association instead.
With a date range as well, the two intersect.

### Days are the reader's days

The server does not know the timezone (M10). The filter form carries the
browser's IANA timezone in a hidden field, and the server computes where each
day starts in it (`startOfDay`, from `Intl`, corrected once across a
daylight-saving change). A link that filters by date or cycle but carries no
timezone — "ver na linha do tempo" from a cycle — gets the browser's added
once, through `router.replace`, so no history entry is created. Without
JavaScript, days are UTC days. The Cycles tab shows calendar dates, formatted
in UTC so that none can move to the day before.

### Read-only by construction, and observations only

The only form is a GET filter; the end-to-end spec asserts one button on the
timeline and none on the Cycles tab. The tables read have no update or delete
policy, and after this milestone neither does a finished mission.

Every line states what was recorded. There are no counts, rates or comparisons
between cycles: the Cycles tab states each mission's outcome and, where a
review ended it, the category. A unit test scans the history copy for words
that characterise a person rather than the record.

An event whose mission, curiosity or cycle no longer exists reads "Registro
removido", with no link, rather than inventing a name. After this milestone
only a draft mission can be the one missing.

Within one instant the order falls back to id, which is arbitrary. In real use
that only groups the rows one transaction writes — a status change and its
review, which the table rank already orders. Fixtures that build a whole
mission in one transaction show its creation and activation in arbitrary order.

### Verification

`CONTINUUM_REQUIRE_DB=1 npm run verify` exit 0: 279 unit tests (one new file,
`history.test.ts`), 10 SQL invariant files (new: `080`), production build
clean, with `/history` and `/history/cycles` built. `history.spec.ts`, six
tests, passes in every run. Screens checked at 1280px and at 375px, with no
horizontal overflow.

Not green: the full `npm run test:e2e` run, twice — 68 passed, 1 failed, 3 did
not run, 44 skipped (mobile, by design). The failure is
`curiosity-capture.spec.ts:111`, "is reachable from anywhere, with a keyboard
shortcut": it presses `c` on the dashboard and times out waiting for the
capture panel's title field. The three tests after it in that serial file did
not run. It passes alone, and in an `auth` + `curiosity-capture` run both with
the M15 changes and with them stashed, back at `dd3bdf1`. The likeliest cause
is a key press arriving before the page has hydrated the listener. That is not
proven, and it is left open for the owner to decide.

---

## 2026-09-14 — Milestone M16: Mission Integrity and Trail of Evidence

**Invariants touched:** none. M16 only reads. It relies on RULE-004, RULE-006
and M15's draft-only deletion so that the record it counts cannot be rewritten
after the fact. No migration.

### Integrity lives in History, not on the dashboard

The `ui-shell` skill lists integrity under the dashboard's cycle status. It went
into History as a third tab instead. The dashboard is a closed list, M18's named
failure mode is that list accreting panels, and a count seen every morning
becomes a number to watch. This is open for the owner to revisit in M18.

### Counts, and no ratio

`concludedMissions()` exists, but nothing renders completed over concluded. A
fraction turns into a percentage in the reader's head, and a percentage turns
into a target. Each group of counts links to its slice of the timeline, so every
figure can be checked against what happened. `integrityInput()` leaves out any
value the application has no name for, rather than counting it under the wrong
heading. The blocked figure counts only RULE-001, RULE-004, RULE-005 and
RULE-007 blocks, as `computeIntegrity()` always did: an advisory is not the
system holding a line.

### The trail shows only the steps reached

The steps and where each comes from: creation (`missions.created_at`), the
first session's start, the first knowledge note of type `discovery` linked to
the mission, the first evidence, half of the Definition of Done, all of it, and
`completed_at`. No new query was needed. The mission page already reads
sessions, evidence, notes and criteria; `listNotesForMission()` now also
returns `created_at`.

- **Half means half of the criteria**, the moment the ⌈n/2⌉-th was satisfied,
  never half of the hours (RULE-102). With a single criterion there is no
  halfway step, because it would be the same moment as the Definition of Done.
- **It reads the current `satisfied_at`.** A criterion unmarked and marked
  again moves the step, because the database keeps only the current mark.
  Recording the history of marks would be a migration, and was not in scope.
- **A step not reached is left out, not drawn as a gap.** Nothing requires a
  note or evidence (M14), and a trail listing what is absent would read as a
  reproach. For the same reason a draft has no trail.
- **Effort is drawn as effort.** The first session is quieter and carries no
  duration. The discovery and the evidence show the person's own words, which
  is what "what remains after the effort" means on screen.
- **Placement:** below the Definition of Done and above the hours. On a
  completed mission the trail is part of the record, like its notes, and adds
  no action beneath MISSÃO CONCLUÍDA.

### Verification

`CONTINUUM_REQUIRE_DB=1 npm run verify` exit 0: 290 unit tests (one new file,
`trail.test.ts`, which also covers `integrityInput()` and scans the new copy
for scoring and diagnostic vocabulary), 10 SQL invariant files, production
build clean, with `/history/integrity` built. `integrity.spec.ts`, three tests,
passes in the full run and alone. Screens checked at 1280px and at 375px, with
no horizontal overflow.

Full `npm run test:e2e`: 71 passed, 47 skipped (mobile, by design), 1 failed,
3 did not run. The one failure is the same open M15 item,
`curiosity-capture.spec.ts:111`, which M16 does not touch. It was fixed right
after this milestone; see the next entry.

---

## 2026-09-14 — The curiosity-shortcut end-to-end failure, fixed

The owner chose to fix this before M17, which waits on an API key the owner
must add at the machine.

**Cause, confirmed rather than assumed.** The "C" shortcut is a `keydown`
listener that `GlobalCapture` attaches in an effect, which means only after
hydration. The test pressed "c" straight after `page.goto("/dashboard")`, which
waits only for the page's `load` event. Under `next dev`, hydration can land
later; the key press was lost, the panel never opened, and the test timed out
waiting for its field. A temporary probe in the test, run in the full suite
where the failure had reproduced three times out of three, recorded that the
page had not hydrated at the moment of the press. With the wait in place the
same run passed. Why the `auth` + `curiosity-capture` subset hydrated in time
and the full run did not was not established; the race does not depend on it.

**Fix.** `GlobalCapture` sets `data-capture-ready` once hydrated, through the
same `useHydrated()` the rest of the application uses for client-only values.
It is set on the render after the effect that attaches the listener, so its
presence implies the shortcut works. The test waits for it before pressing the
key. A retrying press was rejected: once the panel opens, a second "c" lands in
the autofocused title field, and the test would pass by accident.

The product itself did not change behaviour. A person cannot press a key in the
milliseconds before hydration, and nothing else relied on the shortcut earlier.

**Verification.** A full `npm run test:e2e`: 75 passed, 0 failed, 47 skipped
(mobile, by design) — the first fully green run since M12.

---

## 2026-09-14 — Milestone M18: polish and readiness, ahead of M17

**Invariants touched:** none. No migration, no RPC, no new dependency.

### Built before M17

M17 waits on two things only the owner can do at the machine: add
`ANTHROPIC_API_KEY` to `.env.local`, and choose between installing the Anthropic
SDK and calling the API with `fetch`, which needs no new dependency. The owner
asked for M18 to go first. The agent's own screen, when M17 builds it, is held
to the same standards there.

### Audit first, change second

The audit ran read-only before any change, using no new dependency. `axe`
would have been one.

- **Contrast:** computed from the tokens themselves — OKLCH to sRGB, WCAG 2.x
  luminance — for every text pairing the interface uses, and for control edges
  and the focus ring at 3:1.
- **Structure and keyboard:** a temporary Playwright walk of every route,
  signed out and signed in. It recorded controls with no accessible name,
  heading levels, landmarks and duplicate ids, then walked every Tab stop and
  checked that focus is drawn at each one.

Structure was clean on every route: one `h1`, no skipped heading levels, no
unnamed control, `lang="pt-BR"`, a title per page. What failed:

- Light-theme text contrast. The primary button (mission colour) measured 3.69,
  mission text 3.28 to 3.71, the capture button 4.47, leisure 3.70, success —
  the MISSÃO CONCLUÍDA panel — 3.84 to 4.08, the danger hover 4.47, and the SOFT
  badge's warning 3.08.
- Control edges (`border-strong`), in both themes: 1.75 to 2.26 against 3:1.
- No visible focus on native date inputs. Focus sits in their inner fields, so
  the input never matches `:focus-visible`.
- The sign-in route had no error or loading state, and its tab title was a
  literal rather than pt-BR copy.
- The 404 link used the mission colour, which is reserved for the mission.
- Two of the four dashboard shortcuts had nowhere to live.

### Contrast: lightness only

Each failing token moved to the nearest lightness that passes every pairing it
takes part in; hue and chroma are untouched, so the palette is still M7's.

- **Light:** mission and ring 0.62 → 0.54, curiosity 0.55 → 0.545, leisure
  0.57 → 0.52, success 0.57 → 0.53, warning 0.66 → 0.56, danger 0.55 → 0.545,
  `border-strong` 0.81 → 0.645.
- **Dark:** only `border-strong`, 0.42 → 0.53.

The darker edge is heavier on inputs, quiet buttons and the advisory badge.
That is what WCAG 1.4.11 costs, since a white input on an off-white page has
no other boundary.

### Four shortcuts, none of them repeated

The `ui-shell` skill names four: start a session, record a discovery, park a
curiosity, open the rules. Starting a session already lives in the current
mission, and parking a curiosity is the capture control on every screen and the
C key. Repeating either would be noise, so only the other two were added, as
quiet links. "Registrar uma descoberta" opens a new note already typed as a
discovery and bound to the mission; `?type=` in the URL only preselects the
field. It exists only while a mission is active: after completion it would be
the system suggesting more work (RULE-103). Integrity stays in History (M16),
so the dashboard's closed list gained two links and nothing else.

### The README was merged, not replaced

The earlier README described the foundation phase. Its "status" line,
`npm install`, and filling `.env.local` from a cloud project were out of date,
and it never said how to get from a clone to a signed-in session: `db:reset`,
and creating the single user by hand, were missing. Those parts were rewritten
as a numbered path from clone to sign-in. Its commands table, layout, "How it
is built" section and deployment note were kept.

### A full-loop end-to-end spec

`full-loop.spec.ts` drives the whole product through the interface once, from
an empty account. It creates a direction, a campaign, a cycle and a mission, then
records a session, a discovery through the shortcut, a curiosity with the C key,
and evidence. It satisfies the Definition of Done and completes the mission, then
checks the trail, the timeline, the integrity counts, and a dashboard that
suggests nothing more. Every other spec starts from an SQL fixture; this one
proves the parts connect when a person drives them in order.

### Verification

`CONTINUUM_REQUIRE_DB=1 npm run verify` exit 0: 290 unit tests, 10 SQL
invariant files, production build clean. A full `npm run test:e2e`: 76 passed,
0 failed, 48 skipped (mobile, by design), with `full-loop.spec.ts` passing. The
dashboard was checked at 1280px in light and dark and at 375px, with no
horizontal overflow.

A screenshot run logged one hydration warning: a `caret-color: transparent`
inline style on hidden inputs that the server never rendered. This appears to
be Playwright hiding the caret for a screenshot taken before hydration finished.
The full end-to-end run, which takes no screenshots, logged no warning at all.
That is the likeliest explanation, not a proven one; nothing in the application
was changed for it.

---

## 2026-09-15 — M17 dropped: the project stays free

M17, the personal agent, was built on the Anthropic API (`@anthropic-ai/sdk`,
`claude-opus-5`) and then removed before it was ever committed. When the API
key came up, the owner set the constraint: Continuum is a personal project and
must cost nothing to run. The Anthropic API is paid (prepaid credits, $5
minimum), with no free tier the project could rely on. Proposing it without
saying so up front was the mistake; the project's memory now asks for any
cost to be named before anything is built.

The agent was judged not indispensable. The product is the deterministic core:
the eight invariants live in the database, and every flow works without a model
— missions, cycles, reviews, curiosities, history and integrity. The agent was
an advisory layer on top, already fenced by the roadmap as having zero write
authority.

**What was removed:** `lib/agent/`, the advisor panel on the active mission, its
server action and context gathering, and its unit, end-to-end and live test
suites. The SDK dependency went too, and so did the post-build bundle check,
which existed only to guard the API key. None of it reached the repository.
`.env.example`, the README and `docs/supabase.md` no longer mention an
`ANTHROPIC_API_KEY`, and `docs/architecture.md` no longer draws an agent layer.

**If an AI layer ever comes back,** the design worked out here still holds and is
worth reusing:

- no tool at all, rather than a restricted one;
- a read-only projection, with the person's own text quoted as data;
- the rules fed from the `rules` table, never paraphrased;
- a scan of the client bundle after every build.

A free option exists — a local model through Ollama — but it runs only on the
owner's machine, never in the deployed app, and gives weaker answers. That
trade-off is the owner's call.

---

## 2026-09-15 — M6-cloud: the cloud project and the first deployment

**Invariants touched:** none. The schema that went to the cloud is the one
already verified locally, migration for migration.

### What was done, and by whom

The owner did every step that touches the cloud or the deployment, as
the project's rules require. They disabled public sign-up, created the single user by
hand, and set the URL configuration. They ran `npx supabase login`, `link` and
`db push`, imported the repository into Vercel with the two public variables,
and connected Vercel to GitHub.

The results were checked through the Supabase API (read-only), and the SQL
runner was adapted so the suite could test the cloud at all.

### Verified

- **Schema:** the cloud project was empty beforehand, with no tables and no
  migrations, so nothing had drifted. It now has all 13 migrations and 15
  tables, every one with row level security, and the 11 seeded rules.
- **Invariant suite against the cloud:** 10 of 10, through the Session pooler.
  The direct connection is IPv6-only on the free tier. The first "10 passed"
  had in fact run against the local database, because the variable was not set
  in that terminal. The pooler's logs showed no connection from the suite,
  which is how it was caught; the second run showed the pooler host in its
  `using … ->` line.
- **The published site:** `/login` answers 200, and `/` redirects a visitor who
  is not signed in to `/login`. The owner signed in with the single user.

### The runner, made fit to test a remote database

`scripts/run-db-tests.mjs` used the local container's `psql` as its client but
ignored `SUPABASE_DB_URL` on that path. Pointing it at the cloud would have
tested the local database and reported green: the harness that cannot go red.
Three changes fixed it:

- The container now connects to `SUPABASE_DB_URL` when it is set, and prints
  the target host with the password masked.
- An address that cannot be reached fails loudly with psql's own reason,
  instead of "SKIPPED".
- Bracketed-paste markers and invisible characters are stripped from the
  pasted address, since Git Bash had inserted them.

Each change was proven locally: with no address, with a wrong address that
must fail, and with a pasted address carrying the markers.

### Left as optional

- **13 trigger functions without a pinned `search_path`,** flagged by the
  Supabase security advisor. They run with the caller's rights, none is
  `SECURITY DEFINER`, and row level security still applies, so the risk is
  low. Pinning them takes a small migration, which the owner would push.
- **Leaked-password protection is off.** It is an optional dashboard setting
  and may need a paid plan, so it stays off.
- **The free Supabase tier pauses a project after a week without use.**
  Restoring it from the dashboard costs nothing.

### Deployment is now continuous

With the Git integration connected, every push to `main` deploys to
production. Pushes stay the owner's decision.
`verify` is the gate before each one.
