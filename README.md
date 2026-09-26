# Continuum

A personal execution operating system: one active mission at a time, curiosities
parked rather than lost, and progress measured by evidence rather than hours.

Continuum keeps the structure so its user only has to carry the execution. The
rules that make that work are enforced by the database, not by the interface.

```
Direction -> Campaign (~3 months) -> Cycle (monthly) -> Mission -> Sessions -> Evidence -> Knowledge
Curiosity -> Parking lot -> evaluated at a cycle boundary -> possibly a future mission
```

The interface is in Brazilian Portuguese; code and documentation are in English.

## Requirements

- Node.js 20.9 or later, and npm
- Git
- Docker, running, for the local Supabase stack (Docker Desktop on Windows and
  macOS)

The Supabase CLI is a dev dependency, so nothing else is installed globally.

## From a fresh clone to signed in

**1. Clone and install.**

```bash
git clone https://github.com/John28389/Continuum.git
```

```bash
cd Continuum
```

```bash
npm ci
```

**2. Start the local database.** The first run downloads the Supabase images
and takes a few minutes.

```bash
npm run db:start
```

When it finishes it prints the local API URL (`http://127.0.0.1:54321`) and a
publishable (anon) key. These are the standard local values, identical on every
machine and not secret. `npx supabase status` prints them again at any time.

**3. Create `.env.local`.**

```bash
cp .env.example .env.local
```

Fill in the two public values from step 2:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<the publishable or anon key from db:start>
```

Leave everything else empty. Nothing here uses a service-role key, and nothing
here costs money to run.

**4. Apply the schema.** This re-creates the local database from the
migrations, and is safe to repeat.

```bash
npm run db:reset
```

**5. Create your user.** Public sign-up is disabled by design, so the single
account is created by hand. Open Supabase Studio at
[http://127.0.0.1:54323](http://127.0.0.1:54323), go to **Authentication →
Users → Add user → Create new user**, enter an e-mail and a password, and tick
**Auto Confirm User**.

**6. Run the application.**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the user
from step 5. Start in **Ajustes** (a direction, then a campaign), open a cycle
on the **Painel**, then create a mission.

## Check that everything holds

```bash
CONTINUUM_REQUIRE_DB=1 npm run verify
```

`npm run verify` is the gate, and it must be green before any commit: lint, the
format check, the typecheck, the unit tests, the adversarial SQL suite and a
production build. `CONTINUUM_REQUIRE_DB=1` turns a skipped SQL suite into a
failure, so a stopped database cannot pass for a green one.

The end-to-end suite needs a browser once, then runs against the local stack.
It creates its own fixture user.

```bash
npx playwright install --with-deps chromium
```

```bash
npm run test:e2e
```

## Commands

| Command             | Purpose                                                   |
| ------------------- | --------------------------------------------------------- |
| `npm run dev`       | Development server                                        |
| `npm run build`     | Production build                                          |
| `npm run verify`    | Full chain: lint, format, types, tests, invariants, build |
| `npm run lint`      | ESLint                                                    |
| `npm run format`    | Prettier, writing changes                                 |
| `npm run typecheck` | TypeScript, no emit                                       |
| `npm run test`      | Unit and component tests                                  |
| `npm run test:db`   | Adversarial SQL invariant suite                           |
| `npm run test:e2e`  | Playwright end-to-end tests                               |
| `npm run db:start`  | Start the local Supabase stack                            |
| `npm run db:stop`   | Stop it                                                   |
| `npm run db:reset`  | Re-apply all migrations and re-seed                       |
| `npm run db:types`  | Regenerate `lib/db/types.ts`                              |

## When something goes wrong

- **`db:start` fails.** Docker is not running, or another local Postgres holds
  the ports. The ports are in `supabase/config.toml`.
- **The page loads but nothing responds to clicks.** Open the app at
  `localhost` or `127.0.0.1` exactly as shown; `docs/status.md` explains why.
- **Sign-in says the credentials are wrong.** The user from step 5 must be
  confirmed; re-create it with **Auto Confirm User** ticked.
- More, with the reasoning behind each, in `docs/status.md` and
  `docs/supabase.md`.

## Layout

```
app/          Routes. (app) holds the seven navigation areas
components/   UI, grouped by feature
lib/rules/    Pure deterministic rule engine
lib/domain/   Services orchestrating validated writes
lib/supabase/ Client factories; writes are server-side only
supabase/     Migrations, seed, and the SQL invariant suite
tests/        Unit and end-to-end tests
docs/         Architecture, data model, rules, decisions, Supabase setup
```

## How it is built

The invariants are the product, so they live in the database as constraints and
triggers rather than in form validation. Every layer above may improve the
experience of a refusal; none may remove it.

The SQL suite is adversarial: each test attempts to violate a rule and asserts
the database refuses, alongside a positive control proving the legitimate path
still works.

Start with `docs/architecture.md`, then `docs/rules.md`. `docs/status.md` says
what is done and what is next; `docs/decisions.md` says why things are the way
they are.

## Deployment

The application is live at https://continuum-danilo.vercel.app, on the free
tiers of Supabase and Vercel. Vercel is connected to this repository, so every
push to `main` deploys to production. Run `CONTINUUM_REQUIRE_DB=1 npm run
verify` before pushing.

The cloud project, its schema and the Vercel settings belong to the repository
owner. The step-by-step is in `docs/supabase.md`, and the account of the first
deployment is M6-cloud in `docs/decisions.md`.
