-- Evidence, the Definition of Done as a checklist, and completion.
--
-- M11 closes the loop on output:
--
--   RULE-008  a mission can only be completed from active, with every
--             Definition-of-Done criterion satisfied            (new, HARD)
--   RULE-006  a finished mission's record is frozen: its criteria, evidence
--             and sessions refuse every write once it is completed, revised
--             or abandoned                              (enforcement extended)
--
-- Hours appear nowhere in the completion rule. Completion is decided by
-- criteria; the only thing this migration does with mission_sessions is close a
-- timer left running when its mission ends.

-- ===========================================================================
-- RULE-008 in the registry
-- ===========================================================================

insert into public.rules (code, severity, enforcement, position) values
  ('RULE-008', 'critical', 'HARD', 8);

-- ===========================================================================
-- A key that evidence can cite
-- ===========================================================================
--
-- Evidence may cite a criterion, and must cite one of its own mission's. A
-- composite foreign key on (criterion_id, mission_id) says so structurally, and
-- needs this pair to be unique on the referenced side.

alter table public.mission_dod_criteria
  add constraint mission_dod_criteria_id_mission_unique unique (id, mission_id);

-- ===========================================================================
-- mission_evidence
-- ===========================================================================

create table public.mission_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mission_id uuid not null,

  -- Optional. Evidence can speak to the mission as a whole.
  criterion_id uuid,

  description text not null,
  url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint mission_evidence_description_not_blank
    check (length(btrim(description)) > 0),

  constraint mission_evidence_description_length
    check (length(description) <= 500),

  -- http and https only. The link is rendered as an anchor on the evidence
  -- page, and a javascript: URL there would be user input turned executable.
  constraint mission_evidence_url_valid
    check (url is null or (url ~* '^https?://\S+$' and length(url) <= 2000)),

  constraint mission_evidence_mission_same_owner
    foreign key (mission_id, user_id)
    references public.missions (id, user_id)
    on delete cascade,

  -- A cited criterion must belong to this same mission. MATCH SIMPLE, so a
  -- null criterion_id is not checked at all. Removing a criterion (possible
  -- only while the mission is live) un-cites the evidence rather than deleting
  -- it: the output still exists.
  constraint mission_evidence_criterion_same_mission
    foreign key (criterion_id, mission_id)
    references public.mission_dod_criteria (id, mission_id)
    on delete set null (criterion_id)
);

comment on table public.mission_evidence is
  'Concrete output of a mission, optionally citing the criterion it satisfies. The other side of the ledger from hours.';

create index mission_evidence_mission_id_idx on public.mission_evidence (mission_id);
create index mission_evidence_user_id_idx on public.mission_evidence (user_id);
create index mission_evidence_criterion_id_idx on public.mission_evidence (criterion_id);

create trigger mission_evidence_set_updated_at
  before update on public.mission_evidence
  for each row
  execute function public.set_updated_at();

-- ===========================================================================
-- RULE-006 extended: a finished record is frozen
-- ===========================================================================
--
-- One function for every table that belongs to a mission. On update both the
-- old and the new mission are checked, so a row cannot be moved off a finished
-- mission any more than it can be edited on one.
--
-- A mission that is being deleted is invisible here by the time its children's
-- cascading deletes run, so this never blocks the cascade itself.

create or replace function public.enforce_mission_record_frozen()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select m.status into v_status from public.missions m where m.id = old.mission_id;

    if v_status in ('completed', 'revised', 'abandoned') then
      perform public.raise_rule_violation(
        'RULE-006',
        'O registro de uma missao encerrada nao pode ser alterado.'
      );
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select m.status into v_status from public.missions m where m.id = new.mission_id;

    if v_status in ('completed', 'revised', 'abandoned') then
      perform public.raise_rule_violation(
        'RULE-006',
        'O registro de uma missao encerrada nao pode ser alterado.'
      );
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.enforce_mission_record_frozen() is
  'RULE-006: once a mission is completed, revised or abandoned, its criteria, evidence and sessions refuse every write.';

