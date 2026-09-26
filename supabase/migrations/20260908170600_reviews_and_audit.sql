-- Mission reviews, the audit trail, and RULE-004.
--
-- RULE-004 is the rule that separates "the premise changed" from "I lost
-- interest". It is enforced by requiring that a categorised justification be
-- recorded in the same transaction that ends an active mission. Not by asking
-- the interface to be well behaved, and not by a session flag a caller could
-- set for itself.

-- ===========================================================================
-- Not-found signalling
-- ===========================================================================
--
-- Distinct from a rule violation: nothing was refused, the row simply is not
-- visible to this user. Kept separate so the server layer does not report a
-- missing record as a broken rule.

create or replace function public.raise_not_found(p_message text)
returns void
language plpgsql
immutable
as $$
begin
  raise exception '%', p_message using errcode = 'CT404';
end;
$$;

-- ===========================================================================
-- mission_reviews
-- ===========================================================================

create table public.mission_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mission_id uuid not null,

  reason_category text not null,
  justification text not null,
  outcome text not null,

  created_at timestamptz not null default now(),

  -- The categories are the legitimate reasons to stop. Boredom, a more
  -- interesting idea, and lost motivation are deliberately absent: those are
  -- what the parking lot is for.
  constraint mission_reviews_reason_category_valid
    check (
      reason_category in (
        'premise_changed',
        'external_dependency',
        'scope_error',
        'strategy_changed',
        'evidence_obsolete'
      )
    ),

  constraint mission_reviews_outcome_valid
    check (outcome in ('kept', 'revised', 'abandoned')),

  -- A justification has to actually say something. The floor is low enough not
  -- to be bureaucratic and high enough to rule out a keystroke.
  constraint mission_reviews_justification_substantive
    check (length(btrim(justification)) >= 20),

  constraint mission_reviews_mission_same_owner
    foreign key (mission_id, user_id)
    references public.missions (id, user_id)
    on delete cascade
);

comment on table public.mission_reviews is
  'RULE-004: the categorised, written justification required to leave an active mission.';

create index mission_reviews_mission_id_idx on public.mission_reviews (mission_id);
create index mission_reviews_user_id_idx on public.mission_reviews (user_id);

-- ===========================================================================
-- RULE-004 enforcement
-- ===========================================================================
--
-- The check is "a matching review exists, recorded in this transaction".
--
-- now() returns the transaction start time and is constant for its duration,
-- so a review row written in this transaction carries exactly that timestamp
-- while anything older is strictly earlier. That makes the justification and
-- the transition genuinely atomic: neither can be committed without the other.
--
-- This is preferred over a session flag that only review_mission() sets,
-- because a flag is something a caller can set for itself, and the rule would
-- then be enforced by convention rather than by the database.

create or replace function public.enforce_mission_exit_review()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'active' then
    return new;
  end if;

  if new.status not in ('revised', 'abandoned') then
    return new;
  end if;

  if not exists (
    select 1
    from public.mission_reviews r
    where r.mission_id = new.id
      and r.outcome = new.status
      and r.created_at >= now()
  ) then
    perform public.raise_rule_violation(
      'RULE-004',
      'Encerrar uma missao ativa exige uma justificativa categorizada. Registre uma revisao.'
    );
  end if;

  return new;
end;
$$;

comment on function public.enforce_mission_exit_review() is
  'RULE-004: leaving an active mission requires a categorised justification recorded in the same transaction.';

-- Name matters: triggers fire in alphabetical order, so activation runs first,
-- then this, then the terminal-state guard.
create trigger missions_enforce_exit_review
  before update on public.missions
  for each row
  execute function public.enforce_mission_exit_review();

-- ===========================================================================
-- audit_events
-- ===========================================================================
--
-- Append-only by construction: there is a select policy and an insert policy,
-- and deliberately no update or delete policy, so the history cannot be
-- rewritten by the person it describes.

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_events is
  'Append-only record of relevant decisions. No update or delete policy exists, by design.';

create index audit_events_user_created_idx
  on public.audit_events (user_id, created_at desc);
create index audit_events_entity_idx
  on public.audit_events (entity_type, entity_id);

-- Written by trigger rather than by application code, so that no write path
-- can forget to record itself.
-- The lifecycle column is named per table — missions have status, curiosities
-- have state — so it is passed as the second trigger argument and read through
-- to_jsonb rather than by static field access. Referencing new.status directly
-- would compile fine and then fail at runtime on any table that spells it
-- differently.
create or replace function public.record_audit_event()
returns trigger
language plpgsql
as $$
declare
  v_entity text := tg_argv[0];
  v_status_column text := coalesce(tg_argv[1], 'status');
  v_old_status text;
  v_new_status text;
  v_action text;
  v_payload jsonb := '{}'::jsonb;
