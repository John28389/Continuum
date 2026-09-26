-- Owner profile, extending auth.users with application-level preferences.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Application profile for an authenticated user. The row is created by the '
  'application on first sign-in, as the user, so that no privileged database '
  'function is needed to write it.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
--
-- A profile is scoped by its own primary key rather than a user_id column,
-- because it is one-to-one with auth.users.
--
-- Note the deliberate absence of a delete policy: a profile is removed only by
-- the cascade from auth.users. There is no in-application path to delete it.

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select
  using (id = (select auth.uid()));

create policy "profiles_insert_own" on public.profiles
  for insert
  with check (id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
