-- Curiosities, knowledge notes, and the rules registry.

-- ===========================================================================
-- curiosities
-- ===========================================================================
--
-- The parking lot. Ideas must not be lost, and must also not become
-- priorities the moment they arrive. Capture keeps them safe; the states below
-- keep them out of the active line until a cycle boundary makes evaluation
-- appropriate.
--
-- Only title is required: capture has to take seconds, or it will not happen
-- at the moment the idea appears, which is the only moment that matters.

create table public.curiosities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  title text not null,
  description text,
  reason text,
  area text,
  potential text,
  state text not null default 'captured',

  promoted_mission_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint curiosities_title_not_blank
    check (length(btrim(title)) > 0),

  constraint curiosities_state_valid
    check (state in ('captured', 'waiting', 'candidate', 'chosen', 'archived')),

  constraint curiosities_potential_valid
    check (potential is null or potential in ('low', 'medium', 'high')),

  -- MATCH SIMPLE: the reference is only checked once a mission is actually
  -- linked, which is what allows the column to stay null for a parked idea.
  constraint curiosities_promoted_mission_same_owner
    foreign key (promoted_mission_id, user_id)
    references public.missions (id, user_id)
    on delete restrict
);

comment on table public.curiosities is
  'The curiosity parking lot. Captured in seconds, evaluated at a cycle boundary.';

create index curiosities_user_id_idx on public.curiosities (user_id);
create index curiosities_user_state_idx on public.curiosities (user_id, state);

create trigger curiosities_set_updated_at
  before update on public.curiosities
  for each row
  execute function public.set_updated_at();

create trigger curiosities_audit
  after insert or update on public.curiosities
  for each row
  -- Curiosities track their lifecycle in "state", not "status".
  execute function public.record_audit_event('curiosity', 'state');

-- ---------------------------------------------------------------------------
-- RULE-007
-- ---------------------------------------------------------------------------
--
-- Note what this function does NOT accept: a status. The mission it creates is
-- always a draft, so promotion cannot produce an active mission by any
-- argument the caller supplies. Combined with RULE-005, which binds activation
-- to the active cycle, a curiosity cannot become the current mission
-- mid-cycle through any path at all.

create or replace function public.promote_curiosity_to_mission(
  p_curiosity_id uuid,
  p_cycle_id uuid,
  p_campaign_id uuid,
  p_title text,
  p_reason text,
  p_min_load_minutes integer,
  p_target_load_minutes integer
)
returns public.missions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_curiosity public.curiosities;
  v_mission public.missions;
begin
  select * into v_curiosity
  from public.curiosities
  where id = p_curiosity_id
    and user_id = v_user_id;

  if not found then
    perform public.raise_not_found('Curiosidade nao encontrada.');
  end if;

  insert into public.missions (
    user_id,
    cycle_id,
    campaign_id,
    title,
    reason,
    min_load_minutes,
    target_load_minutes,
    status
  )
  values (
    v_user_id,
    p_cycle_id,
    p_campaign_id,
    p_title,
    p_reason,
    p_min_load_minutes,
    p_target_load_minutes,
    'draft'
  )
  returning * into v_mission;

  update public.curiosities
     set state = 'chosen',
         promoted_mission_id = v_mission.id
   where id = p_curiosity_id
     and user_id = v_user_id;

  return v_mission;
end;
$$;

comment on function public.promote_curiosity_to_mission is
  'RULE-007: promotes a curiosity into a DRAFT mission. Accepts no status argument, by design.';

-- ===========================================================================
-- knowledge_notes and knowledge_links
-- ===========================================================================
--
-- Zettelkasten principles, applied lightly. Only a title and content are
-- required, and nothing anywhere in the product ever demands that a note be
-- written. A note system that must be fed becomes administration, which is the
-- opposite of what this application is for.

create table public.knowledge_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  title text not null,
  content text not null,
  note_type text not null default 'concept',
  mission_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint knowledge_notes_title_not_blank
    check (length(btrim(title)) > 0),

  constraint knowledge_notes_type_valid
    check (
      note_type in (
        'discovery',
        'concept',
        'evidence',
        'connection',
        'error',
        'generalisation'
      )
    ),

  constraint knowledge_notes_mission_same_owner
    foreign key (mission_id, user_id)
    references public.missions (id, user_id)
    on delete set null,

  constraint knowledge_notes_id_user_unique unique (id, user_id)
);

create index knowledge_notes_user_id_idx on public.knowledge_notes (user_id);
create index knowledge_notes_mission_id_idx on public.knowledge_notes (mission_id);

create trigger knowledge_notes_set_updated_at
  before update on public.knowledge_notes
  for each row
  execute function public.set_updated_at();

