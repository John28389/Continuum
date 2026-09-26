-- Test helpers for the adversarial invariant suite.
--
-- Loaded with \i at the top of each *.test.sql file. Deliberately NOT a
-- migration: these functions exist only in the local test database and must
-- never reach a cloud project.
--
-- The suite's job is to prove the database refuses illegal operations. That is
-- only meaningful if the helpers themselves can produce a red result, so the
-- assertions below distinguish three outcomes that a naive helper would
-- conflate:
--
--   1. the database refused the operation      -> pass
--   2. the operation succeeded                 -> fail
--   3. the statement was broken (typo, missing
--      column, wrong function signature)       -> BROKEN TEST, not a pass
--
-- Case 3 is the trap. A helper that simply catches every exception reports a
-- typo as a successful refusal, and the suite silently stops testing anything.

create schema if not exists tests;

-- SQLSTATEs that mean "this SQL is wrong", never "the database refused".
create or replace function tests.is_broken_statement(p_state text)
returns boolean
language sql
immutable
as $$
  select p_state in (
    '42601', -- syntax_error
    '42703', -- undefined_column
    '42P01', -- undefined_table
    '42883', -- undefined_function
    '42P02', -- undefined_parameter
    '42704', -- undefined_object
    '42P18'  -- indeterminate_datatype
  );
$$;

-- Basic assertion.
create or replace function tests.assert(p_condition boolean, p_description text)
returns void
language plpgsql
as $$
begin
  if p_condition is distinct from true then
    raise exception 'ASSERTION FAILED: %', p_description;
  end if;
  raise notice 'ok   %', p_description;
end;
$$;

create or replace function tests.assert_equals(
  p_actual anyelement,
  p_expected anyelement,
  p_description text
)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'ASSERTION FAILED: % (expected %, got %)',
      p_description, p_expected, p_actual;
  end if;
  raise notice 'ok   %', p_description;
end;
$$;

-- Asserts that a statement is REFUSED by the database.
--
-- p_expect, when given, is matched against both the SQLSTATE and the error
-- message. Passing it is strongly encouraged: without it, a refusal for an
-- unrelated reason (a null violation, a missing foreign key) counts as a pass
-- and the invariant under test is never actually exercised.
create or replace function tests.assert_refused(
  p_sql text,
  p_description text,
  p_expect text default null
)
returns void
language plpgsql
as $$
declare
  v_message text;
  v_state text;
  v_detail text;
begin
  begin
    execute p_sql;
  exception
    when others then
      -- The rule code travels in DETAIL: raise_rule_violation puts it there so
      -- that every hard rule can share one SQLSTATE and still be told apart.
      get stacked diagnostics
        v_message = message_text,
        v_state = returned_sqlstate,
        v_detail = pg_exception_detail;

      if tests.is_broken_statement(v_state) then
        raise exception
          'BROKEN TEST (%): the statement itself is invalid (% %). This is not a refusal.',
          p_description, v_state, v_message;
      end if;

      if p_expect is not null
         and v_state <> p_expect
         and btrim(coalesce(v_detail, '')) <> p_expect
         and position(lower(p_expect) in lower(v_message)) = 0 then
        raise exception
          'ASSERTION FAILED (%): refused, but not for the expected reason. Expected %, got % [detail %] - %',
          p_description, p_expect, v_state, coalesce(v_detail, 'none'), v_message;
      end if;

      raise notice 'ok   refused: %', p_description;
      return;
  end;

  raise exception
    'ASSERTION FAILED: expected the database to refuse, but the statement succeeded: %',
    p_description;
end;
$$;

-- Asserts that a statement SUCCEEDS. Every invariant test file must contain at
-- least one of these as a positive control: without it, the refusals above
-- could all be passing simply because nothing works at all.
create or replace function tests.assert_allowed(p_sql text, p_description text)
returns void
language plpgsql
as $$
declare
  v_message text;
  v_state text;
begin
  execute p_sql;
  raise notice 'ok   allowed: %', p_description;
exception
  when others then
    get stacked diagnostics
      v_message = message_text,
      v_state = returned_sqlstate;
    raise exception
      'ASSERTION FAILED: expected success, but the statement was rejected: % (% %)',
      p_description, v_state, v_message;
end;
$$;

-- Asserts that a statement runs but changes nothing.
--
-- This is how row level security refuses an UPDATE or a DELETE: rows the policy
-- does not cover are simply not visible to the statement, so it succeeds and
-- affects zero rows rather than raising. Only INSERT produces an actual error
-- (42501), because there is no row to hide — the new one violates the check.
--
-- Using assert_refused for an UPDATE would therefore report a correctly
-- protected table as a failure, and, worse, a table that had quietly become
-- writable would look identical to one that had not.
create or replace function tests.assert_no_rows_affected(p_sql text, p_description text)
returns void
language plpgsql
as $$
declare
  v_count bigint;
begin
  execute p_sql;
  get diagnostics v_count = row_count;

  if v_count <> 0 then
    raise exception
      'ASSERTION FAILED: % (expected no rows to be affected, but % were)',
      p_description, v_count;
  end if;

  raise notice 'ok   no rows affected: %', p_description;
end;
$$;

-- Creates a confirmed auth user. The password hash is inert: these users never
-- authenticate, they only provide a real auth.users row for auth.uid() and for
-- foreign keys to resolve against.
create or replace function tests.create_user(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  )
  values (
    v_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    p_email,
    '$2a$10$inert.hash.never.used.for.authentication.in.tests',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  );
  return v_id;
end;
$$;

-- Impersonate a user for row level security checks.
--
-- Both halves matter: auth.uid() reads the JWT claim, and the policies only
-- apply to the authenticated role. Setting the claim without switching role
-- would leave the superuser in charge, and every isolation test would pass
-- while proving nothing.
create or replace function tests.login_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Drop back to the owning role. Call before creating fixtures.
create or replace function tests.logout()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  reset role;
end;
$$;

-- Guard against the isolation tests silently running as superuser, which
-- bypasses row level security entirely.
create or replace function tests.assert_rls_applies()
returns void
language plpgsql
as $$
declare
  v_role text := current_user;
begin
  if v_role <> 'authenticated' then
    raise exception
      'BROKEN TEST: expected to be running as authenticated, but current_user is %. Row level security would not be enforced.',
      v_role;
  end if;
  if coalesce(auth.uid()::text, '') = '' then
    raise exception 'BROKEN TEST: auth.uid() is null, so ownership predicates cannot match.';
  end if;
end;
$$;

-- The isolation tests spend most of their time as the authenticated role, so
-- that role needs to be able to call the helpers. Granted last, once every
-- function above exists.
grant usage on schema tests to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;