-- Criteria: insert, update and delete. Removing a criterion rewrites a
-- Definition of Done as surely as editing one.
create trigger mission_dod_criteria_frozen
  before insert or update or delete on public.mission_dod_criteria
  for each row
  execute function public.enforce_mission_record_frozen();

create trigger mission_evidence_frozen
  before update or delete on public.mission_evidence
  for each row
  execute function public.enforce_mission_record_frozen();

-- Sessions: update and delete. Insert is already refused on any non-active
-- mission by mission_sessions_enforce (M10).
create trigger mission_sessions_frozen
  before update or delete on public.mission_sessions
  for each row
  execute function public.enforce_mission_record_frozen();

-- ===========================================================================
-- Evidence belongs to the active mission
-- ===========================================================================
--
-- Output for a draft is output for a track never committed to. A finished
-- mission's record is closed, and says so in RULE-006's words rather than with a
-- constraint name, because that is the more useful explanation.

create or replace function public.enforce_mission_evidence()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  if tg_op = 'UPDATE' then
    if new.mission_id is distinct from old.mission_id then
      raise exception 'mission_evidence_mission_fixed: evidence cannot be moved to another mission'
        using errcode = '23514', constraint = 'mission_evidence_mission_fixed';
    end if;
    return new;
  end if;

  select m.status into v_status from public.missions m where m.id = new.mission_id;

  if v_status in ('completed', 'revised', 'abandoned') then
    perform public.raise_rule_violation(
      'RULE-006',
      'Uma missao encerrada nao recebe novas evidencias. O registro dela esta completo.'
    );
  end if;

  if v_status is distinct from 'active' then
    raise exception 'mission_evidence_mission_active: evidence is recorded against the active mission only'
      using errcode = '23514', constraint = 'mission_evidence_mission_active';
  end if;

  return new;
end;
$$;

-- Named so it runs before mission_evidence_frozen: on an update, the move check
-- comes first and the frozen check second.
create trigger mission_evidence_enforce
  before insert or update on public.mission_evidence
  for each row
  execute function public.enforce_mission_evidence();

-- ===========================================================================
-- Criteria are satisfied while the mission is live
-- ===========================================================================
--
-- A draft was never committed to, so its criteria cannot be met yet; a
-- finished mission's are frozen by the trigger above. On insert only a
-- criterion arriving already satisfied is checked.

create or replace function public.enforce_criterion_satisfaction()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  if tg_op = 'INSERT' and new.satisfied_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.satisfied_at is not distinct from old.satisfied_at then
    return new;
  end if;

  select m.status into v_status from public.missions m where m.id = new.mission_id;

  if v_status is distinct from 'active' then
    raise exception 'mission_dod_criteria_satisfy_active: criteria are satisfied on the active mission only'
      using errcode = '23514', constraint = 'mission_dod_criteria_satisfy_active';
  end if;

  return new;
end;
$$;

-- "frozen" sorts before "satisfaction", so a finished mission answers with
-- RULE-006 and a draft with the satisfaction guard.
create trigger mission_dod_criteria_satisfaction
  before insert or update on public.mission_dod_criteria
  for each row
  execute function public.enforce_criterion_satisfaction();

-- ===========================================================================
-- RULE-008 — completion by the Definition of Done
-- ===========================================================================
--
-- INSERT and UPDATE, FOR EACH ROW. Insert matters: a mission inserted straight
-- into `completed` would otherwise skip the Definition of Done entirely.
--
-- There is deliberately no mention of hours. Completion is decided by criteria
-- (RULE-102), and a check here that read mission_sessions would be the first
-- step towards hours gating it.

create or replace function public.enforce_mission_completion()
returns trigger
language plpgsql
as $$
declare
  v_total integer;
  v_open integer;
