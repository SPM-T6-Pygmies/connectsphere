-- Seeds real data for the coordinator's "assigned to me" queue and detail
-- view (SPM-121, SPM-32), mirroring the shape of
-- src/adapters/outbound/in-memory/organiser-demo-seed.ts against an actual
-- Postgres database -- for exercising the Supabase adapters, which the
-- in-memory demo seed never touches.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-data/seed.sql --local
--
-- Run against the linked remote project:
--   supabase db query --file scripts/seed-data/seed.sql --linked
--
-- Safe to run more than once: every insert is guarded by an existence check,
-- so re-running finds everything already there and changes nothing.
--
-- Two client organisations (Sunrise Events Co, Harbour Logistics), three
-- Event Organisers (Alice, Ben in Sunrise; Cara in Harbour), and two Event
-- Coordinators (Nadia, Omar -- coordinators have no client organisation of
-- their own). Nadia is assigned a request in each organisation plus one
-- that has moved past Under Review, so the queue (Under Review + Returned
-- only) and the detail view (any status, by assignment) can both be
-- exercised; Omar holds a decoy request that must never appear in Nadia's
-- queue or be reachable by Nadia via direct id (#91).
--
-- Also seeds the one Event Operations Manager, Venue Staff and Technical
-- Support Staff profile each of the other staff wireframes act as (Daniel,
-- Mei, Ravi in src/lib/wireframe/fixtures.ts) -- profiles only, since those
-- pages have no real use case/adapter of their own yet to hold event,
-- booking or equipment rows against.

do $$
declare
  v_sunrise bigint;
  v_harbour bigint;
  v_alice   bigint;
  v_ben     bigint;
  v_cara    bigint;
  v_nadia   bigint;
  v_omar    bigint;
  v_daniel  bigint;
  v_mei     bigint;
  v_ravi    bigint;
  v_organiser_role_id  bigint;
  v_coordinator_role_id bigint;
  v_ops_role_id        bigint;
  v_venue_role_id      bigint;
  v_technical_role_id  bigint;
begin
  -- 1. Client organisations -----------------------------------------------
  select client_organisation_id into v_sunrise
    from public.client_organisation where name = 'Sunrise Events Co';
  if v_sunrise is null then
    insert into public.client_organisation (name) values ('Sunrise Events Co')
      returning client_organisation_id into v_sunrise;
  end if;

  select client_organisation_id into v_harbour
    from public.client_organisation where name = 'Harbour Logistics';
  if v_harbour is null then
    insert into public.client_organisation (name) values ('Harbour Logistics')
      returning client_organisation_id into v_harbour;
  end if;

  -- 2. User accounts --------------------------------------------------------
  select user_account_id into v_alice
    from public.user_account where name = 'Alice' and client_organisation_id = v_sunrise;
  if v_alice is null then
    insert into public.user_account (name, client_organisation_id) values ('Alice', v_sunrise)
      returning user_account_id into v_alice;
  end if;

  select user_account_id into v_ben
    from public.user_account where name = 'Ben' and client_organisation_id = v_sunrise;
  if v_ben is null then
    insert into public.user_account (name, client_organisation_id) values ('Ben', v_sunrise)
      returning user_account_id into v_ben;
  end if;

  select user_account_id into v_cara
    from public.user_account where name = 'Cara' and client_organisation_id = v_harbour;
  if v_cara is null then
    insert into public.user_account (name, client_organisation_id) values ('Cara', v_harbour)
      returning user_account_id into v_cara;
  end if;

  select user_account_id into v_nadia
    from public.user_account where name = 'Nadia' and client_organisation_id is null;
  if v_nadia is null then
    insert into public.user_account (name, client_organisation_id) values ('Nadia', null)
      returning user_account_id into v_nadia;
  end if;

  select user_account_id into v_omar
    from public.user_account where name = 'Omar' and client_organisation_id is null;
  if v_omar is null then
    insert into public.user_account (name, client_organisation_id) values ('Omar', null)
      returning user_account_id into v_omar;
  end if;

  select user_account_id into v_daniel
    from public.user_account where name = 'Daniel Okonkwo' and client_organisation_id is null;
  if v_daniel is null then
    insert into public.user_account (name, department, client_organisation_id)
      values ('Daniel Okonkwo', 'Event Operations', null)
      returning user_account_id into v_daniel;
  end if;

  select user_account_id into v_mei
    from public.user_account where name = 'Mei Chen' and client_organisation_id is null;
  if v_mei is null then
    insert into public.user_account (name, department, client_organisation_id)
      values ('Mei Chen', 'Venue Operations', null)
      returning user_account_id into v_mei;
  end if;

  select user_account_id into v_ravi
    from public.user_account where name = 'Ravi Kulkarni' and client_organisation_id is null;
  if v_ravi is null then
    insert into public.user_account (name, department, client_organisation_id)
      values ('Ravi Kulkarni', 'Technical Support', null)
      returning user_account_id into v_ravi;
  end if;

  -- 3. Roles ------------------------------------------------------------
  select role_id into v_organiser_role_id from public.role where role_name = 'Event Organiser';
  select role_id into v_coordinator_role_id from public.role where role_name = 'Event Coordinator';
  select role_id into v_ops_role_id from public.role where role_name = 'Event Operations Manager';
  select role_id into v_venue_role_id from public.role where role_name = 'Venue Staff';
  select role_id into v_technical_role_id from public.role where role_name = 'Technical Support Staff';

  insert into public.user_account_role (user_account_id, role_id)
  select v.user_account_id, v_organiser_role_id
  from unnest(array[v_alice, v_ben, v_cara]) as v(user_account_id)
  on conflict do nothing;

  insert into public.user_account_role (user_account_id, role_id)
  select v.user_account_id, v_coordinator_role_id
  from unnest(array[v_nadia, v_omar]) as v(user_account_id)
  on conflict do nothing;

  insert into public.user_account_role (user_account_id, role_id)
  values
    (v_daniel, v_ops_role_id),
    (v_mei, v_venue_role_id),
    (v_ravi, v_technical_role_id)
  on conflict do nothing;

  -- 4. Event requests -------------------------------------------------------
  -- Not assigned to a coordinator yet (SPM-97 doesn't exist): the everyday
  -- pre-review lifecycle.
  insert into public.event_request (
    event_name, preferred_date, preferred_start_time, preferred_end_time,
    expected_attendance, status, requesting_user_account_id, client_organisation_id
  )
  select 'Founders'' Day Celebration', date '2026-11-04', timestamptz '2026-11-04 09:00+08',
    timestamptz '2026-11-04 17:00+08', 150, 'Draft', v_alice, v_sunrise
  where not exists (
    select 1 from public.event_request
    where event_name = 'Founders'' Day Celebration' and requesting_user_account_id = v_alice
  );

  insert into public.event_request (
    event_name, preferred_date, preferred_start_time, preferred_end_time,
    expected_attendance, status, requesting_user_account_id, client_organisation_id
  )
  select 'Quarterly Partner Forum', date '2026-11-18', timestamptz '2026-11-18 09:00+08',
    timestamptz '2026-11-18 12:00+08', 80, 'Submitted', v_ben, v_sunrise
  where not exists (
    select 1 from public.event_request
    where event_name = 'Quarterly Partner Forum' and requesting_user_account_id = v_ben
  );

  insert into public.event_request (
    event_name, preferred_date, preferred_start_time, preferred_end_time,
    expected_attendance, status, requesting_user_account_id, client_organisation_id
  )
  select 'Annual General Meeting', date '2026-12-02', timestamptz '2026-12-02 09:00+08',
    timestamptz '2026-12-02 11:00+08', 200, 'Draft', v_cara, v_harbour
  where not exists (
    select 1 from public.event_request
    where event_name = 'Annual General Meeting' and requesting_user_account_id = v_cara
  );

  -- Assigned to Nadia (SPM-121/SPM-32): spans both client organisations, so
  -- the queue can show a per-row organisation name.
  insert into public.event_request (
    event_name, description, purpose, preferred_date, preferred_start_time,
    preferred_end_time, expected_attendance, venue_requirements,
    accessibility_needs, equipment_requirements, status,
    requesting_user_account_id, assigned_coordinator_user_account_id, client_organisation_id
  )
  select 'Venue Safety Review', 'A walkthrough of fire exits, capacity limits and accessible routes.',
    'Annual compliance check ahead of the winter events season.', date '2026-10-14',
    timestamptz '2026-10-14 09:00+08', timestamptz '2026-10-14 11:00+08', 12,
    'Access to every fire exit and the main hall.', 'Step-free access required for two attendees.',
    null, 'Under Review', v_ben, v_nadia, v_sunrise
  where not exists (
    select 1 from public.event_request
    where event_name = 'Venue Safety Review' and requesting_user_account_id = v_ben
  );

  insert into public.event_request (
    event_name, description, purpose, preferred_date, preferred_start_time,
    preferred_end_time, expected_attendance, equipment_requirements,
    registration_requirements, status, requesting_user_account_id,
    assigned_coordinator_user_account_id, client_organisation_id
  )
  select 'Harbour Logistics Conference', 'A day of talks and workshops for the logistics team.',
    'Kick off next year''s operations roadmap.', date '2026-11-25', timestamptz '2026-11-25 09:00+08',
    timestamptz '2026-11-25 18:00+08', 300, 'Projector, stage microphones, livestream setup.',
    'Attendees must register in advance; no walk-ins.', 'Under Review', v_cara, v_nadia, v_harbour
  where not exists (
    select 1 from public.event_request
    where event_name = 'Harbour Logistics Conference' and requesting_user_account_id = v_cara
  );

  insert into public.event_request (
    event_name, description, purpose, preferred_date, preferred_start_time,
    preferred_end_time, expected_attendance, venue_requirements, status,
    requesting_user_account_id, assigned_coordinator_user_account_id, client_organisation_id
  )
  select 'Vendor Appreciation Day', 'An informal thank-you event for this year''s vendors.',
    'Strengthen vendor relationships ahead of contract renewals.', date '2026-11-06',
    timestamptz '2026-11-06 17:00+08', timestamptz '2026-11-06 20:00+08', 60,
    'Outdoor courtyard with a covered fallback.', 'Returned', v_alice, v_nadia, v_sunrise
  where not exists (
    select 1 from public.event_request
    where event_name = 'Vendor Appreciation Day' and requesting_user_account_id = v_alice
  );

  -- Approved: frozen and still reachable by direct id (SPM-32), but excluded
  -- from the queue (SPM-121) -- it has become an Event, a separate,
  -- backlog-scoped view.
  insert into public.event_request (
    event_name, description, purpose, preferred_date, preferred_start_time,
    preferred_end_time, expected_attendance, status,
    requesting_user_account_id, assigned_coordinator_user_account_id, client_organisation_id
  )
  select 'Founders'' Gala Dinner', 'A formal dinner marking the company''s founding.',
    'Celebrate the year''s milestones with clients and staff.', date '2026-12-12',
    timestamptz '2026-12-12 19:00+08', timestamptz '2026-12-12 23:00+08', 220,
    'Approved', v_alice, v_nadia, v_sunrise
  where not exists (
    select 1 from public.event_request
    where event_name = 'Founders'' Gala Dinner' and requesting_user_account_id = v_alice
  );

  -- Assigned to Omar, not Nadia: must never appear in Nadia's queue or be
  -- reachable by Nadia via direct id (#91).
  insert into public.event_request (
    event_name, preferred_date, preferred_start_time, preferred_end_time,
    expected_attendance, status, requesting_user_account_id,
    assigned_coordinator_user_account_id, client_organisation_id
  )
  select 'Quarterly Townhall', date '2026-10-30', timestamptz '2026-10-30 09:00+08',
    timestamptz '2026-10-30 10:30+08', 400, 'Under Review', v_ben, v_omar, v_sunrise
  where not exists (
    select 1 from public.event_request
    where event_name = 'Quarterly Townhall' and requesting_user_account_id = v_ben
  );
end;
$$;
