-- Meta test: proves the harness can produce a red result.
--
-- Every other file in this suite asserts that the database refuses something.
-- Those assertions are only worth reading if the machinery behind them is
-- capable of failing. A suite that always passes is worse than no suite,
-- because it converts an untested system into a system everyone believes is
-- tested.
--
-- So this file deliberately drives each helper into its failure mode and
-- asserts that it raises. If someone later weakens the helpers, this goes red
-- first.

\i supabase/tests/helpers.sql

-- 1. A false assertion must raise.
do $$
declare
  v_raised boolean := false;
begin
  begin
    perform tests.assert(false, 'deliberately false assertion');
  exception
    when others then
      v_raised := true;
  end;

  if not v_raised then
    raise exception 'META FAILURE: tests.assert(false) did not raise.';
  end if;
  raise notice 'ok   tests.assert detects a false condition';
end;
$$;

-- 2. assert_equals must raise on a mismatch.
do $$
declare
  v_raised boolean := false;
begin
  begin
    perform tests.assert_equals(1, 2, 'deliberately unequal');
  exception
    when others then
      v_raised := true;
  end;

  if not v_raised then
    raise exception 'META FAILURE: tests.assert_equals did not detect a mismatch.';
  end if;
  raise notice 'ok   tests.assert_equals detects a mismatch';
end;
$$;

-- 3. assert_refused must FAIL when the statement actually succeeds.
--    This is the assertion that stops a decommissioned invariant from looking
--    like it is still being enforced.
do $$
declare
  v_raised boolean := false;
begin
  begin
    perform tests.assert_refused('select 1', 'a statement that plainly succeeds');
  exception
    when others then
      v_raised := true;
  end;

  if not v_raised then
    raise exception
      'META FAILURE: assert_refused treated a successful statement as a refusal.';
  end if;
  raise notice 'ok   tests.assert_refused rejects a statement that succeeded';
end;
$$;

-- 4. assert_refused must report a broken statement as BROKEN, not as a pass.
--    Without this, a renamed column or a typo would masquerade as a working
--    invariant test forever.
do $$
declare
  v_message text;
  v_raised boolean := false;
begin
  begin
    perform tests.assert_refused(
      'select * from a_table_that_does_not_exist',
      'a statement referencing a missing table'
    );
  exception
    when others then
      get stacked diagnostics v_message = message_text;
      v_raised := true;
  end;

  if not v_raised then
    raise exception 'META FAILURE: a broken statement was accepted as a refusal.';
  end if;
  if position('BROKEN TEST' in v_message) = 0 then
    raise exception
      'META FAILURE: a broken statement raised, but was not identified as broken. Got: %',
      v_message;
  end if;
  raise notice 'ok   tests.assert_refused distinguishes a broken statement from a refusal';
end;
$$;

-- 5. assert_refused must reject a refusal that happened for the wrong reason.
do $$
declare
  v_raised boolean := false;
begin
  begin
    perform tests.assert_refused(
      'select 1 / 0',
      'division by zero, expected to be reported as a rule violation',
      'CT001'
    );
  exception
    when others then
      v_raised := true;
  end;

  if not v_raised then
    raise exception
      'META FAILURE: assert_refused accepted a refusal for an unrelated reason.';
  end if;
  raise notice 'ok   tests.assert_refused checks why the statement was refused';
end;
$$;

-- 6. assert_allowed must raise when the statement is rejected.
do $$
declare
  v_raised boolean := false;
begin
  begin
    perform tests.assert_allowed('select 1 / 0', 'a statement that cannot succeed');
  exception
    when others then
      v_raised := true;
  end;

  if not v_raised then
    raise exception 'META FAILURE: assert_allowed accepted a failing statement.';
  end if;
  raise notice 'ok   tests.assert_allowed detects a rejected statement';
end;
$$;

-- 7. Positive control: the helpers still pass when they should.
do $$
begin
  perform tests.assert(true, 'a true condition passes');
  perform tests.assert_equals('a'::text, 'a'::text, 'equal values pass');
  perform tests.assert_allowed('select 1', 'a valid statement is allowed');
  perform tests.assert_refused(
    'select 1 / 0',
    'division by zero is refused',
    '22012'
  );
  raise notice 'ok   the helpers pass in their success paths';
end;
$$;
