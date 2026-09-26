import { execFileSync } from "node:child_process";

/**
 * Minimal psql access for end-to-end fixtures.
 *
 * Deliberately separate from `scripts/run-db-tests.mjs`, which stays a
 * dependency-free script so `npm run verify` can call it directly. The overlap
 * is about thirty lines of process plumbing; sharing it would mean importing
 * a `.mjs` module into the typed test build for very little gain.
 */

const HOST_DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const CONTAINER_DB_URL = "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

function containerName(): string | null {
  try {
    const found = execFileSync(
      "docker",
      ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
      { encoding: "utf8", timeout: 30_000 },
    )
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return found[0] ?? null;
  } catch {
    return null;
  }
}

/** Runs a SQL script, raising if it fails. */
export function runSql(script: string): void {
  const args = ["--no-psqlrc", "--quiet", "--set=ON_ERROR_STOP=1", "--file", "-"];

  try {
    execFileSync("psql", ["--version"], { stdio: "ignore" });
    execFileSync("psql", [HOST_DB_URL, ...args], {
      input: script,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return;
  } catch {
    // No psql on PATH, or nothing answered on it. Fall through to the container.
  }

  const container = containerName();
  if (!container) {
    throw new Error(
      "No psql client could reach the database. Start the local stack with `npm run db:start`.",
    );
  }

  execFileSync("docker", ["exec", "-i", container, "psql", CONTAINER_DB_URL, ...args], {
    input: script,
    stdio: ["pipe", "pipe", "pipe"],
  });
}
