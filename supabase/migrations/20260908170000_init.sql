-- Extensions and shared helpers.
--
-- Kept deliberately small: this migration establishes the vocabulary the rest
-- of the schema depends on, and nothing else.

-- ---------------------------------------------------------------------------
-- Rule violations
-- ---------------------------------------------------------------------------
--
-- Every HARD invariant is enforced in the database. When one fires, the server
-- layer needs to distinguish "the user tried to break a rule" from "something
-- went wrong", so that it can render an explanation in the user's language
-- instead of leaking a Postgres error.
--
-- All rule violations therefore raise a single custom SQLSTATE, with the rule
-- code carried in DETAIL.
--
--   SQLSTATE CT001  -> a Continuum rule refused the operation
--   DETAIL          -> the rule code, e.g. RULE-001
create or replace function public.raise_rule_violation(
  p_rule_code text,
  p_message text
)
returns void
language plpgsql
immutable
as $$
begin
  raise exception '%', p_message
    using errcode = 'CT001',
          detail = p_rule_code;
end;
$$;

comment on function public.raise_rule_violation(text, text) is
  'Raises a Continuum rule violation as SQLSTATE CT001 with the rule code in DETAIL.';

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
--
-- Applied as a trigger by every table carrying an updated_at column, so the
-- value cannot drift when a write path forgets to set it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger keeping updated_at accurate regardless of the write path.';