begin
  if new.status <> 'completed' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform public.raise_rule_violation(
      'RULE-008',
      'Uma missao so pode ser concluida a partir do estado ativo.'
    );
  end if;

  -- Already completed: RULE-006 is the terminal-state guard's business.
  if old.status = 'completed' then
    return new;
  end if;

  if old.status <> 'active' then
    perform public.raise_rule_violation(
      'RULE-008',
      'Uma missao so pode ser concluida a partir do estado ativo.'
    );
  end if;

  select count(*), count(*) filter (where c.satisfied_at is null)
    into v_total, v_open
  from public.mission_dod_criteria c
  where c.mission_id = new.id;

  -- Zero criteria is not "all satisfied": an emptied Definition of Done has no
  -- honest end state, which is RULE-002's whole argument.
  if v_total = 0 or v_open > 0 then
    perform public.raise_rule_violation(
      'RULE-008',
      'Ainda ha criterios de conclusao em aberto.'
    );
  end if;

  return new;
end;
$$;

comment on function public.enforce_mission_completion() is
  'RULE-008: a mission is completed only from active, with at least one criterion and every criterion satisfied.';

create trigger missions_enforce_completion
  before insert or update on public.missions
  for each row
  execute function public.enforce_mission_completion();

-- ===========================================================================
-- A timer does not outlive its mission
-- ===========================================================================
--
-- When a mission leaves `active` — completed, revised or abandoned — a session
-- still running on it ends at that moment. BEFORE the mission row changes, so
-- the frozen-record trigger on mission_sessions still sees an active mission and
-- lets the close through; if any later guard refuses the transition, the whole
-- transaction rolls back and the session keeps running.
--
-- Named to sort first among the missions triggers, which is harmless: it only
-- acts when leaving active, and it is undone if anything after it refuses.

create or replace function public.close_running_session_on_exit()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'active' and new.status <> 'active' then
    -- A session begun in this same transaction has no length yet. It is not a
    -- session, so it goes rather than being stamped with an end equal to its
    -- start, which the period check would refuse.
    delete from public.mission_sessions
     where mission_id = new.id
       and ended_at is null
       and started_at >= now();

    update public.mission_sessions
       set ended_at = now()
     where mission_id = new.id
       and ended_at is null;
  end if;

  return new;
end;
$$;

create trigger missions_close_running_session
  before update on public.missions
  for each row
  execute function public.close_running_session_on_exit();

-- ===========================================================================
-- Satisfying a criterion
-- ===========================================================================
--
-- An RPC so the moment is stamped by the database clock, like every other
-- instant in the record. Marking an already satisfied criterion keeps its
-- original moment. SECURITY INVOKER: row level security applies.

create or replace function public.set_criterion_satisfied(
  p_criterion_id uuid,
  p_satisfied boolean
)
returns public.mission_dod_criteria
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_criterion public.mission_dod_criteria;
begin
  update public.mission_dod_criteria
     set satisfied_at = case when p_satisfied then coalesce(satisfied_at, now()) else null end
   where id = p_criterion_id
     and user_id = (select auth.uid())
  returning * into v_criterion;

  if not found then
    perform public.raise_not_found('Criterio nao encontrado.');
  end if;

  return v_criterion;
end;
$$;

comment on function public.set_criterion_satisfied(uuid, boolean) is
  'Marks a criterion satisfied (stamping the database clock) or open again. Refused unless its mission is active.';

-- ===========================================================================
-- Row level security
-- ===========================================================================

alter table public.mission_evidence enable row level security;

create policy "mission_evidence_select_own" on public.mission_evidence
  for select
  using (user_id = (select auth.uid()));

create policy "mission_evidence_insert_own" on public.mission_evidence
  for insert
  with check (user_id = (select auth.uid()));

create policy "mission_evidence_update_own" on public.mission_evidence
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Deletable while the mission is live, to correct a mistake. Once the mission
-- is finished, mission_evidence_frozen refuses it (RULE-006).
create policy "mission_evidence_delete_own" on public.mission_evidence
  for delete
  using (user_id = (select auth.uid()));
