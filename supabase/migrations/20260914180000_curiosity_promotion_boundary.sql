-- RULE-007's cycle-boundary condition for curiosity promotion (M12).
--
-- The rule's own rationale already said this: "the parking lot keeps them out
-- of the active line until a cycle boundary makes evaluation appropriate."
-- Until now nothing enforced the boundary part -- promotion accepted any
-- p_cycle_id at all, with no check on timing.
--
-- Definition, decided with the owner: a curiosity may be promoted into a
-- draft mission only for the currently active cycle, and only while that
-- cycle has not yet had a mission activated in it. The first activation in
-- the cycle closes the window until the next one. Draft missions already
-- sitting in the cycle do not close it -- only an activation does. This is
-- derived entirely from state that already exists (cycles.status and
-- missions.activated_at), so no new column, flag or constant is needed.
--
-- The cycle is no longer a caller-supplied parameter. Accepting one would
-- turn the boundary into something a caller could simply route around by
-- naming a different cycle, the same reason the function accepts no status.
--
-- `create or replace` cannot change a function's argument list -- Postgres
-- would keep the old seven-argument overload alongside this one rather than
-- replacing it. The old signature is dropped explicitly first.
drop function if exists public.promote_curiosity_to_mission(uuid, uuid, uuid, text, text, integer, integer);

create or replace function public.promote_curiosity_to_mission(
  p_curiosity_id uuid,
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
  v_active_cycle_id uuid;
begin
  select * into v_curiosity
  from public.curiosities
  where id = p_curiosity_id
    and user_id = v_user_id;

  if not found then
    perform public.raise_not_found('Curiosidade nao encontrada.');
  end if;

  -- A curiosity already chosen or archived cannot be promoted again. Without
  -- this a direct second call would silently overwrite promoted_mission_id,
  -- orphaning the first mission's back-reference and creating a second draft
  -- from the same idea.
  if v_curiosity.state in ('chosen', 'archived') then
    perform public.raise_rule_violation(
      'RULE-007',
      'Esta curiosidade ja foi arquivada ou promovida e nao pode ser promovida novamente.'
    );
  end if;

  select c.id
    into v_active_cycle_id
  from public.cycles c
  where c.user_id = v_user_id
    and c.status = 'active';

  if v_active_cycle_id is null then
    perform public.raise_rule_violation(
      'RULE-007',
      'Nao existe ciclo ativo. Uma curiosidade so pode ser promovida dentro do ciclo ativo.'
    );
  end if;

  -- The cycle boundary. Checked against activated_at, which is set once at
  -- activation and never cleared, so a mission that later completed, was
  -- revised or was abandoned still correctly closes the window it opened.
  if exists (
    select 1
    from public.missions m
    where m.cycle_id = v_active_cycle_id
      and m.user_id = v_user_id
      and m.activated_at is not null
  ) then
    perform public.raise_rule_violation(
      'RULE-007',
      'A janela de promocao deste ciclo ja fechou: uma missao ja foi ativada nele. Aguarde o proximo ciclo.'
    );
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
    v_active_cycle_id,
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
  'RULE-007: promotes a curiosity into a DRAFT mission, for the active cycle only, and only before that cycle''s first mission activation. Accepts no status and no cycle argument, by design.';
