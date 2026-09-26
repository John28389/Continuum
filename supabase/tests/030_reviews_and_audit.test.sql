-- RULE-004 and the audit trail.
--
-- RULE-004 is the rule that separates "the premise changed" from "I lost
-- interest". It is the one a determined user is most likely to try to route
-- around, so the tests below try the routes: updating the status directly,
-- writing a justification that says nothing, reusing an older review, and
-- recording a review whose outcome does not match the transition.

\i supabase/tests/helpers.sql

select tests.logout();
select tests.create_user('reviews-a@continuum.test') as id \gset user_a_

select tests.login_as(:'user_a_id');
select tests.assert_rls_applies();

-- ===========================================================================
-- Fixtures: a mission that is genuinely active
-- ===========================================================================

insert into public.directions (user_id, title)
values (:'user_a_id', 'Direction')
returning id \gset direction_

insert into public.campaigns (user_id, direction_id, name, objective, starts_on, ends_on)
values (:'user_a_id', :'direction_id', 'Campaign', 'Objective', current_date, current_date + 90)
returning id \gset campaign_

insert into public.cycles (user_id, label, starts_on, ends_on, status)
values (:'user_a_id', 'September', current_date, current_date + 30, 'active')
returning id \gset cycle_

insert into public.missions
  (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
values (
  :'user_a_id', :'cycle_id', :'campaign_id',
  'Active mission', 'The reason it was taken on', 1440, 1800
)
returning id \gset mission_

insert into public.mission_dod_criteria (user_id, mission_id, description)
values (:'user_a_id', :'mission_id', 'A measurable outcome');

update public.missions set status = 'active' where id = :'mission_id';

do $$
begin
  perform tests.assert_equals(
    (select status from public.missions where title = 'Active mission'),
    'active'::text,
    'the fixture mission really is active'
  );
end;
$$;

-- ===========================================================================
-- RULE-004 — an active mission cannot simply be dropped
-- ===========================================================================

select tests.assert_refused(
  format('update public.missions set status = ''abandoned'' where id = %L', :'mission_id'),
  'an active mission cannot be abandoned without a review',
  'RULE-004'
);

select tests.assert_refused(
  format('update public.missions set status = ''revised'' where id = %L', :'mission_id'),
  'an active mission cannot be revised without a review',
  'RULE-004'
);

-- A justification has to say something. Whitespace is not a reason.
select tests.assert_refused(
  format(
    'insert into public.mission_reviews
       (user_id, mission_id, reason_category, justification, outcome)
     values (%L, %L, ''scope_error'', ''   '', ''abandoned'')',
    :'user_a_id', :'mission_id'
  ),
  'a blank justification is refused',
  'mission_reviews_justification_substantive'
);

select tests.assert_refused(
  format(
    'insert into public.mission_reviews
       (user_id, mission_id, reason_category, justification, outcome)
     values (%L, %L, ''scope_error'', ''too short'', ''abandoned'')',
    :'user_a_id', :'mission_id'
  ),
  'a token justification is refused',
  'mission_reviews_justification_substantive'
);

-- Boredom is not a category. The legitimate reasons are enumerated, and
-- "I found something more interesting" is deliberately not among them.
select tests.assert_refused(
  format(
    'insert into public.mission_reviews
       (user_id, mission_id, reason_category, justification, outcome)
     values (%L, %L, ''lost_interest'', %L, ''abandoned'')',
    :'user_a_id', :'mission_id',
    'I simply do not feel like doing this one any more, honestly'
  ),
  'losing interest is not an accepted reason category',
  'mission_reviews_reason_category_valid'
);

-- A review recorded for a different outcome must not unlock this transition.
insert into public.mission_reviews
  (user_id, mission_id, reason_category, justification, outcome)
values (
  :'user_a_id', :'mission_id', 'scope_error',
  'Reviewed the scope and decided to keep going with the mission as it stands',
  'kept'
);

select tests.assert_refused(
  format('update public.missions set status = ''abandoned'' where id = %L', :'mission_id'),
  'a review whose outcome was "kept" does not authorise abandonment',
  'RULE-004'
);

-- ===========================================================================
-- Positive control: the legitimate path
-- ===========================================================================
--
-- The review and the transition happen together. review_mission() does both in
-- one statement, which is exactly what the rule requires.

select tests.assert_allowed(
  format(
    'select public.review_mission(%L, ''premise_changed'', %L, ''abandoned'')',
    :'mission_id',
    'The library this mission depended on was archived upstream, so the premise no longer holds'
  ),
  'a mission can be ended when a categorised justification accompanies it'
);

do $$
begin
  perform tests.assert_equals(
    (select status from public.missions where title = 'Active mission'),
    'abandoned'::text,
    'the review applied the outcome to the mission'
  );
  perform tests.assert_equals(
    (select count(*)::int from public.mission_reviews where outcome = 'abandoned'),
    1,
    'the justification was recorded alongside the transition'
  );
end;
$$;

-- Ending a mission frees the active slot, and the ended mission stays ended.
select tests.assert_refused(
  format('update public.missions set status = ''active'' where id = %L', :'mission_id'),
  'an abandoned mission cannot be resurrected',
  'RULE-006'
);

-- ===========================================================================
-- The audit trail is append-only
-- ===========================================================================

do $$
begin
  perform tests.assert(
    (select count(*) from public.audit_events where entity_type = 'mission') > 0,
    'mission changes were recorded in the audit trail'
  );
  perform tests.assert(
    (select count(*) from public.audit_events
      where action = 'mission.status_changed'
        and payload ->> 'to' = 'abandoned') = 1,
    'the audit trail recorded the transition to abandoned'
  );
end;
$$;

-- History that its subject can edit is not history.
select tests.assert_no_rows_affected(
  'update public.audit_events set action = ''rewritten''',
  'audit events cannot be modified'
);

select tests.assert_no_rows_affected(
  'delete from public.audit_events',
  'audit events cannot be deleted'
);

-- The same applies to a recorded justification.
select tests.assert_no_rows_affected(
  'update public.mission_reviews set justification = ''something else entirely''',
  'a recorded justification cannot be edited afterwards'
);

do $$
begin
  perform tests.assert(
    (select count(*) from public.audit_events) > 0,
    'the audit rows still exist, so "no rows affected" means protected, not empty'
  );
end;
$$;

select tests.logout();
