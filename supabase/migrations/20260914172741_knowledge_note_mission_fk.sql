-- A note outlives the mission it came from.
--
-- knowledge_notes_mission_same_owner (M5) was ON DELETE SET NULL over
-- (mission_id, user_id). Postgres nulls every referencing column, so deleting a
-- mission that had notes tried to set user_id — which is NOT NULL — to null, and
-- the delete failed. Found by reading during M14; see docs/decisions.md.
--
-- Postgres 15 and later let SET NULL name the column it clears. Only the origin
-- goes; the note, and its owner, stay. This is the form M11 already used for
-- evidence citing a criterion.
--
-- No rule changes here, and ownership is not loosened: the key still spans
-- (mission_id, user_id), so a note can only ever cite its own owner's mission.
-- Tested by supabase/tests/070_knowledge_notes.test.sql.

alter table public.knowledge_notes
  drop constraint knowledge_notes_mission_same_owner;

alter table public.knowledge_notes
  add constraint knowledge_notes_mission_same_owner
    foreign key (mission_id, user_id)
    references public.missions (id, user_id)
    on delete set null (mission_id);

comment on constraint knowledge_notes_mission_same_owner on public.knowledge_notes is
  'A note may cite only its owner''s mission; deleting that mission clears the citation and keeps the note.';