create table public.knowledge_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  from_note_id uuid not null,
  to_note_id uuid not null,
  relation text not null default 'relates_to',

  created_at timestamptz not null default now(),

  constraint knowledge_links_no_self_link
    check (from_note_id <> to_note_id),

  constraint knowledge_links_relation_valid
    check (relation in ('relates_to', 'supports', 'contradicts', 'extends', 'derived_from')),

  constraint knowledge_links_unique_triple
    unique (from_note_id, to_note_id, relation),

  constraint knowledge_links_from_same_owner
    foreign key (from_note_id, user_id)
    references public.knowledge_notes (id, user_id)
    on delete cascade,

  constraint knowledge_links_to_same_owner
    foreign key (to_note_id, user_id)
    references public.knowledge_notes (id, user_id)
    on delete cascade
);

create index knowledge_links_from_idx on public.knowledge_links (from_note_id);
create index knowledge_links_to_idx on public.knowledge_links (to_note_id);
create index knowledge_links_user_id_idx on public.knowledge_links (user_id);

-- ===========================================================================
-- rules
-- ===========================================================================
--
-- Reference data, seeded here and readable by any authenticated user. There
-- are no write policies: the registry describes what the database enforces,
-- and it would be dishonest for the application to be able to edit it.
--
-- Only the machine-checkable metadata lives here. The human-readable name,
-- description, rationale and exceptions live in lib/i18n/pt-BR.ts keyed by
-- code, which keeps every user-facing string in one place and avoids the same
-- prose drifting between SQL and TypeScript.

create table public.rules (
  code text primary key,
  severity text not null,
  enforcement text not null,
  active boolean not null default true,
  position integer not null default 0,

  constraint rules_severity_valid
    check (severity in ('critical', 'high', 'medium', 'low')),

  constraint rules_enforcement_valid
    check (enforcement in ('HARD', 'SOFT', 'ADVISORY'))
);

comment on table public.rules is
  'Rule registry metadata. Read-only reference data: the Rules page must reflect what is actually enforced.';

insert into public.rules (code, severity, enforcement, position) values
  ('RULE-001', 'critical', 'HARD', 1),
  ('RULE-002', 'critical', 'HARD', 2),
  ('RULE-003', 'high', 'HARD', 3),
  ('RULE-004', 'critical', 'HARD', 4),
  ('RULE-005', 'high', 'HARD', 5),
  ('RULE-006', 'high', 'HARD', 6),
  ('RULE-007', 'critical', 'HARD', 7),
  ('RULE-101', 'medium', 'ADVISORY', 101),
  ('RULE-102', 'medium', 'ADVISORY', 102),
  ('RULE-103', 'medium', 'ADVISORY', 103);

-- ===========================================================================
-- rule_events
-- ===========================================================================
--
-- Records when a rule blocked, was overridden, or advised. This is what later
-- makes behavioural observation possible: patterns over time, stated as
-- observations about recorded behaviour, never as a diagnosis.

create table public.rule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rule_code text not null references public.rules (code),
  outcome text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint rule_events_outcome_valid
    check (outcome in ('blocked', 'overridden', 'advised'))
);

create index rule_events_user_created_idx
  on public.rule_events (user_id, created_at desc);
create index rule_events_rule_code_idx on public.rule_events (rule_code);

-- ===========================================================================
-- Row level security
-- ===========================================================================

alter table public.curiosities enable row level security;

create policy "curiosities_select_own" on public.curiosities
  for select using (user_id = (select auth.uid()));
create policy "curiosities_insert_own" on public.curiosities
  for insert with check (user_id = (select auth.uid()));
create policy "curiosities_update_own" on public.curiosities
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "curiosities_delete_own" on public.curiosities
  for delete using (user_id = (select auth.uid()));

alter table public.knowledge_notes enable row level security;

create policy "knowledge_notes_select_own" on public.knowledge_notes
  for select using (user_id = (select auth.uid()));
create policy "knowledge_notes_insert_own" on public.knowledge_notes
  for insert with check (user_id = (select auth.uid()));
create policy "knowledge_notes_update_own" on public.knowledge_notes
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "knowledge_notes_delete_own" on public.knowledge_notes
  for delete using (user_id = (select auth.uid()));

alter table public.knowledge_links enable row level security;

create policy "knowledge_links_select_own" on public.knowledge_links
  for select using (user_id = (select auth.uid()));
create policy "knowledge_links_insert_own" on public.knowledge_links
  for insert with check (user_id = (select auth.uid()));
create policy "knowledge_links_update_own" on public.knowledge_links
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "knowledge_links_delete_own" on public.knowledge_links
  for delete using (user_id = (select auth.uid()));

-- Readable by every authenticated user, writable by none.
alter table public.rules enable row level security;

create policy "rules_select_all" on public.rules
  for select
  to authenticated
  using (true);

alter table public.rule_events enable row level security;

create policy "rule_events_select_own" on public.rule_events
  for select using (user_id = (select auth.uid()));
create policy "rule_events_insert_own" on public.rule_events
  for insert with check (user_id = (select auth.uid()));

-- No update or delete policy: rule events are part of the behavioural record.
