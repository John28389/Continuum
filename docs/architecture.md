# Architecture

## What this application is

Continuum is a single-user web application for planning, executing, and
protecting focus: a personal execution operating system. The user carries
execution; the system carries structure.

The engineering consequence of that goal is unusual and shapes every decision
below: **the rules are the product.** A version of this application whose
constraints can be talked around is not a degraded version of it — it is a
different, useless product. So the constraints live in the database, and
everything above them is presentation.

## Layering

```
                USER
                  |
      UI (Next.js App Router, RSC)          pt-BR strings
                  |
      Server actions — Zod validation, orchestration
                  |
      Domain services — pure TypeScript rule engine
                  |
      Postgres RPC — atomic state transitions
                  |
      Constraints, triggers, row level security   <- final authority
```

Each layer may improve the experience of a refusal. None may remove it.

## Enforcement doctrine

**The database is the last line of defence, not the UI.**

Every HARD invariant in `docs/rules.md` is a partial unique index, a check
constraint, or a trigger. The TypeScript layers produce good error messages and
good UX, but are never the only barrier.

There is no model in this application. M17, the planned advisory agent, was
dropped because it needed a paid API. If one is ever added, this doctrine is
what must keep it safe by construction rather than by prompt. It gets no tool
and no write path, only a read-only projection, so it cannot bypass an
invariant even if it is convinced it should, and even a successful prompt
injection through the user's own notes and curiosities has nothing to act with.

## Stack

| Concern       | Choice                                  | Note                                    |
| ------------- | --------------------------------------- | --------------------------------------- |
| Framework     | Next.js App Router, TypeScript          | Server components by default            |
| Styling       | Tailwind CSS v4                         | CSS-first tokens in `app/globals.css`   |
| Components    | shadcn/ui                               | Copied into the repo, not a dependency  |
| Database      | Supabase Postgres                       | Row level security on every table       |
| Auth          | Supabase Auth                           | Public sign-up disabled, single owner   |
| Client access | `@supabase/ssr`                         | Server client carrying the user session |
| Validation    | Zod                                     | Shared by server actions and forms      |
| Tests         | Vitest, SQL invariant suite, Playwright | See the testing section                 |
| Deploy        | Vercel, manually by the owner           | No automatic deployment, by policy      |

### Access model

The application uses the public anon key and the user's JWT, so row level
security applies to every query. **The service-role key is not part of this
architecture.** If a task appears to require it, the design is wrong; stop and
raise it rather than adding the key.

Nothing sensitive ever receives a `NEXT_PUBLIC_` prefix, because that prefix
means "compiled into the browser bundle".

## Read and write paths

**Reads.** Server components query Supabase through the request-scoped server
client. Row level security scopes results to the owner; the query does not
re-implement that check.

**Writes.** A form posts to a server action. The action validates with Zod, then
calls a domain service, which performs either a plain insert or update for
ordinary data, or an RPC for anything that changes a mission's state.

**No client component ever writes to Supabase.** This keeps a single audited
path into the data and prevents validation logic drifting into the browser,
where it is advisory at best.

## State transitions

Mission state changes are confined to RPCs — `activate_mission`,
`complete_mission`, `review_mission`, `close_cycle`,
`promote_curiosity_to_mission` — for three reasons:

1. **Atomicity.** Recording a review and changing the status must succeed or fail
   together, otherwise a mission could be abandoned with its justification lost.
2. **A single choke point.** Direct status updates are blocked by trigger, so
   there is exactly one path to audit.
3. **Uniformity.** Every caller uses the same entry points, so nothing needs
   special-casing to be constrained.

Functions are `SECURITY INVOKER` so row level security still applies.
`SECURITY DEFINER` silently bypasses RLS and is treated as a defect.

## Determinism boundary

Deterministic, and never delegated to a model: is more than one mission active,
is a minimum load set, has the cycle ended, is the mission complete, was a HARD
rule violated.

There is no model layer today (M17 was dropped; see `docs/decisions.md`). If one
is ever added, it handles language and suggestions only: it explains rules, and
it never adjudicates them.

## Derived rather than stored

Mission Integrity — missions completed, revised on evidence, abandoned on impulse
— is computed from `missions` and `mission_reviews` by a pure function. It is not
a stored score, which keeps it from going stale and keeps it from turning into
the arbitrary point total the product deliberately avoids.

## Auditability

Relevant decisions are recorded in `audit_events` by trigger rather than by
application code, so no write path can forget. The table has select and insert
policies and deliberately no update or delete policy: history is append-only.

`rule_events` records when a rule blocked, was overridden, or advised, which is
what later makes behavioural observation possible — patterns over time, never
psychological diagnosis.

## Testing

| Layer             | Tool                        | Covers                                            |
| ----------------- | --------------------------- | ------------------------------------------------- |
| Unit              | Vitest                      | Rule engine, integrity, transitions, schemas      |
| **DB invariants** | SQL suite vs local Postgres | **Adversarial**: each rule's violation refused    |
| Schema guard      | SQL assertion               | Every public table has RLS and a policy           |
| Registry parity   | Vitest                      | `registry.ts` matches the seeded `rules` table    |
| Component         | Vitest + Testing Library    | Dashboard hierarchy, mission forms                |
| E2E               | Playwright                  | The core loop, including a blocked second mission |
| Build             | `next build`                | Production build integrity                        |

The invariant suite runs entirely against a local Postgres in Docker, so the
enforcement layer is verifiable without any cloud project.

Two doctrines keep it honest. Every invariant test carries a **positive
control** proving the legitimate path still works — otherwise the refusals could
pass because nothing works at all. And a harness that cannot produce a red
result is worse than no harness, so the runner's own ability to fail is
demonstrated rather than assumed.

## Deliberate omissions

- **No ORM.** Drizzle or Prisma would duplicate the schema in TypeScript and
  invite the invariants to migrate upward, weakening exactly the layer this
  design depends on.
- **No client state manager.** Server components and server actions cover it.
- **No i18n framework.** One locale, one typed string map.
- **No `daily_states` table.** No feature reads it yet.

Each of these is reconsidered when a concrete need appears, not before.