begin
  v_new_status := to_jsonb(new) ->> v_status_column;

  if tg_op = 'INSERT' then
    v_action := v_entity || '.created';
    v_payload := jsonb_build_object('status', v_new_status);
  else
    v_old_status := to_jsonb(old) ->> v_status_column;

    if v_old_status is not distinct from v_new_status then
      return new;
    end if;

    v_action := v_entity || '.status_changed';
    v_payload := jsonb_build_object('from', v_old_status, 'to', v_new_status);
  end if;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (new.user_id, v_entity, new.id, v_action, v_payload);

  return new;
end;
$$;

create trigger missions_audit
  after insert or update on public.missions
  for each row
  execute function public.record_audit_event('mission');

create trigger cycles_audit
  after insert or update on public.cycles
  for each row
  execute function public.record_audit_event('cycle');

create trigger campaigns_audit
  after insert or update on public.campaigns
  for each row
  execute function public.record_audit_event('campaign');

create trigger directions_audit
  after insert or update on public.directions
  for each row
  execute function public.record_audit_event('direction');

-- ===========================================================================
-- State transition RPCs
-- ===========================================================================
--
-- All SECURITY INVOKER, so row level security still applies and a caller can
-- only ever move their own rows. They exist for atomicity and for a single
-- audited entry point, not to grant privilege.
--
-- The interface and the personal agent both call these. Because they carry no
-- extra rights, the agent cannot reach a state the user could not reach
-- themselves.

create or replace function public.activate_mission(p_mission_id uuid)
returns public.missions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_mission public.missions;
begin
  update public.missions
     set status = 'active'
   where id = p_mission_id
     and user_id = (select auth.uid())
  returning * into v_mission;

  if not found then
    perform public.raise_not_found('Missao nao encontrada.');
  end if;

  return v_mission;
end;
$$;

create or replace function public.complete_mission(p_mission_id uuid)
returns public.missions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_mission public.missions;
begin
  update public.missions
     set status = 'completed'
   where id = p_mission_id
     and user_id = (select auth.uid())
  returning * into v_mission;

  if not found then
    perform public.raise_not_found('Missao nao encontrada.');
  end if;

  return v_mission;
end;
$$;

-- Records the justification and applies the outcome together. If either half
-- fails, both roll back, so a mission can never be abandoned with its reason
-- lost.
create or replace function public.review_mission(
  p_mission_id uuid,
  p_reason_category text,
  p_justification text,
  p_outcome text
)
returns public.missions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_mission public.missions;
  v_user_id uuid := (select auth.uid());
begin
  select * into v_mission
  from public.missions
  where id = p_mission_id
    and user_id = v_user_id;

  if not found then
    perform public.raise_not_found('Missao nao encontrada.');
  end if;

  insert into public.mission_reviews
    (user_id, mission_id, reason_category, justification, outcome)
  values
    (v_user_id, p_mission_id, p_reason_category, p_justification, p_outcome);

  if p_outcome in ('revised', 'abandoned') then
    update public.missions
       set status = p_outcome
     where id = p_mission_id
       and user_id = v_user_id
    returning * into v_mission;
  end if;

  return v_mission;
end;
$$;

create or replace function public.close_cycle(p_cycle_id uuid)
returns public.cycles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cycle public.cycles;
begin
  update public.cycles
     set status = 'closed',
         closed_at = now()
   where id = p_cycle_id
     and user_id = (select auth.uid())
  returning * into v_cycle;

  if not found then
    perform public.raise_not_found('Ciclo nao encontrado.');
  end if;

  return v_cycle;
end;
$$;

-- ===========================================================================
-- Row level security
-- ===========================================================================

alter table public.mission_reviews enable row level security;

create policy "mission_reviews_select_own" on public.mission_reviews
  for select
  using (user_id = (select auth.uid()));

create policy "mission_reviews_insert_own" on public.mission_reviews
  for insert
  with check (user_id = (select auth.uid()));

-- No update or delete policy: a recorded justification is part of the history
-- and is not editable after the fact.

alter table public.audit_events enable row level security;

create policy "audit_events_select_own" on public.audit_events
  for select
  using (user_id = (select auth.uid()));

create policy "audit_events_insert_own" on public.audit_events
  for insert
  with check (user_id = (select auth.uid()));

-- No update or delete policy, deliberately. See the table comment.
