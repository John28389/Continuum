-- RULE-004's two side doors, and a finished record that cannot be deleted.
--
-- Found in M15 by probing while the history was being designed. An active
-- mission could be moved straight back to draft by a direct UPDATE — no review,
-- no justification — and any mission could be deleted, which is leaving an
-- active mission by another name, and which took a finished mission's
-- justification with it by cascade. History that its subject can delete is not
-- history.
--
-- Deletion now covers drafts only: a draft was never committed to, which is
-- the same reason dropping one needs no review.

\i supabase/tests/helpers.sql

select tests.logout();
select tests.create_user('exit-a@continuum.test') as id \gset user_a_

select tests.login_as(:'user_a_id');
select tests.assert_rls_applies();

-- ===========================================================================
-- Fixtures: a draft, and a mission that is genuinely active
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
values (:'user_a_id', :'cycle_id', :'campaign_id', 'A draft', 'Planned, never started', 60, 120)
returning id \gset draft_

insert into public.missions
  (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
values (:'user_a_id', :'cycle_id', :'campaign_id', 'Active mission', 'Taken on deliberately', 60, 120)
returning id \gset active_

insert into public.mission_dod_criteria (user_id, mission_id, description)
values (:'user_a_id', :'active_id', 'A measurable outcome')
returning id \gset criterion_

update public.missions set status = 'active' where id = :'active_id';

-- ===========================================================================
-- RULE-004 — an active mission cannot quietly become a draft again
-- ===========================================================================

select tests.assert_refused(
  format('update public.missions set status = ''draft'' where id = %L', :'active_id'),
  'an active mission cannot be moved back to draft',
  'RULE-004'
);

-- ===========================================================================
-- RULE-004 — deleting an active mission is leaving it
-- ===========================================================================
--
-- Row level security refuses a delete by hiding the row, so the statement
-- succeeds and affects nothing. The row count is the assertion.

select tests.assert_no_rows_affected(
  format('delete from public.missions where id = %L', :'active_id'),
  'an active mission cannot be deleted'
);

do $$
begin
  perform tests.assert_equals(
    (select status from public.missions where title = 'Active mission'),
    'active'::text,
    'the active mission is still there, and still active'
  );
end;
$$;

-- ===========================================================================
-- A finished mission is part of the record
-- ===========================================================================

select tests.assert_allowed(
  format('select public.set_criterion_satisfied(%L, true)', :'criterion_id'),
  'the criterion can be satisfied while the mission is active'
);

select tests.assert_allowed(
  format('select public.complete_mission(%L)', :'active_id'),
  'the mission can be completed by its criteria'
);

select tests.assert_no_rows_affected(
  format('delete from public.missions where id = %L', :'active_id'),
  'a completed mission cannot be deleted'
);

-- Ended, with a justification.
insert into public.missions
  (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
values (:'user_a_id', :'cycle_id', :'campaign_id', 'Ended mission', 'Taken on deliberately', 60, 120)
returning id \gset ended_

insert into public.mission_dod_criteria (user_id, mission_id, description)
values (:'user_a_id', :'ended_id', 'A measurable outcome');

update public.missions set status = 'active' where id = :'ended_id';

select tests.assert_allowed(
  format(
    'select public.review_mission(%L, ''premise_changed'', %L, ''abandoned'')',
    :'ended_id',
    'The platform this mission depended on was shut down, so the premise no longer holds'
  ),
  'the mission can be ended with a categorised justification'
);

select tests.assert_no_rows_affected(
  format('delete from public.missions where id = %L', :'ended_id'),
  'an ended mission cannot be deleted, and neither can its justification'
);

-- Revised, with a justification.
insert into public.missions
  (user_id, cycle_id, campaign_id, title, reason, min_load_minutes, target_load_minutes)
values (:'user_a_id', :'cycle_id', :'campaign_id', 'Revised mission', 'Taken on deliberately', 60, 120)
returning id \gset revised_

insert into public.mission_dod_criteria (user_id, mission_id, description)
values (:'user_a_id', :'revised_id', 'A measurable outcome');

update public.missions set status = 'active' where id = :'revised_id';

select tests.assert_allowed(
  format(
    'select public.review_mission(%L, ''scope_error'', %L, ''revised'')',
    :'revised_id',
    'The scope was twice what one cycle can hold; the reformulated work is a new mission'
  ),
  'the mission can be revised with a categorised justification'
);

select tests.assert_no_rows_affected(
  format('delete from public.missions where id = %L', :'revised_id'),
  'a revised mission cannot be deleted'
);

do $$
begin
  perform tests.assert_equals(
    (select count(*)::int from public.missions
      where status in ('completed', 'abandoned', 'revised')),
    3,
    'every finished mission is still there'
  );
  perform tests.assert_equals(
    (select count(*)::int from public.mission_reviews),
    2,
    'both justifications survived the attempted deletes'
  );
end;
$$;

-- ===========================================================================
-- Positive control: a draft can still be deleted
-- ===========================================================================
--
-- assert_allowed alone would pass on a delete that RLS silently hid, so the
-- row count is checked afterwards.

select tests.assert_allowed(
  format('delete from public.missions where id = %L', :'draft_id'),
  'a draft, never committed to, can be deleted'
);

do $$
begin
  perform tests.assert(
    (select count(*) = 0 from public.missions where title = 'A draft'),
    'the draft is really gone'
  );
end;
$$;

select tests.logout();
