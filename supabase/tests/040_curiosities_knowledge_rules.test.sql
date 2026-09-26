-- RULE-007, the knowledge graph, and the rules registry.
--
-- RULE-007 is what makes the parking lot trustworthy. If a curiosity could
-- become the active mission the moment it was promoted, capturing an idea would
-- be indistinguishable from switching to it, and the user would learn not to
-- capture.

\i supabase/tests/helpers.sql

select tests.logout();
select tests.create_user('curiosities-a@continuum.test') as id \gset user_a_

select tests.login_as(:'user_a_id');
select tests.assert_rls_applies();

-- ===========================================================================
-- Fixtures
-- ===========================================================================

insert into public.directions (user_id, title)
values (:'user_a_id', 'Direction')
returning id \gset direction_

insert into public.campaigns (user_id, direction_id, name, objective, starts_on, ends_on)
values (:'user_a_id', :'direction_id', 'Campaign', 'Objective', current_date, current_date + 90)
returning id \gset campaign_

insert into public.cycles (user_id, label, starts_on, ends_on, status)
values (:'user_a_id', 'September', current_date, current_date + 30, 'active')
returning id \gset cycle_

-- ===========================================================================
-- Capture must be cheap
-- ===========================================================================
--
-- Only a title. If capture demanded an area, a potential and a rationale, it
-- would not happen at the moment the idea appears, which is the only moment
-- that matters.

select tests.assert_allowed(
  format(
    'insert into public.curiosities (user_id, title) values (%L, %L)',
    :'user_a_id', 'Wireless security'
  ),
  'a curiosity can be captured with nothing but a title'
);

do $$
begin
  perform tests.assert_equals(
    (select state from public.curiosities where title = 'Wireless security'),
    'captured'::text,
    'a new curiosity starts in the captured state'
  );
end;
$$;

select tests.assert_refused(
  format('insert into public.curiosities (user_id, title) values (%L, ''  '')', :'user_a_id'),
  'a curiosity still needs an actual title',
  'curiosities_title_not_blank'
);

select tests.assert_refused(
  format(
    'insert into public.curiosities (user_id, title, state) values (%L, %L, ''urgent'')',
    :'user_a_id', 'Bogus state'
  ),
  'a curiosity state outside the allowed set is refused',
  'curiosities_state_valid'
);

-- ===========================================================================
-- RULE-007 — promotion produces a draft, never an active mission
-- ===========================================================================

select id from public.curiosities where title = 'Wireless security' \gset curiosity_

select tests.assert_allowed(
  format(
    'select public.promote_curiosity_to_mission(%L, %L, %L, %L, 1440, 1800)',
    :'curiosity_id', :'campaign_id',
    'Wireless security', 'Promoted from the parking lot at a cycle boundary'
  ),
  'a curiosity can be promoted'
);

do $$
begin
  -- The heart of the rule.
  perform tests.assert_equals(
    (select status from public.missions where title = 'Wireless security'),
    'draft'::text,
    'promotion produces a DRAFT mission, never an active one'
  );

  perform tests.assert_equals(
    (select state from public.curiosities where title = 'Wireless security'),
    'chosen'::text,
    'the curiosity is marked chosen once promoted'
  );

  perform tests.assert(
    (select promoted_mission_id is not null from public.curiosities
      where title = 'Wireless security'),
    'the curiosity records which mission it became'
  );

  perform tests.assert_equals(
    (select count(*)::int from public.missions where status = 'active'),
    0,
    'promoting a curiosity did not activate anything'
  );
end;
$$;

-- RULE-007 rests on the shape of the function, not on a runtime check: there is
-- no status argument, so an active mission cannot be requested, and no cycle
-- argument, so the boundary cannot be routed around by naming a different one.
--
-- Asserted against the catalogue rather than by calling a signature that does
-- not exist. Calling it would raise "function does not exist", which the
-- helpers correctly classify as a broken statement rather than a refusal — a
-- test that passes because its own SQL is wrong proves nothing.
do $$
begin
  perform tests.assert_equals(
    (
      select count(*)::int
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'promote_curiosity_to_mission'
    ),
    1,
    'promote_curiosity_to_mission has exactly one overload'
  );

  perform tests.assert(
    not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join unnest(coalesce(p.proargnames, array[]::text[])) as arg
      where n.nspname = 'public'
        and p.proname = 'promote_curiosity_to_mission'
        and (arg ilike '%status%' or arg ilike '%cycle%')
    ),
    'promotion accepts no status and no cycle argument, so neither can be smuggled in'
  );
end;
$$;

-- ===========================================================================
-- RULE-007 — the cycle-boundary window
-- ===========================================================================
--
-- The boundary is derived from state the schema already carries: the currently
-- active cycle, open from the moment it starts until its first mission is
-- activated. A draft sitting in the cycle does not close the window.

insert into public.curiosities (user_id, title)
values (:'user_a_id', 'Homomorphic encryption')
returning id \gset boundary_curiosity_

select tests.assert_allowed(
  format(
    'select public.promote_curiosity_to_mission(%L, %L, %L, %L, 600, 900)',
    :'boundary_curiosity_id', :'campaign_id',
    'Homomorphic encryption', 'A second draft, still before any activation this cycle'
  ),
  'a draft mission already in the cycle does not close the promotion window'
);

-- Activating a mission in the cycle closes the window. Activation itself
-- needs a Definition of Done first.
select id from public.missions where title = 'Wireless security' \gset first_mission_

insert into public.mission_dod_criteria (user_id, mission_id, description)
values (:'user_a_id', :'first_mission_id', 'Some observable result');

