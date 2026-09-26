# Where the project is

Read this first, then `docs/rules.md` for the invariants and `docs/roadmap.md`
for the milestone you are about to build.

**The project is complete.** M6-cloud, the last milestone, closed on
2026-09-15. The schema is on the cloud project, the invariant suite passes
against it, and the application is live at https://continuum-danilo.vercel.app,
on the free Supabase and Vercel tiers. Before it came M18 (polish and readiness)
and M16 (Integrity and the Trail of Evidence). M17, the personal agent, was
dropped because it needs a paid API and the project must stay free. See
`docs/decisions.md`.

**A push to `main` now deploys to production.** Vercel is connected to the
repository, so a commit is live a minute after it is pushed. Run
`CONTINUUM_REQUIRE_DB=1 npm run verify` before every push.

**Optional follow-ups, none required:** pin `search_path` on the 13 trigger
functions the Supabase security advisor flags, which takes a small migration.
Also note that a free Supabase project pauses after a week without use; restore
it from the dashboard, at no cost.

---

## State

| Milestone | State                                                                        |
| --------- | ---------------------------------------------------------------------------- |
| M0        | Done. Tooling, `verify` chain, skills, agents, docs                          |
| M1        | Done. Local stack, SQL runner, meta test proving the harness can fail        |
| M2        | Done. profiles, directions, campaigns, cycles, RLS baseline                  |
| M3        | Done. missions, DoD criteria, RULE-001/002/003/005/006                       |
| M4        | Done. mission_reviews, audit trail, transition RPCs, RULE-004                |
| M5        | Done. curiosities, knowledge, rules registry, RULE-007                       |
| M6        | Done. Single-user auth, verified against the local stack                     |
| M7        | Done. App shell, seven areas, design tokens                                  |
| M8        | Done. Direction, campaign, cycle; cycle status on the dashboard              |
| M9        | Done. Mission lifecycle UI, RULE-001 as a usable moment                      |
| M10       | Done. Sessions; time as an input, subordinate to output                      |
| M11       | Done. Evidence, Definition of Done, completion (RULE-008), the frozen record |
| M12       | Done. Curiosity parking lot; the cycle-boundary window on RULE-007           |
| M13       | Done. Rules page; mission review (RULE-004)                                  |
| M14       | Done. Knowledge notes, links and backlinks                                   |
| M15       | Done. History timeline and cycles; only drafts deletable; no active → draft  |
| M16       | Done. Integrity as counts (History tab); Trail of Evidence on each mission   |
| M17       | Dropped. It needs a paid API, and the project must stay free                 |
| M18       | Done. Contrast, focus, states, shortcuts, README, full loop                  |
| M6-cloud  | Done. Schema pushed, suite green against the cloud, live on Vercel           |

At the last checkpoint (M18, 2026-09-14): **290 unit tests, 10 SQL invariant
files, 124 end-to-end tests** (48 skipped by design on the mobile project),
production build clean, `CONTINUUM_REQUIRE_DB=1 npm run verify` exit 0, and a
full `npm run test:e2e` run green: 76 passed, 0 failed.

Migrations since M5: `mission_sessions` (M10), `mission_evidence_and_completion`
(M11), `knowledge_note_mission_fk` (the fix found in M14),
`curiosity_promotion_boundary` (M12: RULE-007's cycle-boundary window, and a
closed re-promotion gap), and `mission_exit_and_deletion` (M15: RULE-004 on
every way out of active; only drafts deletable). All 13 migrations are applied
to the cloud project since M6-cloud (2026-09-15). A new migration reaches the
cloud only when the owner runs `npx supabase db push`, after it is green
locally.

## The no-database phase (2026-09-11 to 2026-09-14)

From 2026-09-11 Docker could not start its WSL 2 engine on the Windows
development machine, with WSL 2 disabled by an enterprise policy. Work continued
in a no-database phase agreed with the owner: only milestones needing no schema
change, written and unit-tested, committed as `MX WIP (unverified)`, with the
debt listed here. On 2026-09-14 Docker ran again and the debt was paid in one
pass; what that pass found is recorded in `docs/decisions.md`.

If Docker stops again, the same rules apply: **no migration, RPC or SQL test
without a database** — SQL that has never run is the harness-that-cannot-go-red
the project forbids — WIP commits, and a debt table here. To pay it off, on a
machine where Docker runs, in this order:

