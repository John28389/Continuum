import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isRuleCode } from "@/lib/rules/registry";

/**
 * Static guards over the migrations.
 *
 * The adversarial SQL suite is the real proof that the invariants hold, and it
 * needs a running database. These checks are cheaper and weaker, but they run
 * anywhere and they catch the specific mistakes that silently remove
 * protection: a table shipped without row level security, a definer function
 * that bypasses it, or an enforcement object quietly deleted.
 *
 * They are a floor, not a substitute. `npm run test:db` is what actually
 * demonstrates that a second active mission is refused.
 */

const MIGRATIONS_DIR = "supabase/migrations";

const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => ({ file, sql: readFileSync(join(MIGRATIONS_DIR, file), "utf8") }));

const allSql = migrations.map((m) => m.sql).join("\n");

function createdTables(sql: string): string[] {
  return [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi)].map(
    (m) => m[1] as string,
  );
}

describe("migrations", () => {
  it("there are migrations to check", () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  it("every created table enables row level security", () => {
    const tables = createdTables(allSql);
    expect(tables.length).toBeGreaterThan(0);

    const missing = tables.filter(
      (table) =>
        !new RegExp(
          `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
          "i",
        ).test(allSql),
    );

    expect(missing, `tables created without row level security: ${missing.join(", ")}`).toEqual([]);
  });

  it("every created table has at least one policy", () => {
    const tables = createdTables(allSql);
    const missing = tables.filter(
      (table) =>
        !new RegExp(`create\\s+policy\\s+"[^"]+"\\s+on\\s+public\\.${table}\\b`, "i").test(allSql),
    );

    expect(missing, `tables with no policy: ${missing.join(", ")}`).toEqual([]);
  });

  /**
   * SECURITY DEFINER runs with the owner's rights and bypasses row level
   * security entirely. One of these in the wrong place voids the whole
   * enforcement model, so the schema carries none at all.
   */
  it("uses no SECURITY DEFINER functions", () => {
    const offenders = migrations
      .filter((m) => /security\s+definer/i.test(m.sql))
      .map((m) => m.file);

    expect(offenders, `SECURITY DEFINER found in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("pins search_path on every function that sets one, and sets one on every RPC", () => {
    const rpcs = [
      ...allSql.matchAll(/create\s+or\s+replace\s+function\s+public\.(\w+)\s*\(([\s\S]*?)\$\$/gi),
    ];
    const unpinned = rpcs
      .filter(([, , body]) => /security\s+invoker/i.test(body ?? ""))
      .filter(([, , body]) => !/set\s+search_path\s*=/i.test(body ?? ""))
      .map(([, name]) => name as string);

    expect(
      unpinned,
      `SECURITY INVOKER functions without a pinned search_path: ${unpinned.join(", ")}`,
    ).toEqual([]);
  });

  it("keeps the partial unique indexes that enforce the single-active rules", () => {
    expect(
      /create\s+unique\s+index\s+missions_one_active_per_user[\s\S]*?where\s+status\s*=\s*'active'/i.test(
        allSql,
      ),
      "RULE-001 depends on a partial unique index on missions",
    ).toBe(true);

    expect(
      /create\s+unique\s+index\s+cycles_one_active_per_user[\s\S]*?where\s+status\s*=\s*'active'/i.test(
        allSql,
      ),
      "one active cycle per user depends on a partial unique index on cycles",
    ).toBe(true);
  });

  it("enforces the mission load floor as a check constraint", () => {
    expect(
      /constraint\s+missions_load_coherent[\s\S]*?min_load_minutes\s*>\s*0[\s\S]*?target_load_minutes\s*>=\s*min_load_minutes/i.test(
        allSql,
      ),
      "RULE-003 depends on the missions_load_coherent check constraint",
    ).toBe(true);
  });

  it("guards activation and terminal state with row-level triggers", () => {
    for (const trigger of [
      "missions_enforce_activation",
      "missions_enforce_completion",
      "missions_enforce_exit_review",
      "missions_enforce_terminal_state",
      "missions_close_running_session",
      "mission_dod_criteria_frozen",
      "mission_evidence_frozen",
      "mission_sessions_frozen",
    ]) {
      const declaration = new RegExp(
        `create\\s+trigger\\s+${trigger}[\\s\\S]*?execute\\s+function`,
        "i",
      ).exec(allSql);
      expect(declaration, `${trigger} is missing`).not.toBeNull();
      expect(
        /for\s+each\s+row/i.test(declaration?.[0] ?? ""),
        `${trigger} must be FOR EACH ROW, or multi-row updates bypass it`,
      ).toBe(true);
    }
  });

  it("covers the update path on the activation guard, not only insert", () => {
    const trigger =
      /create\s+trigger\s+missions_enforce_activation[\s\S]*?execute\s+function/i.exec(allSql);
    expect(trigger?.[0]).toMatch(/before\s+insert\s+or\s+update/i);
  });

  /**
   * RULE-008 has to cover insert as well as update: a mission inserted straight
   * into `completed` would otherwise skip the Definition of Done entirely.
   */
  it("covers insert and update on the completion guard", () => {
    const trigger =
      /create\s+trigger\s+missions_enforce_completion[\s\S]*?execute\s+function/i.exec(allSql);
    expect(trigger?.[0]).toMatch(/before\s+insert\s+or\s+update/i);
  });

  /**
   * RULE-006 freezes a finished record. Criteria can be added, edited or
   * removed, so all three operations are guarded — a delete rewrites a
   * Definition of Done as surely as an update does.
   */
  it("freezes every write to a finished mission's criteria", () => {
    const trigger =
      /create\s+trigger\s+mission_dod_criteria_frozen[\s\S]*?execute\s+function/i.exec(allSql);
    expect(trigger?.[0]).toMatch(/before\s+insert\s+or\s+update\s+or\s+delete/i);
  });

  it("keeps the audit trail append-only", () => {
    expect(/create\s+policy[^;]*on\s+public\.audit_events\s+for\s+update/i.test(allSql)).toBe(
      false,
    );
    expect(/create\s+policy[^;]*on\s+public\.audit_events\s+for\s+delete/i.test(allSql)).toBe(
      false,
    );
  });

  it("only raises rule codes that exist in the registry", () => {
    const raised = [...allSql.matchAll(/raise_rule_violation\(\s*'([^']+)'/gi)].map(
      (m) => m[1] as string,
    );
    expect(raised.length).toBeGreaterThan(0);

    const unknown = [...new Set(raised)].filter((code) => !isRuleCode(code));
    expect(unknown, `migrations raise unknown rule codes: ${unknown.join(", ")}`).toEqual([]);
  });

  it("does not grant write access to the rules registry", () => {
    for (const command of ["insert", "update", "delete"]) {
      expect(
        new RegExp(`create\\s+policy[^;]*on\\s+public\\.rules\\s+for\\s+${command}`, "i").test(
          allSql,
        ),
        `the rules table must not be writable by the application (${command})`,
      ).toBe(false);
    }
  });
});
