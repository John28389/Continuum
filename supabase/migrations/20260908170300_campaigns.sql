-- Campaign: an objective of roughly three months, sitting under a direction
-- and connecting the monthly missions that pursue it.

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  direction_id uuid not null,
  name text not null,
  objective text not null,
  description text,
  success_criteria text,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint campaigns_name_not_blank
    check (length(btrim(name)) > 0),

  constraint campaigns_objective_not_blank
    check (length(btrim(objective)) > 0),

  constraint campaigns_status_valid
    check (status in ('planned', 'active', 'completed', 'archived')),

  constraint campaigns_period_coherent
    check (ends_on > starts_on),

  -- Composite foreign key rather than a plain one: it makes attaching a
  -- campaign to another user's direction impossible at the schema level,
  -- rather than relying on the application to check ownership.
  constraint campaigns_direction_same_owner
    foreign key (direction_id, user_id)
    references public.directions (id, user_id)
    on delete restrict,

  constraint campaigns_id_user_unique unique (id, user_id)
);

comment on table public.campaigns is
  'Medium-horizon objective under a direction. Connects the monthly missions.';

create index campaigns_user_id_idx on public.campaigns (user_id);
create index campaigns_direction_id_idx on public.campaigns (direction_id);
create index campaigns_user_status_idx on public.campaigns (user_id, status);

create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.campaigns enable row level security;

create policy "campaigns_select_own" on public.campaigns
  for select
  using (user_id = (select auth.uid()));

create policy "campaigns_insert_own" on public.campaigns
  for insert
  with check (user_id = (select auth.uid()));

create policy "campaigns_update_own" on public.campaigns
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "campaigns_delete_own" on public.campaigns
  for delete
  using (user_id = (select auth.uid()));
