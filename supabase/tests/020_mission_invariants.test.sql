-- Mission invariants: RULE-001, 002, 003, 005, 006.
--
-- Every assertion here attempts a violation and requires the database to
-- refuse it. The point is not that the application avoids these operations —
-- it is that the database rejects them even when something else tries.
--
-- The positive controls are not decoration. Without them, a schema so locked
-- down that nothing works at all would produce an entirely green suite.

\i supabase/tests/helpers.sql

select tests.logout();
select tests.create_user('missions-a@continuum.test') as id \gset user_a_

select tests.login_as(:'user_a_id');
select tests.assert_rls_applies();

-- ===========================================================================
-- Fixtures
-- ===========================================================================

insert into public.directions (user_id, title)
values (:'user_a_id', 'Grow professional value')
returning id \gset direction_

insert into public.campaigns (user_id, direction_id, name, objective, starts_on, ends_on)
values (
  :'user_a_id',
  :'direction_id',
  'Web exploitation',
  'Reach practical competence in web exploitation',
  current_date,
  current_date + 90
)
returning id \gset campaign_

insert into public.cycles (user_id, label, starts_on, ends_on, status)
values (:'user_a_id', 'September', current_date, current_date + 30, 'active')
returning id \gset active_cycle_

insert into public.cycles (user_id, label, starts_on, ends_on, status)
values (:'user_a_id', 'October', current_date + 31, current_date + 60, 'planned')
returning id \gset future_cycle_

-- ===========================================================================
-- RULE-003 — minimum and target load
-- ===========================================================================

