-- Row level security baseline.
--
-- This application stores one person's private behavioural record, reachable
-- over the public internet using a key that is by design not secret. Row level
-- security is therefore not a hardening measure layered on top of the real
-- protection — it IS the protection.
--
-- Two things are checked here:
--
--   1. a structural guard, which fails the moment any table is added to the
--      public schema without RLS and at least one policy
--   2. real cross-user isolation, exercised as an actual authenticated user
--      rather than as the owner

\i supabase/tests/helpers.sql

-- ===========================================================================
-- 1. Structural guard
-- ===========================================================================
--
-- Deliberately written against the catalogue rather than a hand-maintained
-- list, so a table added in a future migration is covered without anyone
-- remembering to update this file.

do $$
declare
  v_missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into v_missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if v_missing is not null then
    raise exception
      'Tables in the public schema without row level security: %. Enable RLS in the migration that creates the table.',
      v_missing;
  end if;

  raise notice 'ok   every table in public has row level security enabled';
end;
$$;

do $$
declare
  v_unpoliced text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into v_unpoliced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not exists (
      select 1 from pg_policy p where p.polrelid = c.oid
    );

  if v_unpoliced is not null then
    raise exception
      'Tables with row level security enabled but no policy (all access denied, which is almost never intended): %',
      v_unpoliced;
  end if;

  raise notice 'ok   every table in public has at least one policy';
end;
$$;

-- Write policies must carry WITH CHECK. A policy with USING alone on INSERT or
-- UPDATE lets a user create or move rows owned by somebody else, which is the
-- single easiest way to lose isolation without noticing.
do $$
declare
  v_bad text;
begin
  select string_agg(format('%s.%s', c.relname, p.polname), ', ' order by c.relname)
    into v_bad
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and p.polcmd in ('a', 'w')  -- INSERT, UPDATE
    and p.polwithcheck is null;

  if v_bad is not null then
    raise exception
      'Write policies missing WITH CHECK: %. USING alone does not constrain the row being written.',
      v_bad;
  end if;

  raise notice 'ok   every insert and update policy carries WITH CHECK';
end;
$$;

-- ===========================================================================
-- 2. Cross-user isolation
-- ===========================================================================

select tests.logout();

select tests.create_user('rls-a@continuum.test') as id \gset user_a_
select tests.create_user('rls-b@continuum.test') as id \gset user_b_

-- --- User A creates a direction and a cycle -------------------------------

select tests.login_as(:'user_a_id');
select tests.assert_rls_applies();

insert into public.directions (user_id, title, statement)
values (:'user_a_id', 'Direction A', 'Owned by A');

insert into public.cycles (user_id, label, starts_on, ends_on, status)
values (:'user_a_id', 'Cycle A', current_date, current_date + 30, 'active');

-- Positive control. Without this, every assertion below could be passing
-- because nothing works at all rather than because isolation holds.
do $$
begin
  perform tests.assert_equals(
    (select count(*)::int from public.directions),
    1,
    'user A can read their own direction'
  );
  perform tests.assert_equals(
    (select count(*)::int from public.cycles),
    1,
    'user A can read their own cycle'
  );
end;
$$;

-- --- User B must not see or touch any of it -------------------------------

select tests.login_as(:'user_b_id');
select tests.assert_rls_applies();

do $$
begin
  perform tests.assert_equals(
    (select count(*)::int from public.directions),
    0,
    'user B cannot read user A''s directions'
  );

  perform tests.assert_equals(
    (select count(*)::int from public.cycles),
    0,
    'user B cannot read user A''s cycles'
  );

  -- An UPDATE filtered away by RLS is not an error; it simply affects nothing.
  -- Asserting on the row count is the only way to catch a policy that is too
  -- permissive here.
  update public.directions set title = 'hijacked by B';
  perform tests.assert_equals(
    (select count(*)::int from public.directions where title = 'hijacked by B'),
    0,
    'user B cannot update user A''s directions'
  );

  delete from public.directions;
  perform tests.assert(
    true,
    'user B''s delete affected no rows belonging to user A (verified below)'
  );
end;
$$;

-- Writing a row owned by somebody else must be refused outright by WITH CHECK.
select tests.assert_refused(
  format(
    'insert into public.directions (user_id, title) values (%L, %L)',
    :'user_a_id',
    'planted by B'
  ),
  'user B cannot insert a direction owned by user A',
  '42501'
);

-- --- Back to A: their data must still be intact ---------------------------

select tests.login_as(:'user_a_id');

do $$
begin
  perform tests.assert_equals(
    (select count(*)::int from public.directions),
    1,
    'user A''s direction survived user B''s delete attempt'
  );
  perform tests.assert_equals(
    (select title from public.directions limit 1),
    'Direction A'::text,
    'user A''s direction was not modified by user B'
  );
end;
$$;

select tests.logout();
