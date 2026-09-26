import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RULES } from "@/lib/rules/registry";

/**
 * The Rules page reads from the database. The application reasons from
 * registry.ts. If those two disagree, the page tells the user they are
 * protected by a rule the system is not actually applying — a worse failure
 * than having no Rules page at all.
 *
 * This parses the seed out of the migrations rather than querying Postgres, so
 * the check runs everywhere, including where no database is available.
 *
 * Every seeding INSERT is read, across every migration, in order. Migrations are
 * forward-only, so a rule added after the first seed necessarily arrives in a
 * later file; reading only the first file would report a correctly seeded new
 * rule as missing.
 */

const MIGRATIONS_DIR = "supabase/migrations";

type SeedRow = Record<string, string | undefined>;

function readSeededRules(): SeedRow[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const inserts = files.flatMap((file) => [
    ...readFileSync(join(MIGRATIONS_DIR, file), "utf8").matchAll(
      /insert\s+into\s+public\.rules\s*\(([^)]*)\)\s*values\s*([\s\S]*?);/gi,
    ),
  ]);

  if (inserts.length === 0) {
    throw new Error("No migration seeds public.rules. The registry has nothing to agree with.");
  }

  return inserts.flatMap((insert) => {
    const columns = (insert[1] ?? "").split(",").map((c) => c.trim());
    return [...(insert[2] ?? "").matchAll(/\(([^)]*)\)/g)].map((match) => {
      const values = (match[1] ?? "").split(",").map((v) => v.trim().replace(/^'|'$/g, ""));
      return Object.fromEntries(columns.map((column, i) => [column, values[i]]));
    });
  });
}

describe("rules registry parity", () => {
  const seeded = readSeededRules();

  it("parses a non-empty seed, so the assertions below are meaningful", () => {
    expect(seeded.length).toBeGreaterThan(0);
  });

  it("seeds exactly the rules the registry declares", () => {
    expect(seeded.map((r) => r.code).sort()).toEqual(RULES.map((r) => r.code).sort());
  });

  /**
   * Reading every seed opens a new way to be wrong: the same rule inserted
   * twice. Postgres would refuse that at the primary key, but only once the
   * migration ran — this says so without a database.
   */
  it("seeds each rule exactly once", () => {
    const codes = seeded.map((r) => r.code);
    expect(new Set(codes).size, `duplicated in the seed: ${codes.join(", ")}`).toBe(codes.length);
  });

  it.each(RULES)("$code has matching severity, enforcement and position", (rule) => {
    const row = seeded.find((r) => r.code === rule.code);
    expect(row, `${rule.code} is missing from the migration seed`).toBeDefined();
    expect(row?.severity).toBe(rule.severity);
    expect(row?.enforcement).toBe(rule.enforcement);
    expect(Number(row?.position)).toBe(rule.position);
  });

  it("gives every rule a distinct code and position", () => {
    expect(new Set(RULES.map((r) => r.code)).size).toBe(RULES.length);
    expect(new Set(RULES.map((r) => r.position)).size).toBe(RULES.length);
  });
});
