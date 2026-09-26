-- Leaving an active mission: the two doors RULE-004 did not cover.
--
-- Found in M15 by probing, while the history was being designed; see
-- docs/decisions.md. Tested by supabase/tests/080_mission_exit_and_deletion.test.sql.
--
-- 1. active -> draft. enforce_mission_exit_review() demanded a review only for
--    an arrival in 'revised' or 'abandoned', so a direct UPDATE back to 'draft'
--    left an active mission with no justification at all. lib/rules/transitions.ts
--    has always said active leads only to completed, revised or abandoned; the
--    database now says the same.
--
-- 2. DELETE. missions_delete_own (M3) allowed deleting any mission. Deleting an
--    active mission is leaving it without a review, and deleting a finished one
--    removes it from the record — and its mission_reviews row with it, by
--    cascade. Only a draft may be deleted now: it was never committed to, which
--    is the same reason dropping a draft needs no review.

-- ===========================================================================
-- RULE-004, extended to every way out of active
-- ===========================================================================

create or replace function public.enforce_mission_exit_review()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'active' then
    return new;
  end if;

  -- Staying active, or finishing: completion is RULE-008's business.
  if new.status in ('active', 'completed') then
    return new;
  end if;

  -- Any other destination — in practice, back to draft — is not a way out at
  -- all. Refused outright: no review can authorise it, because a review's
  -- outcomes are kept, revised and abandoned.
  if new.status not in ('revised', 'abandoned') then
    perform public.raise_rule_violation(
      'RULE-004',
      'Uma missao ativa so sai do estado ativo concluida ou por meio de uma revisao.'
    );
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
  'RULE-004: an active mission leaves only by completion, or by a categorised justification recorded in the same transaction.';

-- ===========================================================================
-- Only a draft may be deleted
-- ===========================================================================
--
-- Row level security rather than a trigger: a policy that does not cover the
-- row hides it from the DELETE, which is exactly "this row cannot be deleted"
-- with no new function. The statement affects zero rows instead of raising;
-- that is how every refused delete in this schema behaves.

drop policy "missions_delete_own" on public.missions;

create policy "missions_delete_own_draft" on public.missions
  for delete
  using (user_id = (select auth.uid()) and status = 'draft');

comment on policy "missions_delete_own_draft" on public.missions is
  'RULE-004 and RULE-006: deleting an active mission would leave it without a review, and deleting a finished one would rewrite the record.';
