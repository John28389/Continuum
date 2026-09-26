-- Mission sessions: time invested in the active mission.
--
-- Hours are an INPUT metric. Nothing in this migration lets a session complete,
-- satisfy, or otherwise advance a mission: completion is decided by the
-- Definition of Done (RULE-102). Sessions record effort and nothing else.
--
-- What the database refuses here, and why each lives in the schema rather than
-- in a form:
--
--   * Overlapping sessions. A person is in one session at a time; two
--     overlapping periods would count the same hour twice.
--   * A session on a mission that is not active. Time logged against a draft
--     is time spent on a track that was never committed to — the parallel
--     work RULE-001 exists to prevent — and time logged against a completed,
--     revised or abandoned mission would rewrite a record RULE-006 says is
--     final.
--   * A session in the future. Logging hours not yet worked inflates an input
--     metric by assertion.
--   * Moving a session to another mission after the fact.

-- ===========================================================================
-- mission_sessions
-- ===========================================================================

create table public.mission_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mission_id uuid not null,

  -- Defaulted by the database, and stop_mission_session() stamps the end from
  -- the same clock. A timer's two halves therefore never come from two
  -- different machines, so clock drift cannot produce a negative or inflated
  -- duration.
  started_at timestamptz not null default now(),
  -- Null while the session is running.
  ended_at timestamptz,

  note text,

  -- Measured by the timer, or remembered and logged afterwards. Kept because
  -- the difference is honest information about the figure, not decoration.
  source text not null default 'timer',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Strictly after: a zero-length session is not a session.
  constraint mission_sessions_period_valid
    check (ended_at is null or ended_at > started_at),

  constraint mission_sessions_source_valid
    check (source in ('timer', 'manual')),

  constraint mission_sessions_note_length
    check (note is null or length(note) <= 2000),

  constraint mission_sessions_mission_same_owner
    foreign key (mission_id, user_id)
    references public.missions (id, user_id)
    on delete cascade
);

comment on table public.mission_sessions is
  'Time invested in a mission. An input metric: it never completes or advances a mission (RULE-102).';

create index mission_sessions_mission_id_idx on public.mission_sessions (mission_id);
create index mission_sessions_user_id_idx on public.mission_sessions (user_id);
create index mission_sessions_user_started_idx on public.mission_sessions (user_id, started_at);

-- At most one running session per user, declaratively.
--
-- The overlap trigger below already implies this — two open-ended periods
-- always overlap — but a unique index holds under any concurrency without
-- relying on the trigger's lock being correct, and it costs nothing. Belt and
-- braces for the one case a forgotten tab makes likely.
create unique index mission_sessions_one_running_per_user
  on public.mission_sessions (user_id)
  where ended_at is null;

create trigger mission_sessions_set_updated_at
  before update on public.mission_sessions
  for each row
  execute function public.set_updated_at();

-- ===========================================================================
-- Session guard
-- ===========================================================================
--
-- Overlap is enforced by a trigger holding a per-user advisory lock, rather
-- than by an exclusion constraint. The idiomatic exclusion constraint,
-- (user_id WITH =, tstzrange WITH &&), needs the btree_gist extension for the
-- uuid equality, and adding an extension is a decision for the repository
-- owner rather than a side effect of a milestone. See docs/decisions.md.
--
-- The lock is what makes the check race-free. It is transaction-scoped, so a
-- concurrent writer for the same user blocks until the first commits; under
-- READ COMMITTED the check query that follows then takes a fresh snapshot and
-- sees the committed row. Different users hash to different keys and never
-- wait on each other (a hash collision costs a brief wait, never correctness).
--
-- Refusals name a constraint, so the server layer can recognise them exactly
-- as it recognises a real check constraint and render an explanation rather
-- than a Postgres error.

create or replace function public.enforce_mission_session()
returns trigger
language plpgsql
as $$
declare
  v_mission_status text;
