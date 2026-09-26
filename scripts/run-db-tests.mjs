#!/usr/bin/env node
/**
 * Runs the SQL invariant suite against the local Supabase Postgres.
 *
 * The suite is adversarial: each file actively attempts to violate an invariant
 * and asserts that the database refuses. A file that cannot fail is worthless,
 * so the runner exits non-zero on the first failing assertion and never
 * swallows psql's output.
 *
 * A psql client is found in one of two ways: on PATH, or inside the local
 * Supabase database container. The container is the usual case on a machine
 * that has Docker but no Postgres client installed, and it means the suite
 * needs no host-level database tooling at all.
 *
 * Each script is assembled in memory — helpers first, then the test body with
 * its \i line removed — and piped to psql over stdin. That keeps the whole
 * thing independent of the working directory, which matters because the
 * container does not have the repository mounted.
 *
 * When no database is reachable the suite is SKIPPED rather than failed, so
 * that `npm run verify` stays usable where the local stack is not running.
 * That is a real gap, not a pass, so it is reported loudly, and
 * `CONTINUUM_REQUIRE_DB=1` turns it back into a hard failure — which is what
 * any pipeline gating a release should set.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TESTS_DIR = "supabase/tests";
const HELPERS = join(TESTS_DIR, "helpers.sql");
const HOST_DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const CONTAINER_DB_URL = "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
const REQUIRE_DB = process.env.CONTINUUM_REQUIRE_DB === "1";

const PSQL_ARGS = ["--no-psqlrc", "--quiet", "--set=ON_ERROR_STOP=1", "--file", "-"];

/** Reports a gap in coverage. Exits non-zero only when the caller demanded a database. */
function skip(reason) {
  const banner = "=".repeat(72);
  console.warn(banner);
  console.warn("[test:db] SKIPPED — the invariant suite did NOT run.");
  console.warn(`[test:db] ${reason}`);
  console.warn("[test:db] The database-level rules are therefore UNVERIFIED in this run.");
  console.warn("[test:db] Start the stack with `npm run db:start`, then re-run.");
  console.warn(banner);
  if (REQUIRE_DB) {
    console.error("[test:db] CONTINUUM_REQUIRE_DB=1 is set, so a skip is a failure.");
    process.exit(1);
  }
  process.exit(0);
}

const mask = (url) => url.replace(/:[^:@/]*@/, ":***@");

/**
 * A connection string as pasted into a terminal, made usable.
 *
 * Git Bash wraps a paste in bracketed-paste markers (ESC[200~ … ESC[201~) and
 * can carry invisible characters with it; inside `read -s` none of that is
 * visible, and psql then rejects an address that looked right. Escape
 * sequences and anything outside printable ASCII are removed — a valid
 * connection string contains neither.
 */
function cleanUrl(raw) {
  if (!raw) return null;
  const url = raw
    .replace(/\x1b\[[0-9;]*~/g, "")
    .replace(/[^\x21-\x7e]/g, "")
    .trim();
  return url === "" ? null : url;
}

function failToConnect(url, error) {
  const detail = (error?.stderr?.toString() ?? String(error)).trim().replaceAll(url, mask(url));
  console.error(`[test:db] Could not connect to SUPABASE_DB_URL (${mask(url)}).`);
  console.error(`[test:db] psql said: ${detail || "(nothing)"}`);
  console.error("[test:db] Check that:");
  console.error(
    "[test:db]  - it is the Session pooler URI (host ends in pooler.supabase.com, port 5432);",
  );
  console.error(
    "[test:db]  - [YOUR-PASSWORD] was replaced, brackets included, by the database password;",
  );
  console.error(
    "[test:db]  - the password has no @ # : / ? % (reset it to letters and digits if it does).",
  );
  process.exit(1);
}

function tryRun(command, args, input) {
  return execFileSync(command, args, {
    input,
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 120_000,
  });
}

/** Resolves how to reach psql, or null when there is no route to a database. */
function resolveRunner() {
  try {
    execFileSync("psql", ["--version"], { stdio: "ignore" });
    try {
      tryRun("psql", [HOST_DB_URL, "--no-psqlrc", "--quiet", "--command", "select 1"], "");
      return {
        label: `psql on PATH -> ${HOST_DB_URL.replace(/:[^:@/]*@/, ":***@")}`,
        run: (script) => tryRun("psql", [HOST_DB_URL, ...PSQL_ARGS], script),
      };
    } catch {
      // psql exists but nothing answered; fall through to the container.
    }
  } catch {
    // No psql on PATH; fall through to the container.
  }

  let container = "";
  try {
    container =
      execFileSync("docker", ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"], {
        encoding: "utf8",
        timeout: 30_000,
      })
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)[0] ?? "";
  } catch {
    return null;
  }

  if (!container) return null;

  // When SUPABASE_DB_URL is set — the cloud project, for M6-cloud — the
  // container is only a psql client and must connect there. Falling back to
  // the local database instead would report the wrong database as green,
  // which is the harness-that-cannot-go-red this suite exists to prevent.
  const cloud = cleanUrl(process.env.SUPABASE_DB_URL);
  const target = cloud ?? CONTAINER_DB_URL;

  try {
    tryRun(
      "docker",
      ["exec", "-i", container, "psql", target, "--no-psqlrc", "--quiet", "--command", "select 1"],
      "",
    );
  } catch (error) {
    // An explicit target that cannot be reached is a failure, never a skip:
    // the person asked for that database, and "skipped" would hide why.
    if (cloud) failToConnect(cloud, error);
    return null;
  }

  return {
    label: `psql inside container ${container} -> ${target.replace(/:[^:@/]*@/, ":***@")}`,
    run: (script) =>
      tryRun("docker", ["exec", "-i", container, "psql", target, ...PSQL_ARGS], script),
  };
}

if (!existsSync(TESTS_DIR)) skip(`${TESTS_DIR} does not exist yet.`);
if (!existsSync(HELPERS)) skip(`${HELPERS} is missing, so no test can set itself up.`);

const files = readdirSync(TESTS_DIR)
  .filter((f) => f.endsWith(".test.sql"))
  .sort();

if (files.length === 0) skip(`No *.test.sql files found in ${TESTS_DIR}.`);

const runner = resolveRunner();
if (!runner) {
  skip("No psql client could reach a database, on PATH or in a Supabase container.");
}

const helpers = readFileSync(HELPERS, "utf8");
console.log(`[test:db] using ${runner.label}`);

let failed = 0;

for (const file of files) {
  // The helpers are inlined, so the \i that loads them is dropped.
  const body = readFileSync(join(TESTS_DIR, file), "utf8").replace(
    /^[ \t]*\\i[ \t]+\S*helpers\.sql[ \t]*$/gim,
    "",
  );
  // Wrapped in a transaction that always rolls back, so a run leaves behind no
  // fixtures, no test users, and no tests schema. psql --single-transaction
  // COMMITs on success, which made the suite pass once and then fail on
  // duplicate fixtures the second time.
  const script = `begin;\n${helpers}\n${body}\nrollback;\n`;

  process.stdout.write(`[test:db] ${file} ... `);
  try {
    runner.run(script);
    console.log("ok");
  } catch (error) {
    failed += 1;
    console.log("FAILED");
    const stdout = error.stdout?.toString().trim();
    const stderr = error.stderr?.toString().trim();
    if (stdout) console.error(stdout);
    if (stderr) console.error(stderr);
  }
}

if (failed > 0) {
  console.error(`\n[test:db] ${failed} of ${files.length} file(s) failed.`);
  process.exit(1);
}

console.log(`\n[test:db] ${files.length} file(s) passed.`);