```bash
npm run db:start
```

```bash
npm run db:reset
```

```bash
npm run db:types
```

```bash
CONTINUUM_REQUIRE_DB=1 npm run verify
```

```bash
npx playwright install --with-deps chromium
```

```bash
npm run test:e2e
```

`CONTINUUM_REQUIRE_DB=1` makes a skipped SQL suite a failure, so a missing
database cannot pass for a green one. Never hand-edit `lib/db/types.ts` around
the typecheck gap; regenerate it.

Then look at every screen the pending milestones touched: a test cannot tell
whether a refusal reads as a prompt or as a reproach.

## Resuming work

```bash
npm run db:start
```

```bash
npm run verify
```

If `verify` is not green before you change anything, stop and find out why. It
was green at the last commit.

The local Supabase stack must be running for `test:db` to actually execute. When
it is not, the runner prints a loud SKIPPED banner and exits zero — that is a
real gap, not a pass. `CONTINUUM_REQUIRE_DB=1` turns a skip into a failure.

## Things that will waste your time if you do not know them

Each of these cost real debugging once. All are recorded with full reasoning in
`docs/decisions.md`.

**`npm run test:e2e` can fail at the first sign-in with `toHaveURL(/\/dashboard/)`
timing out at Playwright's default 5s**, unrelated to any application change —
confirmed once on 2026-09-14 by stashing a change and re-running the identical
spec unmodified, same failure either way. The one time it was traced further,
the cause was a stale `next dev` process left over from an earlier Playwright
run, still bound to port 3000 and answering slowly; killing it and letting
Playwright start a fresh server fixed it, and a full `npm run test:e2e` run
right after (66 passed, 0 failed, both projects) confirmed it was not a code
problem. If it recurs, check `netstat`/`lsof` on port 3000 for an orphaned dev
server before assuming the code is wrong.

**A controlled `<select>` is not defended by React the way a controlled text
field is.** React re-applies a text field's `value` on every render regardless
of what changed; a `<select>`'s DOM selection can be silently reset by React
19's post-action form reset without React noticing there is anything to
re-sync, because its own state did not change. A unit test cannot see this —
it only showed up by driving the page in a browser. The fix, applied to every
controlled select in the app, is a `key` bumped by its own effect on every
`pending` → idle transition, forcing a remount that re-applies the controlled
value fresh.

**Next 16 renamed `middleware.ts` to `proxy.ts`**, including the exported
function name. Every Supabase SSR guide still says `middleware.ts`. The
framework ships its own docs under `node_modules/next/dist/docs/` — read those
rather than working from memory.

**`allowedDevOrigins: ["127.0.0.1"]` in `next.config.ts` is load-bearing.** Next
treats `127.0.0.1` and `localhost` as different origins and blocks `_next` dev
resources across them. Without it nothing hydrates, silently, with no console
error — server-rendered links still work, so most tests pass and only
JavaScript-dependent behaviour fails.

**TypeScript is pinned to 6.0.3 and ESLint to 9.39.5.** Not preference:
`typescript-eslint` caps at `typescript <6.1.0`, and `eslint-config-next` bundles
an `eslint-plugin-react` that caps at `eslint ^9.7` and throws under 10.

**Row level security refuses UPDATE and DELETE silently.** No matching policy
means the rows are invisible, so the statement succeeds affecting zero rows.
Only INSERT raises (42501). Assert on row count, not on an error.

**Only a draft mission can be deleted, since M15.** Deleting anything else as
the signed-in user affects zero rows, silently, for the reason above. The
end-to-end resets delete as the database owner and are unaffected; an SQL test
that deletes a mission while logged in must use a draft.

**History times and date filters need the reader's timezone.** The History page
gets it from the browser, as a `tz` query parameter the filter form fills in; a
link without one has it added on arrival. A date-filtered URL with no `tz`, read
without JavaScript, means UTC days.

**A key pressed before hydration is lost.** Under `next dev`, hydration can land
after the page's `load` event, which is all `page.goto` waits for. An
end-to-end test that drives a JavaScript listener — the "C" capture shortcut is
the one that bit — must first wait for a marker set on hydration, such as
`[data-capture-ready]`, rather than race it.

