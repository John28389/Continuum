import { z } from "zod";

/**
 * Knowledge notes and links.
 *
 * Mirrors `knowledge_notes` and `knowledge_links`. Only a title and content are
 * required — the type is optional and defaults to "concept", like the column —
 * because a note system that must be fed becomes administration, which is the
 * opposite of what this product is for.
 */

export const NOTE_TYPES = [
  "discovery",
  "concept",
  "evidence",
  "connection",
  "error",
  "generalisation",
] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const LINK_RELATIONS = [
  "relates_to",
  "supports",
  "contradicts",
  "extends",
  "derived_from",
] as const;
export type LinkRelation = (typeof LINK_RELATIONS)[number];

const requiredText = (max: number) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, "required").max(max));

/** "" is the form's way of not choosing; it means the column default. */
const noteType = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.union([z.literal(""), z.enum(NOTE_TYPES)]))
  .transform((value): NoteType => (value === "" ? "concept" : value));

const optionalId = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.union([z.literal(""), z.string().uuid()]))
  .transform((value) => (value === "" ? null : value));

export const noteSchema = z.object({
  title: requiredText(160),
  content: requiredText(20_000),
  noteType,
  // The mission the note came from. Optional, and fixed once set: the origin is
  // part of the record, not a field to edit later.
  missionId: optionalId,
});
export type NoteInput = z.infer<typeof noteSchema>;

export const noteUpdateSchema = z.object({
  noteId: z.string().uuid("required"),
  title: requiredText(160),
  content: requiredText(20_000),
  noteType,
});
export type NoteUpdateInput = z.infer<typeof noteUpdateSchema>;

/** Mirrors `knowledge_links_no_self_link` and `knowledge_links_relation_valid`. */
export const linkSchema = z
  .object({
    fromNoteId: z.string().uuid("required"),
    toNoteId: z.string().uuid("required"),
    relation: z.enum(LINK_RELATIONS),
  })
  .refine((value) => value.fromNoteId !== value.toNoteId, {
    message: "self",
    path: ["toNoteId"],
  });
export type LinkInput = z.infer<typeof linkSchema>;
