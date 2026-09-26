-- Knowledge notes and their origin mission.
--
-- Regression test for a defect found by reading in M14: the composite foreign
-- key from a note to its mission was ON DELETE SET NULL over (mission_id,
-- user_id), so deleting a mission that had notes tried to null user_id — which
-- is NOT NULL — and the delete failed. A note is knowledge that outlives the
-- mission it came from; losing the mission must un-cite the note, not block
-- the deletion and not delete the note.
--
-- The adversarial half: the fix narrows what SET NULL clears, and must not
-- loosen ownership. A note still cannot cite another user's mission.

\i supabase/tests/helpers.sql

select tests.logout();
select tests.create_user('notes-a@continuum.test') as id \gset user_a_
select tests.create_user('notes-b@continuum.test') as id \gset user_b_

select tests.login_as(:'user_a_id');
select tests.assert_rls_applies();

-- ===========================================================================
-- Fixtures: a draft mission, and a note that came from it
-- ===========================================================================

insert into public.directions (user_id, title)
values (:'user_a_id', 'Grow professional value')
returning id \gset direction_

insert into public.campaigns (user_id, direction_id, name, objective, starts_on, ends_on)
values (:'user_a_id', :'direction_id', 'Web exploitation', 'Practical competence',
        current_date, current_date + 90)
returning id \gset campaign_

insert into public.cycles (user_id, label, starts_on, ends_on, status)
values (:'user_a_id', 'September', current_date, current_date + 30, 'active')
returning id \gset cycle_

insert into public.missions
  (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
values (:'user_a_id', :'cycle_id', :'campaign_id', 'A mission that will be deleted',
        'Planned, then dropped', 60, 120)
returning id \gset mission_

-- Positive control. If this fails, psql stops the file.
insert into public.knowledge_notes (user_id, title, content, mission_id)
values (:'user_a_id', 'What the planning taught', 'Scope first, then tools.', :'mission_id')
returning id \gset note_

-- ===========================================================================
-- Ownership still holds
-- ===========================================================================

select tests.login_as(:'user_b_id');
select tests.assert_rls_applies();

-- B cannot see A's mission, but the composite key is what refuses the row:
-- a note must cite a mission with the same owner.
select tests.assert_refused(
  format(
    'insert into public.knowledge_notes (user_id, title, content, mission_id)
     values (%L, %L, %L, %L)',
    :'user_b_id', 'Not my mission', 'Citing someone else''s work', :'mission_id'
  ),
  'a note cannot cite another user''s mission',
  'knowledge_notes_mission_same_owner'
);

-- ===========================================================================
-- Deleting the mission un-cites the note
-- ===========================================================================

select tests.login_as(:'user_a_id');

select tests.assert_allowed(
  format('delete from public.missions where id = %L', :'mission_id'),
  'a mission that has notes can be deleted'
);

do $$
begin
  perform tests.assert(
    (select count(*) = 1 from public.knowledge_notes where title = 'What the planning taught'),
    'the note outlives the mission it came from'
  );

  perform tests.assert(
    (select mission_id is null and user_id is not null
       from public.knowledge_notes where title = 'What the planning taught'),
    'only the origin is cleared; the note keeps its owner'
  );
end;
$$;

select tests.logout();
