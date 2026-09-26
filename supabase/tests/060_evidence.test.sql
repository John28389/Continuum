-- Evidence, criterion satisfaction, RULE-008, and the frozen record (RULE-006).
--
-- The runner wraps this file in one transaction, so now() is constant. Every
-- refusal sits beside the legitimate operation next to it, so a schema that
-- refused everything could not pass.
--
-- Missions used below:
--   M  worked on and completed: two criteria, three hours logged
--   D  a draft, never committed to
--   N  completed with no hours at all
--   P  abandoned through a review

\i supabase/tests/helpers.sql

select tests.logout();
select tests.create_user('evidence-a@continuum.test') as id \gset user_a_
select tests.create_user('evidence-b@continuum.test') as id \gset user_b_

select tests.login_as(:'user_a_id');
select tests.assert_rls_applies();

-- ===========================================================================
-- Fixtures
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
values (:'user_a_id', :'cycle_id', :'campaign_id',
        'Web exploitation fundamentals', 'Close the gap between reading and finding', 60, 120)
returning id \gset m_

insert into public.mission_dod_criteria (user_id, mission_id, description, position)
values (:'user_a_id', :'m_id', 'Reproduce eight labs', 0)
returning id \gset c1_

insert into public.mission_dod_criteria (user_id, mission_id, description, position)
values (:'user_a_id', :'m_id', 'Publish a writeup per class', 1)
returning id \gset c2_

update public.missions set status = 'active' where id = :'m_id';

