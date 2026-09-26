-- Cycle: the monthly execution window.
--
-- The cycle boundary is what makes several other rules possible. A mission may
-- only be activated inside the active cycle (RULE-005), which is what stops
-- next month's mission being chosen while this month's is still running, and
-- what keeps a parked curiosity from becoming the active mission mid-cycle.

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'planned',
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cycles_label_not_blank
    check (length(btrim(label)) > 0),

  constraint cycles_status_valid
    check (status in ('planned', 'active', 'closed')),

  constraint cycles_period_coherent
    check (ends_on > starts_on),

  constraint cycles_closed_at_consistent
    check ((status = 'closed') = (closed_at is not null)),

  constraint cycles_id_user_unique unique (id, user_id)
);

comment on table public.cycles is
  'Monthly execution window. At most one cycle per user is active at a time.';

create index cycles_user_id_idx on public.cycles (user_id);
create index cycles_user_status_idx on public.cycles (user_id, status);

-- One active cycle per user.
--
-- A partial unique index rather than a trigger: it is enforced by the storage
-- layer itself, so it holds under concurrency and cannot be sidestepped by any
-- write path, including a direct SQL session.
create unique index cycles_one_active_per_user
  on public.cycles (user_id)
  where status = 'active';

comment on index public.cycles_one_active_per_user is
  'Supports RULE-005: exactly one cycle may be active per user at a time.';

create trigger cycles_set_updated_at
  before update on public.cycles
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.cycles enable row level security;

create policy "cycles_select_own" on public.cycles
  for select
  using (user_id = (select auth.uid()));

create policy "cycles_insert_own" on public.cycles
  for insert
  with check (user_id = (select auth.uid()));

create policy "cycles_update_own" on public.cycles
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "cycles_delete_own" on public.cycles
  for delete
  using (user_id = (select auth.uid()));