**Docker Desktop on this machine is fragile.** If the engine will not start and
the error names `AppData\Local\Docker\run\dockerInference`, a stale socket is
blocking startup: quit Docker Desktop fully, delete that file, restart. A
separate, harmless warning about the `UbuntuTest` WSL distro appears because it
runs WSL 1; it affects only running `docker` from inside that distro.

**`[auth.email] enable_signup` in `supabase/config.toml` does not mean what it
says.** It maps to `GOTRUE_EXTERNAL_EMAIL_ENABLED` and disables email login
entirely. Registration is blocked by the top-level `[auth] enable_signup`.

**The end-to-end suite runs on a single worker, deliberately.** The product's
rules are one-at-a-time — one active cycle, one active mission — so two
data-mutating spec files running concurrently fight over the same slot and fail
in ways that look like product bugs. Anything that mutates cycles or missions
must also delete missions _first_: they reference cycles and campaigns
ON DELETE RESTRICT.

**`tests/unit/i18n-coverage.test.ts` scans for text between an angle bracket
pair**, so an arrow-function expression ending immediately before a `return (`
reads to it as hardcoded copy. Give the callback a block body or name it; do not
weaken the guard.

**The SQL runner wraps each test file in one transaction**, so `now()` is the
same instant from the first line to the last. A session that a test later stops
must start at an explicit past time, or stopping it stamps an end equal to its
start and the period check refuses it — a property of the harness, not the
schema.

**The server does not know the reader's timezone.** `profiles.timezone` defaults
to `'UTC'` and nothing sets it. Wall-clock times are therefore formatted in
client components (`components/mission/clock.ts`), and manually entered times
are converted to instants in the browser before they are sent. Durations are
timezone-free and render anywhere.

**Session overlap is a locked trigger, not an exclusion constraint**, because
`btree_gist` is not enabled. Switching is the owner's call; the reasoning and
the migration it would take are in `docs/decisions.md`.

**`next-env.d.ts` flips between `.next/types` and `.next/dev/types`** depending
on whether `next build` or `next dev` ran last. It is generated; commit whichever
state it is in rather than chasing it.

**If the Docker engine will not start and no `dockerInference` file exists,
check that WSL 2 is available.** From 2026-09-11 to 2026-09-14 an enterprise
policy disabled it on the Windows development machine and Docker Desktop's engine
could not start at all; nothing on the application side changes that. The
stale-socket problem above is a different failure: it leaves that file behind in
`AppData\Local\Docker\run`.

## Local test fixture

The end-to-end suite creates `e2e@continuum.test` directly in the database,
because sign-up is disabled by design. Password and the two non-obvious details
needed to make such a user work (a real bcrypt hash, and empty strings rather
than NULL in the token columns) are in `tests/e2e/global-setup.ts`.

`.env.local` points at the local stack. Those values are the standard local
Supabase ones, identical on every install and not secret.

## Cloud

The cloud project has the full schema and serves the live application at
https://continuum-danilo.vercel.app. Development still runs against the local
stack.

To run the invariant suite against the cloud, set `SUPABASE_DB_URL` to the
**Session pooler** URI with the database password. The direct connection is
IPv6-only on the free tier. Then run `CONTINUUM_REQUIRE_DB=1 npm run test:db`.
Its first line must name the pooler host; `127.0.0.1` means the variable was
not set and the local database was tested.

Every push to `main` deploys to production through the Vercel Git integration.
Pushes happen only when the owner decides. Schema changes to the cloud, dashboard
settings and Vercel settings stay the owner's.

## Map

| Path                   | Holds                                                         |
| ---------------------- | ------------------------------------------------------------- |
| `docs/roadmap.md`      | The remaining milestones, with acceptance criteria            |
| `docs/decisions.md`    | Why things are the way they are. Newest last                  |
| `docs/rules.md`        | Authoritative rule text; must match `lib/rules/registry.ts`   |
| `docs/architecture.md` | Layering, enforcement doctrine, testing strategy              |
| `docs/data-model.md`   | Tables and the rules each carries                             |
| `docs/supabase.md`     | Local and cloud setup, troubleshooting                        |

Audit for bypass paths before touching missions, cycles, curiosities, reviews
or rules. That audit has already caught one defect that would otherwise have
shipped.
