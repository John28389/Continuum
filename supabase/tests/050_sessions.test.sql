-- Mission sessions: overlap, active-mission binding, no future, RULE-102.
--
-- The runner wraps this file in one transaction, so now() is constant
-- throughout. Every session that is later stopped therefore starts at an
-- explicit time in the past; otherwise stopping it would stamp an end equal to
-- its start and trip the period check, which would be a property of the test
-- harness rather than of the schema.
--
-- Timeline used below, relative to now():
--
--   -6h        -5h        -4h        -2h        now
--    |          |==manual==|===adjacent===|==timer===|
--
-- Every refusal is paired with the legitimate operation next to it, so a schema
-- that refused everything could not pass.

\i supabase/tests/helpers.sql

select tests.logout();
select tests.create_user('sessions-a@continuum.test') as id \gset user_a_
select tests.create_user('sessions-b@continuum.test') as id \gset user_b_

select tests.login_as(:'user_a_id');
select tests.assert_rls_applies();

-- ===========================================================================
-- Fixtures: one active mission, one draft
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

-- Small loads, so the RULE-102 check below can pass the target with a few
-- sessions: minimum one hour, target two.
insert into public.missions
  (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
values (:'user_a_id', :'cycle_id', :'campaign_id',
        'Web exploitation fundamentals', 'Close the gap between reading and finding', 60, 120)
returning id \gset active_mission_

insert into public.mission_dod_criteria (user_id, mission_id, description)
values (:'user_a_id', :'active_mission_id', 'Reproduce eight labs without a walkthrough');

update public.missions set status = 'active' where id = :'active_mission_id';

insert into public.missions
  (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
values (:'user_a_id', :'cycle_id', :'campaign_id',
        'A later idea', 'Planned, not committed to', 60, 120)
returning id \gset draft_mission_

-- ===========================================================================
-- The timer: start, one at a time, stop
-- ===========================================================================

-- Positive control. If this fails, psql stops the file.
insert into public.mission_sessions (user_id, mission_id, started_at)
values (:'user_a_id', :'active_mission_id', now() - interval '2 hours')
returning id \gset timer_

select tests.assert_refused(
  format(
    'insert into public.mission_sessions (user_id, mission_id, started_at)
     values (%L, %L, now() - interval ''1 hour'')',
    :'user_a_id', :'active_mission_id'
  ),
  'a second running session cannot be started while one is running',
  'mission_sessions_no_overlap'
);

select tests.assert_allowed(
  format('select public.stop_mission_session(%L, %L)', :'timer_id', 'Lab 3, SQL injection'),
  'the running session can be stopped'
);

do $$
begin
  perform tests.assert(
    (select ended_at = now() and note = 'Lab 3, SQL injection'
       from public.mission_sessions where note is not null),
    'stopping stamps the end from the database clock and keeps the note'
  );
end;
$$;

select tests.assert_refused(
  format('select public.stop_mission_session(%L)', :'timer_id'),
  'a session that is not running cannot be stopped again',
  'CT404'
);

-- ===========================================================================
-- Manual sessions and overlap
-- ===========================================================================

select tests.assert_allowed(
  format(
    'insert into public.mission_sessions (user_id, mission_id, started_at, ended_at, source)
     values (%L, %L, now() - interval ''5 hours'', now() - interval ''4 hours'', ''manual'')',
    :'user_a_id', :'active_mission_id'
  ),
  'a past session that overlaps nothing can be logged'
);

-- Half-open periods: touching both neighbours exactly is adjacency, not overlap.
select tests.assert_allowed(
  format(
    'insert into public.mission_sessions (user_id, mission_id, started_at, ended_at, source)
     values (%L, %L, now() - interval ''4 hours'', now() - interval ''2 hours'', ''manual'')',
    :'user_a_id', :'active_mission_id'
  ),
  'a session ending exactly when the next begins is adjacent, not overlapping'
);

select tests.assert_refused(
  format(
    'insert into public.mission_sessions (user_id, mission_id, started_at, ended_at, source)
     values (%L, %L, now() - interval ''270 minutes'', now() - interval ''210 minutes'', ''manual'')',
    :'user_a_id', :'active_mission_id'
  ),
  'a session overlapping two logged sessions is refused',
  'mission_sessions_no_overlap'
);

select tests.assert_refused(
  format(
    'insert into public.mission_sessions (user_id, mission_id, started_at, ended_at, source)
     values (%L, %L, now() - interval ''6 hours'', now() - interval ''1 hour'', ''manual'')',
    :'user_a_id', :'active_mission_id'
  ),
  'a session enclosing others entirely is refused',
  'mission_sessions_no_overlap'
);

-- The update path. Stretching an existing session over its neighbour is the
-- same violation as inserting one, and must be refused the same way.
select tests.assert_refused(
  format(
    'update public.mission_sessions set ended_at = now() - interval ''3 hours''
     where mission_id = %L and started_at = now() - interval ''5 hours''',
    :'active_mission_id'
  ),
  'an update that stretches a session over its neighbour is refused',
  'mission_sessions_no_overlap'
);

-- Positive control for the update path: shortening into free time is fine.
select tests.assert_allowed(
  format(
    'update public.mission_sessions set ended_at = now() - interval ''270 minutes''
     where mission_id = %L and started_at = now() - interval ''5 hours''',
    :'active_mission_id'
  ),
  'a session can be shortened into time nobody else occupies'
);

-- ===========================================================================
-- Periods that are not periods, and periods that have not happened
-- ===========================================================================

select tests.assert_refused(
  format(
    'insert into public.mission_sessions (user_id, mission_id, started_at, ended_at, source)
     values (%L, %L, now() - interval ''10 hours'', now() - interval ''10 hours'', ''manual'')',
    :'user_a_id', :'active_mission_id'
  ),
  'a zero-length session is refused',
  'mission_sessions_period_valid'
);

select tests.assert_refused(
  format(
    'insert into public.mission_sessions (user_id, mission_id, started_at, ended_at, source)
     values (%L, %L, now() - interval ''9 hours'', now() - interval ''10 hours'', ''manual'')',
    :'user_a_id', :'active_mission_id'
  ),
  'a session ending before it starts is refused',
  'mission_sessions_period_valid'
);

select tests.assert_refused(
  format(
    'insert into public.mission_sessions (user_id, mission_id, started_at, ended_at, source)
     values (%L, %L, now() + interval ''1 hour'', now() + interval ''2 hours'', ''manual'')',
    :'user_a_id', :'active_mission_id'
  ),
  'hours not yet worked cannot be logged',
  'mission_sessions_not_in_future'
);

select tests.assert_refused(
  format(
    'insert into public.mission_sessions (user_id, mission_id, started_at)
     values (%L, %L, now() + interval ''1 hour'')',
    :'user_a_id', :'active_mission_id'
  ),
  'a timer cannot be started in the future',
  'mission_sessions_not_in_future'
);

select tests.assert_refused(
  format(
    'update public.mission_sessions set ended_at = now() + interval ''1 hour''
     where id = %L',
    :'timer_id'
  ),
  'an update cannot push a session''s end into the future',
  'mission_sessions_not_in_future'
);

-- ===========================================================================
-- Sessions belong to the active mission, and stay where they were logged
-- ===========================================================================

select tests.assert_refused(
  format(
    'insert into public.mission_sessions (user_id, mission_id, started_at, ended_at, source)
     values (%L, %L, now() - interval ''20 hours'', now() - interval ''19 hours'', ''manual'')',
    :'user_a_id', :'draft_mission_id'
  ),
  'time cannot be logged against a draft that was never committed to',
  'mission_sessions_mission_active'
);

select tests.assert_refused(
  format(
    'update public.mission_sessions set mission_id = %L where id = %L',
    :'draft_mission_id', :'timer_id'
  ),
  'a session cannot be moved onto another mission after the fact',
  'mission_sessions_mission_fixed'
);

-- ===========================================================================
-- RULE-102 — hours do not complete a mission
-- ===========================================================================
--
-- Logged so far: 30 min + 2 h + 2 h = 4.5 h, well past the two-hour target.

do $$
begin
  perform tests.assert(
    (select sum(ended_at - started_at) >= interval '2 hours'
       from public.mission_sessions where ended_at is not null),
    'the logged time really is past the target, so the next assertion means something'
  );

  perform tests.assert(
    (select status = 'active' and completed_at is null
       from public.missions where title = 'Web exploitation fundamentals'),
    'RULE-102: passing the target load leaves the mission active and uncompleted'
  );
end;
$$;

-- ===========================================================================
-- Isolation
-- ===========================================================================

-- A running session for A, starting exactly now: adjacent to the stopped timer.
insert into public.mission_sessions (user_id, mission_id)
values (:'user_a_id', :'active_mission_id')
returning id \gset running_

select tests.login_as(:'user_b_id');
select tests.assert_rls_applies();

do $$
begin
  perform tests.assert_equals(
    (select count(*) from public.mission_sessions),
    0::bigint,
    'another user sees none of these sessions'
  );
end;
$$;

-- The trigger answers first: the mission is invisible to B, so it is not an
-- active mission as far as B can tell.
select tests.assert_refused(
  format(
    'insert into public.mission_sessions (user_id, mission_id, started_at, ended_at, source)
     values (%L, %L, now() - interval ''30 hours'', now() - interval ''29 hours'', ''manual'')',
    :'user_b_id', :'active_mission_id'
  ),
  'another user cannot log time against this mission',
  'mission_sessions_mission_active'
);

select tests.assert_refused(
  format('select public.stop_mission_session(%L)', :'running_id'),
  'another user cannot stop this session',
  'CT404'
);

select tests.assert_no_rows_affected(
  format('update public.mission_sessions set note = ''mine now'' where id = %L', :'running_id'),
  'another user cannot edit this session'
);

select tests.assert_no_rows_affected(
  format('delete from public.mission_sessions where id = %L', :'running_id'),
  'another user cannot delete this session'
);

-- ===========================================================================
-- Discarding a forgotten timer, and the terminal case
-- ===========================================================================

select tests.login_as(:'user_a_id');

select tests.assert_allowed(
  format('delete from public.mission_sessions where id = %L and ended_at is null', :'running_id'),
  'the owner can discard a running session'
);

-- RULE-008 (M11): the criterion is satisfied first, which completion requires.
update public.mission_dod_criteria set satisfied_at = now() where mission_id = :'active_mission_id';
update public.missions set status = 'completed' where id = :'active_mission_id';

select tests.assert_refused(
  format(
    'insert into public.mission_sessions (user_id, mission_id, started_at, ended_at, source)
     values (%L, %L, now() - interval ''40 hours'', now() - interval ''39 hours'', ''manual'')',
    :'user_a_id', :'active_mission_id'
  ),
  'no time can be added to a completed mission, whose record is final',
  'mission_sessions_mission_active'
);

select tests.logout();
