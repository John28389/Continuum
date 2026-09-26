-- Direction: the multi-month strategic vector everything else hangs from.
--
-- A direction deliberately outlives individual campaigns and missions. Its
-- purpose is to stop the whole plan being re-pointed every time something new
-- looks interesting, so it is changed rarely and on purpose.

create table public.directions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  statement text,
  status text not null default 'active',
  started_on date not null default current_date,
  ended_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint directions_title_not_blank
    check (length(btrim(title)) > 0),

  constraint directions_status_valid
    check (status in ('active', 'archived')),

  constraint directions_period_coherent
    check (ended_on is null or ended_on >= started_on),

  -- Lets child tables carry a composite foreign key on (id, user_id), which is
  -- what stops a campaign being attached to another user's direction.
  constraint directions_id_user_unique unique (id, user_id)
);

comment on table public.directions is
  'Multi-month strategic vector. Changed rarely and deliberately.';

create index directions_user_id_idx on public.directions (user_id);
create index directions_user_status_idx on public.directions (user_id, status);

create trigger directions_set_updated_at
  before update on public.directions
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.directions enable row level security;

create policy "directions_select_own" on public.directions
  for select
  using (user_id = (select auth.uid()));

create policy "directions_insert_own" on public.directions
  for insert
  with check (user_id = (select auth.uid()));

create policy "directions_update_own" on public.directions
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "directions_delete_own" on public.directions
  for delete
  using (user_id = (select auth.uid()));