select tests.assert_refused(
  format(
    'insert into public.missions
       (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
     values (%L, %L, %L, %L, %L, 1440, 720)',
    :'user_a_id', :'active_cycle_id', :'campaign_id',
    'Target below minimum', 'because'
  ),
  'a target load below the minimum is refused',
  'missions_load_coherent'
);

select tests.assert_refused(
  format(
    'insert into public.missions
       (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
     values (%L, %L, %L, %L, %L, 0, 600)',
    :'user_a_id', :'active_cycle_id', :'campaign_id',
    'Zero minimum', 'because'
  ),
  'a zero minimum load is refused',
  'missions_load_coherent'
);

select tests.assert_refused(
  format(
    'insert into public.missions
       (user_id, cycle_id, campaign_id, title, reason, min_load_minutes)
     values (%L, %L, %L, %L, %L, 600)',
    :'user_a_id', :'active_cycle_id', :'campaign_id',
    'No target at all', 'because'
  ),
  'a mission without a target load is refused',
  '23502'
);

select tests.assert_refused(
  format(
    'insert into public.missions
       (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
     values (%L, %L, %L, %L, %L, 1440, 1800)',
    :'user_a_id', :'active_cycle_id', :'campaign_id',
    'No reason', '   '
  ),
  'a mission without a stated reason is refused',
  'missions_reason_not_blank'
);

-- Positive control for the shape of a legitimate mission.
insert into public.missions
  (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
values (
  :'user_a_id', :'active_cycle_id', :'campaign_id',
  'Web exploitation fundamentals',
  'Close the gap between reading about vulnerabilities and finding them',
  1440, 1800
)
returning id \gset mission_a_

do $$
begin
  perform tests.assert_equals(
    (select status from public.missions where title = 'Web exploitation fundamentals'),
    'draft'::text,
    'a new mission starts as a draft'
  );
end;
$$;

-- ===========================================================================
-- RULE-002 — Definition of Done required before activation
-- ===========================================================================

select tests.assert_refused(
  format('update public.missions set status = ''active'' where id = %L', :'mission_a_id'),
  'a mission cannot be activated with no Definition-of-Done criteria',
  'RULE-002'
);

-- Adding a criterion unblocks it. This also proves the previous refusal was
-- caused by the missing criterion rather than by activation being broken.
insert into public.mission_dod_criteria (user_id, mission_id, description)
values (
  :'user_a_id',
  :'mission_a_id',
  'Reproduce eight labs without following a walkthrough'
);

-- ===========================================================================
-- RULE-005 — activation is bound to the active cycle
-- ===========================================================================

insert into public.missions
  (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
values (
  :'user_a_id', :'future_cycle_id', :'campaign_id',
  'Next month candidate',
  'Planned ahead, deliberately not committed to',
  1440, 1800
)
returning id \gset future_mission_

insert into public.mission_dod_criteria (user_id, mission_id, description)
values (:'user_a_id', :'future_mission_id', 'Some measurable outcome');

select tests.assert_refused(
  format('update public.missions set status = ''active'' where id = %L', :'future_mission_id'),
  'a mission belonging to a future cycle cannot be activated early',
  'RULE-005'
);

-- ===========================================================================
-- Positive control: the legitimate path works
-- ===========================================================================

select tests.assert_allowed(
  format('update public.missions set status = ''active'' where id = %L', :'mission_a_id'),
  'a mission with a Definition of Done, in the active cycle, can be activated'
);

do $$
begin
  perform tests.assert(
    (select activated_at is not null from public.missions
      where title = 'Web exploitation fundamentals'),
    'activating a mission records when it happened'
  );
end;
$$;

-- ===========================================================================
-- RULE-001 — one active mission
-- ===========================================================================

insert into public.missions
  (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
values (
  :'user_a_id', :'active_cycle_id', :'campaign_id',
  'The shiny new thing',
  'It looked more interesting this morning',
  1440, 1800
)
returning id \gset mission_b_

insert into public.mission_dod_criteria (user_id, mission_id, description)
values (:'user_a_id', :'mission_b_id', 'Also measurable');

select tests.assert_refused(
  format('update public.missions set status = ''active'' where id = %L', :'mission_b_id'),
  'a second mission cannot be activated while one is already active',
  '23505'
);

-- Inserting straight into the active state must be refused too, not only the
-- update path.
select tests.assert_refused(
  format(
    'insert into public.missions
       (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes, status)
     values (%L, %L, %L, %L, %L, 1440, 1800, ''active'')',
    :'user_a_id', :'active_cycle_id', :'campaign_id',
    'Straight to active', 'skipping the draft state'
  ),
  'a mission cannot be inserted directly into the active state without criteria',
  'RULE-002'
);

-- A multi-row update must not be able to activate several missions at once.
-- This is the case a FOR EACH STATEMENT trigger would wave through.
-- Scoped to the active cycle so that RULE-001 is the binding constraint. An
-- unscoped update also gets refused, but by RULE-005 on the future-cycle
-- mission, which would leave the single-active rule untested.
select tests.assert_refused(
  format(
    'update public.missions set status = ''active'' where status = ''draft'' and cycle_id = %L',
    :'active_cycle_id'
  ),
  'a multi-row update cannot activate several missions at once',
  '23505'
);

-- ===========================================================================
-- RULE-006 — completion is terminal
-- ===========================================================================

-- RULE-008 (M11): completion needs every criterion satisfied, so satisfying it
-- is now part of the legitimate path this positive control exercises.
update public.mission_dod_criteria set satisfied_at = now() where mission_id = :'mission_a_id';

select tests.assert_allowed(
  format('update public.missions set status = ''completed'' where id = %L', :'mission_a_id'),
  'an active mission with its Definition of Done satisfied can be completed'
);

do $$
begin
  perform tests.assert(
    (select completed_at is not null from public.missions
      where title = 'Web exploitation fundamentals'),
    'completing a mission records when it happened'
  );
end;
$$;

select tests.assert_refused(
  format('update public.missions set status = ''active'' where id = %L', :'mission_a_id'),
  'a completed mission cannot be reactivated',
  'RULE-006'
);

select tests.assert_refused(
  format('update public.missions set status = ''draft'' where id = %L', :'mission_a_id'),
  'a completed mission cannot be sent back to draft',
  'RULE-006'
);

select tests.assert_refused(
  format('update public.missions set status = ''abandoned'' where id = %L', :'mission_a_id'),
  'a completed mission cannot be abandoned after the fact',
  'RULE-006'
);

-- Completion frees the single active slot, as it must: the constraint is
-- "one at a time", not "one ever".
select tests.assert_allowed(
  format('update public.missions set status = ''active'' where id = %L', :'mission_b_id'),
  'a new mission can be activated once the previous one is complete'
);

select tests.logout();
