import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { NAV_ITEMS } from "@/components/shell/nav-items";
import { ptBR } from "@/lib/i18n/pt-BR";

/**
 * Every user-facing string lives in `lib/i18n/pt-BR.ts`.
 *
 * Not a stylistic preference: a literal that slips into a component is invisible
 * to anyone reviewing the copy, and this product's tone — direct, calm, never
 * scolding — is a real requirement rather than decoration. A rule message that
 * shames the user is a defect, and it cannot be reviewed if it is scattered
 * across twenty files.
 */

const SOURCE_ROOTS = ["app", "components"];

/** Attributes whose values a person actually reads or hears. */
const USER_FACING_ATTRIBUTES = ["aria-label", "placeholder", "title", "alt"];

function sourceFiles(): string[] {
  // Node's own recursive walk, rather than pulling in a glob dependency for
  // two directories.
  return SOURCE_ROOTS.flatMap((root) => {
    const base = join(process.cwd(), root);
    return readdirSync(base, { recursive: true, encoding: "utf8" })
      .filter((entry) => entry.endsWith(".tsx"))
      .map((entry) => join(base, entry));
  });
}

function hasWords(text: string): boolean {
  // Two or more letters in a row. Punctuation, whitespace and entities alone
  // are not copy.
  return /\p{L}{2,}/u.test(text);
}

describe("user-facing strings", () => {
  const files = sourceFiles();

  it("finds source files to check, so the assertions below mean something", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("has no literal text between JSX tags", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");

      for (const match of source.matchAll(/>([^<>{}]+)</g)) {
        const text = (match[1] ?? "").trim();
        if (text && hasWords(text)) {
          offenders.push(`${relative(process.cwd(), file)}: ${JSON.stringify(text)}`);
        }
      }
    }

    expect(offenders, `hardcoded JSX text:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("has no literal text in user-facing attributes", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");

      for (const attribute of USER_FACING_ATTRIBUTES) {
        const pattern = new RegExp(`${attribute}="([^"]+)"`, "g");
        for (const match of source.matchAll(pattern)) {
          const text = match[1] ?? "";
          if (hasWords(text)) {
            offenders.push(
              `${relative(process.cwd(), file)}: ${attribute}=${JSON.stringify(text)}`,
            );
          }
        }
      }
    }

    expect(offenders, `hardcoded attribute copy:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("can actually detect a violation", () => {
    // Guards the guard. The regexes above are easy to get subtly wrong in a way
    // that matches nothing and passes forever.
    const sample = `export default function X() { return <p>Texto solto</p>; }`;
    const found = [...sample.matchAll(/>([^<>{}]+)</g)]
      .map((m) => (m[1] ?? "").trim())
      .filter(hasWords);

    expect(found).toEqual(["Texto solto"]);
  });
});

describe("navigation", () => {
  it("has exactly the seven areas, in order", () => {
    expect(NAV_ITEMS.map((item) => item.key)).toEqual([
      "dashboard",
      "missions",
      "curiosities",
      "knowledge",
      "history",
      "rules",
      "settings",
    ]);
  });

  it("labels every area from the string map", () => {
    for (const item of NAV_ITEMS) {
      expect(ptBR.nav[item.key], `${item.key} has no label`).toBeTruthy();
    }
  });

  it("points every area at a distinct route", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("has a page file behind every route", () => {
    // A navigation entry that 404s is worse than one that does not exist.
    for (const item of NAV_ITEMS) {
      const page = join(process.cwd(), "app", "(app)", item.href.replace(/^\//, ""), "page.tsx");
      expect(() => readFileSync(page, "utf8"), `${item.href} has no page`).not.toThrow();
    }
  });

  it("gives every area a title and a description", () => {
    for (const item of NAV_ITEMS) {
      const page = ptBR.pages[item.key];
      expect(page.title.length, `${item.key} title`).toBeGreaterThan(0);
      expect(page.description.length, `${item.key} description`).toBeGreaterThan(0);
    }
  });
});
