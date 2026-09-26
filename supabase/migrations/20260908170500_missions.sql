-- Missions and their Definition-of-Done criteria.
--
-- This is the centre of the product. Four of the seven hard rules live here,
-- and they are enforced by the storage layer rather than by the application:
--
--   RULE-001  at most one active mission per user
--   RULE-002  a mission cannot be activated without a Definition of Done
--   RULE-003  minimum and target load, with target >= minimum > 0
--   RULE-005  a mission can only be activated inside the active cycle
--   RULE-006  a completed mission is terminal
--
-- RULE-004, which governs leaving an active mission, needs the reviews table
-- and arrives in the next migration.

-- ===========================================================================
-- missions
-- ===========================================================================

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cycle_id uuid not null,
  campaign_id uuid not null,

  title text not null,
  reason text not null,
  description text,

  -- Stored as minutes so that the interface can present hours without the
  -- database carrying a lossy unit.
  min_load_minutes integer not null,
  target_load_minutes integer not null,

  priority integer not null default 1,
  status text not null default 'draft',

  activated_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint missions_title_not_blank
    check (length(btrim(title)) > 0),

  -- A mission must say why it exists. This is the field that later makes an
  -- honest review possible: without a recorded reason there is nothing to
  -- compare a change of premise against.
  constraint missions_reason_not_blank
    check (length(btrim(reason)) > 0),

  constraint missions_status_valid
    check (status in ('draft', 'active', 'completed', 'revised', 'abandoned')),

  -- RULE-003. The minimum is meant to be safely achievable in an imperfect
  -- month; the target is the ambition. Neither may be absent, and the target
  -- may not sit below the floor.
  constraint missions_load_coherent
    check (min_load_minutes > 0 and target_load_minutes >= min_load_minutes),

  constraint missions_priority_valid
    check (priority between 1 and 5),

  constraint missions_completed_at_consistent
    check ((status = 'completed') = (completed_at is not null)),

  constraint missions_campaign_same_owner
    foreign key (campaign_id, user_id)
    references public.campaigns (id, user_id)
    on delete restrict,

  constraint missions_cycle_same_owner
    foreign key (cycle_id, user_id)
    references public.cycles (id, user_id)
    on delete restrict,

  constraint missions_id_user_unique unique (id, user_id)
);

comment on table public.missions is
  'The primary mission. At most one is active per user at any time.';

comment on constraint missions_load_coherent on public.missions is
  'RULE-003: every mission carries a minimum and a target load, target >= minimum > 0.';

create index missions_user_id_idx on public.missions (user_id);
create index missions_cycle_id_idx on public.missions (cycle_id);
create index missions_campaign_id_idx on public.missions (campaign_id);
create index missions_user_status_idx on public.missions (user_id, status);

-- RULE-001, enforced by the storage layer.
--
-- A partial unique index rather than a trigger, deliberately: it holds under
-- concurrency, it cannot be sidestepped by any write path, and it costs
-- nothing to check. If this line is ever removed, the product stops being the
-- product.
create unique index missions_one_active_per_user
  on public.missions (user_id)
  where status = 'active';

comment on index public.missions_one_active_per_user is
  'RULE-001: at most one active primary mission per user.';

create trigger missions_set_updated_at
  before update on public.missions
  for each row
  execute function public.set_updated_at();

-- ===========================================================================
-- mission_dod_criteria
-- ===========================================================================
--
-- The Definition of Done is stored as rows rather than prose. Prose cannot be
-- enforced, satisfied item by item, or linked to evidence; rows can. This is
-- what turns RULE-002 from an intention into a constraint.

create table public.mission_dod_criteria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mission_id uuid not null,

  description text not null,
  position integer not null default 0,
  satisfied_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint mission_dod_criteria_description_not_blank
    check (length(btrim(description)) > 0),

  constraint mission_dod_criteria_mission_same_owner
    foreign key (mission_id, user_id)
    references public.missions (id, user_id)
    on delete cascade,

  constraint mission_dod_criteria_id_user_unique unique (id, user_id)
);

comment on table public.mission_dod_criteria is
  'Definition-of-Done criteria as rows, so completion is checkable rather than a matter of opinion.';

