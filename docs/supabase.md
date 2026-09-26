# Supabase

Two environments: a **local** stack in Docker used for all development and
testing, and a **cloud** project used by the deployed application.

The local stack is the default. Migrations and the invariant suite are verified
there before anything reaches the cloud. The cloud project is only required from
the authentication milestone onward.

---

## Local development

Requires Docker running. The Supabase CLI is a dev dependency, so no global
install is needed.

```bash
npm run db:start
```

```bash
npm run db:reset
```

```bash
npm run db:types
```

`db:reset` drops the local database, re-applies every migration, and re-runs the
seed. It must stay idempotent. If seed data starts violating a constraint, the
seed is wrong, not the constraint.

`db:types` regenerates `lib/db/types.ts`. That file is generated output and is
never hand-edited.

Run the adversarial invariant suite with:

```bash
npm run test:db
```

Stop the stack with `npm run db:stop`.

---

## Cloud project — manual setup

These steps require the dashboard and are performed by the repository owner.
Nothing here is automated, and no credential is ever pasted into a chat.

### 1. Create the project

In the Supabase dashboard, create a project. Choose a region close to you. Save
the database password in a password manager — it is shown once and is not
recoverable from the dashboard.

### 2. Copy the API credentials

Project Settings, then API. Two values are needed:

- the **Project URL**
- the **public key** — the one intended for browser use

Confirm the exact key names shown in the dashboard against `.env.example` before
filling it in; Supabase has been migrating this naming, and the current
dashboard is authoritative.

The **service-role key is not used by this application** and must not be copied
anywhere. It bypasses row level security entirely.

### 3. Fill in the local environment file

Copy `.env.example` to `.env.local` and paste the two values in. `.env.local` is
git-ignored and must stay local.

```bash
cp .env.example .env.local
```

### 4. Disable public sign-up

Authentication, then Providers, then Email. Turn off open sign-up, then create
your single user manually under Authentication, then Users.

This matters more than it might appear: a deployed URL is publicly reachable, and
this application holds personal behavioural data. Row level security scopes data
per user, but without this step anyone could register an account on your
deployment.

### 5. Configure the URLs

Authentication, then URL Configuration. Set the Site URL and add redirect URLs
for `http://localhost:3000` during development and for the production domain once
it exists. A mismatch here shows up as a login that loops back to the sign-in
page.

### 6. Apply the schema

After the local suite is green, the owner applies migrations to the cloud
project:

```bash
npx supabase db push
```

This applies pending local migrations to the linked cloud project. It changes
schema on the real database and is not trivially reversible. Confirm
`npm run db:reset && npm run test:db` is green locally first.

---

## Environment variables

| Variable                        | Where            | Notes                                     |
| ------------------------------- | ---------------- | ----------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | local and Vercel | Public. Safe in the browser bundle        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local and Vercel | Public. Protected by row level security   |
| `SUPABASE_ACCESS_TOKEN`         | local only       | CLI use. Never added to Vercel            |
| `SUPABASE_DB_URL`               | local only       | Optional override for the invariant suite |

The `NEXT_PUBLIC_` prefix means "compiled into the browser bundle". It is not a
naming convention — it is a disclosure. Nothing sensitive ever receives it.

For Vercel, the owner adds the two public variables to Production and Preview
through the dashboard.

---

## Security posture

- Row level security on every table, enabled in the same migration that creates
  the table. A schema guard test fails the build if a table is added without it.
- Policies scope to `user_id = auth.uid()`, with `WITH CHECK` on every write
  policy — `USING` alone would let a user write rows owned by someone else.
- Functions are `SECURITY INVOKER` so RLS still applies. `SECURITY DEFINER`
  bypasses it and is treated as a defect.
- `audit_events` has select and insert policies and deliberately no update or
  delete policy.
- The service-role key is absent from the architecture by design.

---

## Troubleshooting

**`db:start` fails.** Docker is not running, or ports are taken by another local
Postgres. Port assignments live in `supabase/config.toml`.

**Login loops back to sign-in.** Redirect URLs in the dashboard do not match the
origin being used.

**Local and cloud schemas disagree.** Something was changed by hand in the
dashboard. Reconcile by writing a migration; never patch the cloud directly.

**`test:db` reports psql missing.** The local stack ships one, but it may not be
on `PATH`. Set `SUPABASE_DB_URL` and ensure a `psql` client is available.

**Docker Desktop fails to start with an Inference manager error.** If the
engine never comes up and the error names a file under
`AppData\Local\Docker\run\dockerInference` that cannot be removed, a stale
socket entry is blocking service startup. Symptoms: `docker ps` returns HTTP
500 or reports a missing named pipe, and `docker pull` hangs indefinitely even
for a tiny image. Fix by quitting Docker Desktop entirely, deleting that file,
and starting it again; if the file cannot be deleted because it is held open,
reboot, or turn off Docker Model Runner under Settings, Beta features.
