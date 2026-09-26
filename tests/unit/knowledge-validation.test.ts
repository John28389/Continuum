import { describe, expect, it } from "vitest";

import { toUserMessage } from "@/lib/domain/errors";
import { ptBR } from "@/lib/i18n/pt-BR";
import { linkSchema, noteSchema, noteUpdateSchema } from "@/lib/validation/knowledge";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";

describe("a note needs only a title and content", () => {
  const minimal = {
    title: "Injeção de SQL",
    content: "Preparados resolvem.",
    noteType: "",
    missionId: "",
  };

  it("accepts the minimum, and fills in the rest", () => {
    const parsed = noteSchema.parse(minimal);
    expect(parsed.noteType).toBe("concept");
    expect(parsed.missionId).toBeNull();
  });

  it("refuses a blank title or blank content", () => {
    expect(noteSchema.safeParse({ ...minimal, title: "   " }).success).toBe(false);
    expect(noteSchema.safeParse({ ...minimal, content: "\n  " }).success).toBe(false);
  });

  it("accepts the known types and refuses others", () => {
    expect(noteSchema.parse({ ...minimal, noteType: "discovery" }).noteType).toBe("discovery");
    expect(noteSchema.safeParse({ ...minimal, noteType: "tag" }).success).toBe(false);
  });

  it("carries a mission as its origin when given one", () => {
    expect(noteSchema.parse({ ...minimal, missionId: a }).missionId).toBe(a);
    expect(noteSchema.safeParse({ ...minimal, missionId: "not-a-mission" }).success).toBe(false);
  });

  /** The origin is part of the record: editing a note never moves it. */
  it("does not accept an origin when editing", () => {
    const parsed = noteUpdateSchema.parse({ ...minimal, noteId: a, missionId: b } as never);
    expect(Object.keys(parsed).sort()).toEqual(["content", "noteId", "noteType", "title"]);
  });
});

describe("links", () => {
  it("links two different notes with a known relation", () => {
    expect(linkSchema.safeParse({ fromNoteId: a, toNoteId: b, relation: "supports" }).success).toBe(
      true,
    );
  });

  it("refuses a note linked to itself", () => {
    const result = linkSchema.safeParse({ fromNoteId: a, toNoteId: a, relation: "supports" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["toNoteId"]);
  });

  it("refuses a relation outside the five", () => {
    expect(linkSchema.safeParse({ fromNoteId: a, toNoteId: b, relation: "tagged" }).success).toBe(
      false,
    );
  });
});

describe("knowledge refusals become explanations", () => {
  const cases = [
    {
      message:
        'new row for relation "knowledge_links" violates check constraint "knowledge_links_no_self_link"',
      expected: ptBR.knowledge.selfLink,
    },
    {
      message: 'duplicate key value violates unique constraint "knowledge_links_unique_triple"',
      expected: ptBR.knowledge.duplicateLink,
    },
    {
      message:
        'new row for relation "knowledge_notes" violates check constraint "knowledge_notes_title_not_blank"',
      expected: ptBR.knowledge.titleRequired,
    },
  ];

  for (const { message, expected } of cases) {
    it(`explains ${message.split('"').at(-2)}`, () => {
      const explained = toUserMessage({ code: "23514", message });
      expect(explained).toBe(expected);
      for (const leak of ["knowledge_", "constraint", "relation", "duplicate key"]) {
        expect(explained.toLowerCase()).not.toContain(leak);
      }
    });
  }
});

describe("nothing requires a note", () => {
  it("never tells the reader they must write one", () => {
    // Widened first: the map is `as const`, so its values are literals and
    // nested objects, and a plain string predicate does not fit that union.
    const copy = (Object.values(ptBR.knowledge) as unknown[])
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase();
    for (const demand of ["obrigatório escrever", "você precisa", "não esqueça", "lembre-se de"]) {
      expect(copy).not.toContain(demand);
    }
  });
});
