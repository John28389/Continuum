-- Cycle invariants.
--
-- The cycle boundary is load-bearing for RULE-005. If two cycles could be
-- active at once, "activate only inside the active cycle" would stop meaning
-- anything, and a mission could be started for next month while this month's
-- is still running.

\i supabase/tests/helpers.sql

select tests.logout();
select tests.create_user('cycles-a@continuum.test') as id \gset user_a_
select tests.create_user('cycles-b@continuum.test') as id \gset user_b_

select tests.login_as(:'user_a_id');
select tests.assert_rls_applies();

-- ===========================================================================
-- Positive control
-- ===========================================================================

select tests.assert_allowed(
  format(
    'insert into public.cycles (user_id, label, starts_on, ends_on, status)
       values (%L, %L, current_date, current_date + 30, %L)',
    :'user_a_id',
    'September',
    'active'
  ),
  'a first active cycle can be opened'
);

-- ===========================================================================
-- One active cycle per user
-- ===========================================================================

select tests.assert_refused(
  format(
    'insert into public.cycles (user_id, label, starts_on, ends_on, status)
       values (%L, %L, current_date + 31, current_date + 60, %L)',
    :'user_a_id',
    'October',
    'active'
  ),
  'a second active cycle cannot be opened by insert',
  '23505'
);

-- The update path matters as much as the insert path. A planned cycle being
-- promoted to active while another is already running is the realistic way
-- this invariant would be broken in practice.
insert into public.cycles (user_id, label, starts_on, ends_on, status)
values (:'user_a_id', 'October', current_date + 31, current_date + 60, 'planned');

select tests.assert_refused(
  'update public.cycles set status = ''active'' where label = ''October''',
  'a planned cycle cannot be promoted while another cycle is active',
  '23505'
);

-- A multi-row update must not slip through either.
select tests.assert_refused(
  'update public.cycles set status = ''active''',
  'a multi-row update cannot leave two cycles active',
  '23505'
);

-- ===========================================================================
-- Closing frees the slot
-- ===========================================================================
--
-- The invariant is "one active cycle", not "one cycle ever". Confirm the
-- constraint is genuinely partial rather than accidentally absolute.

select tests.assert_allowed(
  'update public.cycles set status = ''closed'', closed_at = now() where label = ''September''',
  'the active cycle can be closed'
);

select tests.assert_allowed(
  'update public.cycles set status = ''active'' where label = ''October''',
  'a new cycle can be activated once the previous one is closed'
);

-- ===========================================================================
-- Field constraints
-- ===========================================================================

select tests.assert_refused(
  format(
    'insert into public.cycles (user_id, label, starts_on, ends_on)
       values (%L, %L, current_date + 30, current_date)',
    :'user_a_id',
    'Backwards'
  ),
  'a cycle cannot end before it starts',
  'cycles_period_coherent'
);

select tests.assert_refused(
  format(
    'insert into public.cycles (user_id, label, starts_on, ends_on)
       values (%L, %L, current_date, current_date + 30)',
    :'user_a_id',
    '   '
  ),
  'a cycle label cannot be blank',
  'cycles_label_not_blank'
);

select tests.assert_refused(
  format(
    'insert into public.cycles (user_id, label, starts_on, ends_on, status)
       values (%L, %L, current_date, current_date + 30, %L)',
    :'user_a_id',
    'Bogus status',
    'whatever'
  ),
  'a cycle status outside the allowed set is refused',
  'cycles_status_valid'
);

select tests.assert_refused(
  format(
    'insert into public.cycles (user_id, label, starts_on, ends_on, status, closed_at)
       values (%L, %L, current_date, current_date + 30, %L, null)',
    :'user_a_id',
    'Closed without a timestamp',
    'closed'
  ),
  'a closed cycle must record when it was closed',
  'cycles_closed_at_consistent'
);

-- ===========================================================================
-- The constraint is per user, not global
-- ===========================================================================
--
-- The schema is single-owner in practice but multi-user by construction. If
-- this index were global rather than partitioned by user_id, isolation would
-- leak through the constraint itself: one user's active cycle would block
-- another's.

select tests.login_as(:'user_b_id');

select tests.assert_allowed(
  format(
    'insert into public.cycles (user_id, label, starts_on, ends_on, status)
       values (%L, %L, current_date, current_date + 30, %L)',
    :'user_b_id',
    'September',
    'active'
  ),
  'another user can have their own active cycle at the same time'
);

select tests.logout();