insert into public.missions
  (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
values (:'user_a_id', :'cycle_id', :'campaign_id', 'A later idea', 'Planned, not committed', 60, 120)
returning id \gset d_

insert into public.mission_dod_criteria (user_id, mission_id, description)
values (:'user_a_id', :'d_id', 'Something measurable')
returning id \gset dc1_

do $$
begin
  perform tests.assert(
    (select enforcement = 'HARD' and severity = 'critical' from public.rules where code = 'RULE-008'),
    'RULE-008 is seeded as a critical hard rule, so the Rules page can show it'
  );
end;
$$;

-- ===========================================================================
-- Evidence
-- ===========================================================================

select tests.assert_allowed(
  format(
    'insert into public.mission_evidence (user_id, mission_id, criterion_id, description, url)
     values (%L, %L, %L, %L, %L)',
    :'user_a_id', :'m_id', :'c1_id', 'Lab 1 writeup', 'https://example.com/lab-1'
  ),
  'evidence citing one of its own mission''s criteria can be recorded'
);

select tests.assert_allowed(
  format(
    'insert into public.mission_evidence (user_id, mission_id, description) values (%L, %L, %L)',
    :'user_a_id', :'m_id', 'Notes on the approach'
  ),
  'evidence need not cite a criterion'
);

select tests.assert_refused(
  format(
    'insert into public.mission_evidence (user_id, mission_id, description) values (%L, %L, %L)',
    :'user_a_id', :'d_id', 'Output for a draft'
  ),
  'evidence cannot be recorded against a draft',
  'mission_evidence_mission_active'
);

select tests.assert_refused(
  format(
    'insert into public.mission_evidence (user_id, mission_id, criterion_id, description)
     values (%L, %L, %L, %L)',
    :'user_a_id', :'m_id', :'dc1_id', 'Citing the wrong mission'
  ),
  'evidence cannot cite another mission''s criterion',
  'mission_evidence_criterion_same_mission'
);

select tests.assert_refused(
  format(
    'insert into public.mission_evidence (user_id, mission_id, description, url)
     values (%L, %L, %L, %L)',
    :'user_a_id', :'m_id', 'A link', 'javascript:alert(1)'
  ),
  'a link that is not http or https is refused',
  'mission_evidence_url_valid'
);

select tests.assert_refused(
  format(
    'insert into public.mission_evidence (user_id, mission_id, description) values (%L, %L, %L)',
    :'user_a_id', :'m_id', '   '
  ),
  'evidence has to say what was produced',
  'mission_evidence_description_not_blank'
);

-- ===========================================================================
-- Satisfying criteria
-- ===========================================================================

select tests.assert_refused(
  format('select public.set_criterion_satisfied(%L, true)', :'dc1_id'),
  'a draft''s criterion cannot be satisfied',
  'mission_dod_criteria_satisfy_active'
);

select tests.assert_refused(
  format(
    'insert into public.mission_dod_criteria (user_id, mission_id, description, satisfied_at)
     values (%L, %L, %L, now())',
    :'user_a_id', :'d_id', 'Born satisfied'
  ),
  'a criterion cannot arrive on a draft already satisfied',
  'mission_dod_criteria_satisfy_active'
);

select tests.assert_allowed(
  format('select public.set_criterion_satisfied(%L, true)', :'c1_id'),
  'a criterion of the active mission can be satisfied'
);

do $$
begin
  perform tests.assert(
    (select satisfied_at = now() from public.mission_dod_criteria
      where description = 'Reproduce eight labs'),
    'satisfying stamps the database clock'
  );
end;
$$;

select tests.assert_allowed(
  format('select public.set_criterion_satisfied(%L, false)', :'c1_id'),
  'a satisfied criterion can be opened again while the mission is active'
);

select tests.assert_allowed(
  format('select public.set_criterion_satisfied(%L, true)', :'c1_id'),
  'and satisfied again'
);

-- ===========================================================================
-- RULE-008 — completion by the Definition of Done
-- ===========================================================================

-- Three hours logged: well past the two-hour target, with c2 still open.
insert into public.mission_sessions (user_id, mission_id, started_at, ended_at, source)
values (:'user_a_id', :'m_id', now() - interval '5 hours', now() - interval '2 hours', 'manual');

select tests.assert_refused(
  format('select public.complete_mission(%L)', :'m_id'),
  'hours past the target do not complete a mission with a criterion open',
  'RULE-008'
);

select tests.assert_refused(
  format('update public.missions set status = ''completed'' where id = %L', :'m_id'),
  'a direct update cannot complete it either: the RPC is not the only guard',
  'RULE-008'
);

select tests.assert_refused(
  format('update public.missions set status = ''completed'' where id = %L', :'d_id'),
  'a draft cannot jump straight to completed',
  'RULE-008'
);

select tests.assert_refused(
  format(
    'insert into public.missions
       (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes,
        status, completed_at)
     values (%L, %L, %L, %L, %L, 60, 120, ''completed'', now())',
    :'user_a_id', :'cycle_id', :'campaign_id', 'Born finished', 'no work at all'
  ),
  'a mission cannot be inserted already completed',
  'RULE-008'
);

-- An emptied Definition of Done is not a satisfied one. A savepoint keeps the
-- criteria for the rest of the file.
savepoint emptied;
delete from public.mission_dod_criteria where mission_id = :'m_id';

select tests.assert_refused(
  format('select public.complete_mission(%L)', :'m_id'),
  'a mission whose criteria were all removed cannot be completed',
  'RULE-008'
);

rollback to savepoint emptied;

-- A timer started ten minutes ago: it must end when the mission does.
insert into public.mission_sessions (user_id, mission_id, started_at)
values (:'user_a_id', :'m_id', now() - interval '10 minutes');

select tests.assert_allowed(
  format('select public.set_criterion_satisfied(%L, true)', :'c2_id'),
  'the last open criterion can be satisfied'
);

select tests.assert_allowed(
  format('select public.complete_mission(%L)', :'m_id'),
  'with every criterion satisfied, the active mission can be completed'
);

do $$
begin
  perform tests.assert(
    (select status = 'completed' and completed_at = now()
       from public.missions where title = 'Web exploitation fundamentals'),
    'completion is recorded with its moment'
  );

  perform tests.assert(
    (select count(*) = 0 from public.mission_sessions where ended_at is null),
    'no session is left running once its mission is complete'
  );

  perform tests.assert(
    (select count(*) = 1 from public.mission_sessions
      where started_at = now() - interval '10 minutes' and ended_at = now()),
    'the running session ended at the moment of completion'
  );
end;
$$;

-- ===========================================================================
-- RULE-006 — the finished record is frozen
-- ===========================================================================

select tests.assert_refused(
  format('update public.missions set status = ''active'' where id = %L', :'m_id'),
  'a completed mission cannot be reopened',
  'RULE-006'
);

select tests.assert_refused(
  format('select public.set_criterion_satisfied(%L, false)', :'c2_id'),
  'a completed mission''s criterion cannot be opened again',
  'RULE-006'
);

select tests.assert_refused(
  format('update public.mission_dod_criteria set description = ''rewritten'' where id = %L', :'c1_id'),
  'a completed mission''s criteria cannot be reworded',
  'RULE-006'
);

select tests.assert_refused(
  format('update public.mission_dod_criteria set satisfied_at = null where mission_id = %L', :'m_id'),
  'a multi-row update cannot reopen its criteria either',
  'RULE-006'
);

select tests.assert_refused(
  format(
    'insert into public.mission_dod_criteria (user_id, mission_id, description) values (%L, %L, %L)',
    :'user_a_id', :'m_id', 'An afterthought'
  ),
  'no criterion can be added after completion',
  'RULE-006'
);

select tests.assert_refused(
  format('delete from public.mission_dod_criteria where id = %L', :'c2_id'),
  'no criterion can be removed after completion',
  'RULE-006'
);

select tests.assert_refused(
  format(
    'insert into public.mission_evidence (user_id, mission_id, description) values (%L, %L, %L)',
    :'user_a_id', :'m_id', 'Late evidence'
  ),
  'no evidence can be added after completion',
  'RULE-006'
);

select tests.assert_refused(
  format('update public.mission_evidence set description = ''edited'' where mission_id = %L', :'m_id'),
  'recorded evidence cannot be edited after completion',
  'RULE-006'
);

select tests.assert_refused(
  format('delete from public.mission_evidence where mission_id = %L', :'m_id'),
  'recorded evidence cannot be deleted after completion',
  'RULE-006'
);

select tests.assert_refused(
  format('update public.mission_sessions set note = ''edited'' where mission_id = %L', :'m_id'),
  'logged sessions cannot be edited after completion',
  'RULE-006'
);

select tests.assert_refused(
  format('delete from public.mission_sessions where mission_id = %L', :'m_id'),
  'logged sessions cannot be deleted after completion',
  'RULE-006'
);

-- ===========================================================================
-- Hours never gate: a mission completes with none logged
-- ===========================================================================
--
-- N is activated now that the slot is free. A timer is started and the mission
-- completed in the same instant — the one case where a running session has no
-- length yet.

insert into public.missions
  (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
values (:'user_a_id', :'cycle_id', :'campaign_id', 'A short follow-up', 'Finish the writeups', 60, 120)
returning id \gset n_

insert into public.mission_dod_criteria (user_id, mission_id, description)
values (:'user_a_id', :'n_id', 'Publish the last writeup')
returning id \gset n1_

update public.missions set status = 'active' where id = :'n_id';

insert into public.mission_sessions (user_id, mission_id) values (:'user_a_id', :'n_id');

select public.set_criterion_satisfied(:'n1_id', true);

select tests.assert_allowed(
  format('select public.complete_mission(%L)', :'n_id'),
  'a mission with no hours logged at all can be completed: criteria decide, not time'
);

do $$
begin
  perform tests.assert(
    (select count(*) = 0
       from public.mission_sessions s
       join public.missions m on m.id = s.mission_id
      where m.title = 'A short follow-up'),
    'a session with no length yet is removed rather than stamped with a zero duration'
  );
end;
$$;

-- ===========================================================================
-- An abandoned mission's record is frozen too
-- ===========================================================================

insert into public.missions
  (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
values (:'user_a_id', :'cycle_id', :'campaign_id', 'An abandoned attempt', 'Tried a new angle', 60, 120)
returning id \gset p_

insert into public.mission_dod_criteria (user_id, mission_id, description)
values (:'user_a_id', :'p_id', 'Something observable')
returning id \gset p1_

update public.missions set status = 'active' where id = :'p_id';

insert into public.mission_evidence (user_id, mission_id, description)
values (:'user_a_id', :'p_id', 'Partial notes');

select public.review_mission(
  :'p_id', 'premise_changed', 'The premise changed after the first lab', 'abandoned'
);

select tests.assert_refused(
  format('update public.mission_dod_criteria set description = ''rewritten'' where id = %L', :'p1_id'),
  'an abandoned mission''s criteria are frozen as well',
  'RULE-006'
);

select tests.assert_refused(
  format('delete from public.mission_evidence where mission_id = %L', :'p_id'),
  'an abandoned mission''s evidence is frozen as well',
  'RULE-006'
);

-- ===========================================================================
-- Isolation
-- ===========================================================================

select tests.login_as(:'user_b_id');
select tests.assert_rls_applies();

do $$
begin
  perform tests.assert_equals(
    (select count(*) from public.mission_evidence),
    0::bigint,
    'another user sees none of this evidence'
  );
end;
$$;

-- The trigger answers first: to B the mission is invisible, so not active.
select tests.assert_refused(
  format(
    'insert into public.mission_evidence (user_id, mission_id, description) values (%L, %L, %L)',
    :'user_b_id', :'m_id', 'Not mine'
  ),
  'another user cannot attach evidence to this mission',
  'mission_evidence_mission_active'
);

select tests.assert_refused(
  format('select public.set_criterion_satisfied(%L, true)', :'c1_id'),
  'another user cannot touch this Definition of Done',
  'CT404'
);

select tests.assert_no_rows_affected(
  format('update public.mission_evidence set description = ''mine now'' where mission_id = %L', :'m_id'),
  'another user cannot edit this evidence'
);

select tests.assert_no_rows_affected(
  format('delete from public.mission_evidence where mission_id = %L', :'m_id'),
  'another user cannot delete this evidence'
);

select tests.logout();