create index mission_dod_criteria_mission_id_idx
  on public.mission_dod_criteria (mission_id);
create index mission_dod_criteria_user_id_idx
  on public.mission_dod_criteria (user_id);

create trigger mission_dod_criteria_set_updated_at
  before update on public.mission_dod_criteria
  for each row
  execute function public.set_updated_at();

-- ===========================================================================
-- Activation guard: RULE-002 and RULE-005
-- ===========================================================================
--
-- Fires on INSERT and UPDATE. Covering only INSERT would leave the realistic
-- hole wide open, since a mission is normally created as a draft and activated
-- later.

create or replace function public.enforce_mission_activation()
returns trigger
language plpgsql
as $$
declare
  v_criteria_count integer;
  v_active_cycle_id uuid;
begin
  -- Only interested in transitions INTO the active state.
  if new.status <> 'active' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'active' then
    return new;
  end if;

  -- RULE-002
  select count(*)
    into v_criteria_count
  from public.mission_dod_criteria c
  where c.mission_id = new.id;

  if v_criteria_count = 0 then
    perform public.raise_rule_violation(
      'RULE-002',
      'A missao nao pode ser ativada sem pelo menos um criterio de conclusao.'
    );
  end if;

  -- RULE-005
  select c.id
    into v_active_cycle_id
  from public.cycles c
  where c.user_id = new.user_id
    and c.status = 'active';

  if v_active_cycle_id is null then
    perform public.raise_rule_violation(
      'RULE-005',
      'Nao existe ciclo ativo. Abra um ciclo antes de ativar uma missao.'
    );
  end if;

  if new.cycle_id is distinct from v_active_cycle_id then
    perform public.raise_rule_violation(
      'RULE-005',
      'A missao so pode ser ativada dentro do ciclo ativo.'
    );
  end if;

  if new.activated_at is null then
    new.activated_at := now();
  end if;

  return new;
end;
$$;

comment on function public.enforce_mission_activation() is
  'RULE-002 and RULE-005: a mission may only become active with a Definition of Done, inside the active cycle.';

create trigger missions_enforce_activation
  before insert or update on public.missions
  for each row
  execute function public.enforce_mission_activation();

-- ===========================================================================
-- Terminal state guard: RULE-006
-- ===========================================================================
--
-- FOR EACH ROW, not FOR EACH STATEMENT: a statement-level trigger would let a
-- multi-row update walk straight past this.

create or replace function public.enforce_mission_terminal_state()
returns trigger
language plpgsql
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  -- RULE-006
  if old.status = 'completed' then
    perform public.raise_rule_violation(
      'RULE-006',
      'Uma missao concluida permanece concluida. Crie uma nova missao para o trabalho seguinte.'
    );
  end if;

  if old.status in ('revised', 'abandoned') then
    perform public.raise_rule_violation(
      'RULE-006',
      'Uma missao encerrada nao pode ser reaberta. Crie uma nova missao.'
    );
  end if;

  if new.status = 'completed' and new.completed_at is null then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

comment on function public.enforce_mission_terminal_state() is
  'RULE-006: completed, revised and abandoned are terminal states.';

create trigger missions_enforce_terminal_state
  before update on public.missions
  for each row
  execute function public.enforce_mission_terminal_state();

-- ===========================================================================
-- Row level security
-- ===========================================================================

alter table public.missions enable row level security;

create policy "missions_select_own" on public.missions
  for select
  using (user_id = (select auth.uid()));

create policy "missions_insert_own" on public.missions
  for insert
  with check (user_id = (select auth.uid()));

create policy "missions_update_own" on public.missions
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "missions_delete_own" on public.missions
  for delete
  using (user_id = (select auth.uid()));

alter table public.mission_dod_criteria enable row level security;

create policy "mission_dod_criteria_select_own" on public.mission_dod_criteria
  for select
  using (user_id = (select auth.uid()));

create policy "mission_dod_criteria_insert_own" on public.mission_dod_criteria
  for insert
  with check (user_id = (select auth.uid()));

create policy "mission_dod_criteria_update_own" on public.mission_dod_criteria
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "mission_dod_criteria_delete_own" on public.mission_dod_criteria
  for delete
  using (user_id = (select auth.uid()));
