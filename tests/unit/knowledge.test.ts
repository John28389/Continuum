import { describe, expect, it } from "vitest";

import { excerpt, linksOf, searchNotes, type NoteRef } from "@/lib/domain/knowledge";

const note = (
  id: string,
  title: string,
  content: string,
  note_type = "concept",
  updated_at = "2026-09-10T12:00:00+00:00",
) => ({ id, title, content, note_type, updated_at });

const notes = [
  note(
    "a",
    "Injeção de SQL",
    "Parâmetros preparados resolvem a classe inteira.",
    "discovery",
    "2026-09-12T10:00:00+00:00",
  ),
  note(
    "b",
    "CSP e XSS refletido",
    "O relatório do lab 4 mostrou onde a política falha.",
    "error",
    "2026-09-11T10:00:00+00:00",
  ),
  note(
    "c",
    "Modelo mental de sessões",
    "Cookies, tokens e onde cada um mora.",
    "concept",
    "2026-09-13T10:00:00+00:00",
  ),
];

describe("search", () => {
  it("returns every note, newest first, when nothing is asked", () => {
    expect(searchNotes(notes).map((n) => n.id)).toEqual(["c", "a", "b"]);
  });

  it("matches the title and the content", () => {
    expect(searchNotes(notes, { query: "sql" }).map((n) => n.id)).toEqual(["a"]);
    expect(searchNotes(notes, { query: "cookies" }).map((n) => n.id)).toEqual(["c"]);
  });

  it("ignores case and accents in both directions", () => {
    expect(searchNotes(notes, { query: "RELATORIO" }).map((n) => n.id)).toEqual(["b"]);
    expect(searchNotes(notes, { query: "injecao" }).map((n) => n.id)).toEqual(["a"]);
    expect(searchNotes(notes, { query: "parametros" }).map((n) => n.id)).toEqual(["a"]);
  });

  it("requires every word to match, anywhere", () => {
    expect(searchNotes(notes, { query: "lab política" }).map((n) => n.id)).toEqual(["b"]);
    expect(searchNotes(notes, { query: "lab cookies" })).toEqual([]);
  });

  it("filters by type, alone or with a query", () => {
    expect(searchNotes(notes, { type: "error" }).map((n) => n.id)).toEqual(["b"]);
    expect(searchNotes(notes, { query: "sql", type: "error" })).toEqual([]);
  });

  /**
   * Characters that mean something to a PostgREST filter mean nothing here,
   * because the search never builds one. They are searched for literally.
   */
  it("treats filter syntax as plain text", () => {
    expect(searchNotes(notes, { query: "a),title.eq.(x" })).toEqual([]);
    expect(searchNotes([note("d", "a,b(c)", "x")], { query: "a,b(c)" }).map((n) => n.id)).toEqual([
      "d",
    ]);
  });
});

describe("excerpt", () => {
  it("keeps short content whole, flattened", () => {
    expect(excerpt("linha um\n\nlinha   dois")).toBe("linha um linha dois");
  });

  it("cuts long content with an ellipsis", () => {
    const cut = excerpt("x".repeat(400), 20);
    expect(cut).toHaveLength(20);
    expect(cut.endsWith("…")).toBe(true);
  });
});

describe("links and backlinks", () => {
  const byId = new Map<string, NoteRef>(
    [
      { id: "a", title: "Injeção de SQL", note_type: "discovery" },
      { id: "b", title: "CSP", note_type: "error" },
      { id: "c", title: "Autenticação", note_type: "concept" },
    ].map((n) => [n.id, n]),
  );

  const links = [
    { id: "l1", from_note_id: "a", to_note_id: "b", relation: "supports" },
    { id: "l2", from_note_id: "c", to_note_id: "a", relation: "extends" },
    { id: "l3", from_note_id: "a", to_note_id: "c", relation: "relates_to" },
  ];

  it("reads a stored link from both ends", () => {
    const fromA = linksOf("a", links, byId);
    expect(fromA.outgoing.map((l) => l.note.id)).toEqual(["c", "b"]);
    expect(fromA.backlinks.map((l) => l.note.id)).toEqual(["c"]);

    const fromB = linksOf("b", links, byId);
    expect(fromB.outgoing).toEqual([]);
    expect(fromB.backlinks).toEqual([{ linkId: "l1", relation: "supports", note: byId.get("a") }]);
  });

  it("orders each side by title", () => {
    expect(linksOf("a", links, byId).outgoing.map((l) => l.note.title)).toEqual([
      "Autenticação",
      "CSP",
    ]);
  });

  it("leaves out a link whose other note is not known", () => {
    const dangling = [{ id: "l9", from_note_id: "a", to_note_id: "zzz", relation: "supports" }];
    expect(linksOf("a", dangling, byId)).toEqual({ outgoing: [], backlinks: [] });
  });

  it("ignores links that do not touch the note", () => {
    expect(linksOf("b", [links[1]!], byId)).toEqual({ outgoing: [], backlinks: [] });
  });
});