update public.missions set status = 'active' where id = :'first_mission_id';

insert into public.curiosities (user_id, title)
values (:'user_a_id', 'Post-quantum signatures')
returning id \gset late_curiosity_

select tests.assert_refused(
  format(
    'select public.promote_curiosity_to_mission(%L, %L, %L, %L, 600, 900)',
    :'late_curiosity_id', :'campaign_id',
    'Post-quantum signatures', 'Too late: the cycle already has an activated mission'
  ),
  'promotion is refused once the active cycle has an activated mission',
  'RULE-007'
);

do $$
begin
  perform tests.assert_equals(
    (select state from public.curiosities where title = 'Post-quantum signatures'),
    'captured'::text,
    'a refused promotion leaves the curiosity captured, not chosen'
  );
end;
$$;

-- A curiosity already chosen cannot be promoted a second time.
select tests.assert_refused(
  format(
    'select public.promote_curiosity_to_mission(%L, %L, %L, %L, 600, 900)',
    :'curiosity_id', :'campaign_id',
    'Wireless security', 'Promoting an already-promoted curiosity again'
  ),
  'an already-chosen curiosity cannot be promoted again',
  'RULE-007'
);

-- With no active cycle at all, promotion has nothing to target.
select tests.logout();
select tests.create_user('curiosities-b@continuum.test') as id \gset user_b_
select tests.login_as(:'user_b_id');

insert into public.curiosities (user_id, title)
values (:'user_b_id', 'No cycle yet')
returning id \gset no_cycle_curiosity_

insert into public.directions (user_id, title)
values (:'user_b_id', 'Direction B')
returning id \gset direction_b_

insert into public.campaigns (user_id, direction_id, name, objective, starts_on, ends_on)
values (:'user_b_id', :'direction_b_id', 'Campaign B', 'Objective', current_date, current_date + 90)
returning id \gset campaign_b_

select tests.assert_refused(
  format(
    'select public.promote_curiosity_to_mission(%L, %L, %L, %L, 600, 900)',
    :'no_cycle_curiosity_id', :'campaign_b_id',
    'No cycle yet', 'Nothing to promote into'
  ),
  'promotion is refused with no active cycle at all',
  'RULE-007'
);

select tests.login_as(:'user_a_id');

-- ===========================================================================
-- Knowledge notes and links
-- ===========================================================================

insert into public.knowledge_notes (user_id, title, content, note_type)
values (:'user_a_id', 'WPA handshake', 'What the four-way handshake actually proves', 'concept')
returning id \gset note_a_

insert into public.knowledge_notes (user_id, title, content, note_type)
values (:'user_a_id', 'PMKID capture', 'Why it does not need a client', 'discovery')
returning id \gset note_b_

select tests.assert_allowed(
  format(
    'insert into public.knowledge_links (user_id, from_note_id, to_note_id, relation)
       values (%L, %L, %L, ''relates_to'')',
    :'user_a_id', :'note_a_id', :'note_b_id'
  ),
  'two notes can be linked'
);

select tests.assert_refused(
  format(
    'insert into public.knowledge_links (user_id, from_note_id, to_note_id, relation)
       values (%L, %L, %L, ''relates_to'')',
    :'user_a_id', :'note_a_id', :'note_b_id'
  ),
  'the same link cannot be recorded twice',
  '23505'
);

select tests.assert_refused(
  format(
    'insert into public.knowledge_links (user_id, from_note_id, to_note_id)
       values (%L, %L, %L)',
    :'user_a_id', :'note_a_id', :'note_a_id'
  ),
  'a note cannot link to itself',
  'knowledge_links_no_self_link'
);

select tests.assert_refused(
  format(
    'insert into public.knowledge_notes (user_id, title, content, note_type)
       values (%L, %L, %L, ''brilliant'')',
    :'user_a_id', 'Bad type', 'content'
  ),
  'an unknown note type is refused',
  'knowledge_notes_type_valid'
);

-- ===========================================================================
-- The rules registry is readable and not writable
-- ===========================================================================
--
-- The Rules page must describe what the database enforces. If the application
-- could edit the registry, the page could claim a protection that does not
-- exist.

do $$
begin
  -- Eleven since M11, which added RULE-008 in its own migration.
  perform tests.assert_equals(
    (select count(*)::int from public.rules),
    11,
    'the rules registry is readable and fully seeded'
  );
  perform tests.assert_equals(
    (select count(*)::int from public.rules where enforcement = 'HARD'),
    8,
    'eight rules are enforced by the database'
  );
  perform tests.assert(
    exists (select 1 from public.rules
             where code = 'RULE-008' and enforcement = 'HARD' and active),
    'RULE-008 is seeded as an active hard rule'
  );
end;
$$;

select tests.assert_no_rows_affected(
  'update public.rules set enforcement = ''ADVISORY'' where code = ''RULE-001''',
  'a hard rule cannot be downgraded from the application'
);

select tests.assert_refused(
  'insert into public.rules (code, severity, enforcement) values (''RULE-999'', ''low'', ''ADVISORY'')',
  'new rules cannot be invented from the application',
  '42501'
);

select tests.assert_no_rows_affected(
  'delete from public.rules where code = ''RULE-001''',
  'a rule cannot be deleted from the application'
);

do $$
begin
  perform tests.assert_equals(
    (select enforcement from public.rules where code = 'RULE-001'),
    'HARD'::text,
    'RULE-001 is still HARD after the downgrade attempt'
  );
end;
$$;

select tests.logout();