begin
  -- A session belongs to one mission for its whole life. Reassigning it would
  -- be a way to move hours onto a mission they were not spent on.
  if tg_op = 'UPDATE' and new.mission_id is distinct from old.mission_id then
    raise exception 'mission_sessions_mission_fixed: a session cannot be moved to another mission'
      using errcode = '23514', constraint = 'mission_sessions_mission_fixed';
  end if;

  -- Only on insert. A session already running when its mission stops being
  -- active must still be stoppable, or a completed mission would leave a timer
  -- that can never end.
  if tg_op = 'INSERT' then
    select m.status
      into v_mission_status
    from public.missions m
    where m.id = new.mission_id;

    if v_mission_status is distinct from 'active' then
      raise exception 'mission_sessions_mission_active: sessions are logged against the active mission only'
        using errcode = '23514', constraint = 'mission_sessions_mission_active';
    end if;
  end if;

  -- now() is the transaction's start, which is also what the column default and
  -- stop_mission_session() use, so a timer can never trip its own check.
  if new.started_at > now() or new.ended_at > now() then
    raise exception 'mission_sessions_not_in_future: a session cannot end after the present moment'
      using errcode = '23514', constraint = 'mission_sessions_not_in_future';
  end if;

  -- A period that ends before it starts is refused by the
  -- mission_sessions_period_valid check constraint, which Postgres evaluates
  -- after this trigger. Building a range from it below would raise a bare
  -- "range lower bound" error first, which the application cannot explain, so
  -- the row is handed on to the constraint instead. (A zero-length period
  -- builds a valid empty range and reaches the constraint either way.)
  if new.ended_at is not null and new.ended_at < new.started_at then
    return new;
  end if;

  perform pg_advisory_xact_lock(1047, hashtext(new.user_id::text));

  -- Half-open periods: a session ending at 11:00 and another starting at 11:00
  -- are adjacent, not overlapping. A running session extends to infinity.
  if exists (
    select 1
    from public.mission_sessions s
    where s.user_id = new.user_id
      and s.id <> new.id
      and tstzrange(s.started_at, coalesce(s.ended_at, 'infinity'::timestamptz), '[)')
          && tstzrange(new.started_at, coalesce(new.ended_at, 'infinity'::timestamptz), '[)')
  ) then
    raise exception 'mission_sessions_no_overlap: this period overlaps another session'
      using errcode = '23P01', constraint = 'mission_sessions_no_overlap';
  end if;

  return new;
end;
$$;

comment on function public.enforce_mission_session() is
  'Sessions: no overlap, active mission only, never in the future, never moved between missions.';

-- INSERT and UPDATE, FOR EACH ROW: an update that stretches an existing
-- session over another is the same violation as inserting one, and a
-- statement-level trigger would let a multi-row update past.
create trigger mission_sessions_enforce
  before insert or update on public.mission_sessions
  for each row
  execute function public.enforce_mission_session();

-- ===========================================================================
-- Stopping the timer
-- ===========================================================================
--
-- An RPC rather than an update from the application, so that the end is stamped
-- by the same clock that stamped the start. SECURITY INVOKER: row level
-- security applies, and the caller can only ever stop their own session.

create or replace function public.stop_mission_session(
  p_session_id uuid,
  p_note text default null
)
returns public.mission_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.mission_sessions;
begin
  update public.mission_sessions
     set ended_at = now(),
         note = coalesce(nullif(btrim(p_note), ''), note)
   where id = p_session_id
     and user_id = (select auth.uid())
     and ended_at is null
  returning * into v_session;

  if not found then
    perform public.raise_not_found('Sessao em andamento nao encontrada.');
  end if;

  return v_session;
end;
$$;

comment on function public.stop_mission_session(uuid, text) is
  'Ends the caller''s running session at the database''s now(), optionally recording a note.';

-- ===========================================================================
-- Row level security
-- ===========================================================================

alter table public.mission_sessions enable row level security;

create policy "mission_sessions_select_own" on public.mission_sessions
  for select
  using (user_id = (select auth.uid()));

create policy "mission_sessions_insert_own" on public.mission_sessions
  for insert
  with check (user_id = (select auth.uid()));

create policy "mission_sessions_update_own" on public.mission_sessions
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Sessions are an input metric and a variable, not part of the integrity
-- record, so the owner may delete one — which is how a forgotten timer is
-- discarded.
create policy "mission_sessions_delete_own" on public.mission_sessions
  for delete
  using (user_id = (select auth.uid()));
