-- Seeds event requests for the real test accounts, so the screens that read
-- event requests through Supabase -- the Organiser's own and organisation
-- views (SPM-31, SPM-38, SPM-39), Operations' queue (SPM-29, SPM-130) and the
-- Coordinator's queue and detail (SPM-121, SPM-32) -- have data a signed-in
-- user can actually reach.
--
-- It creates no people. The accounts are the ones you can log in as --
-- Test Organiser and Test Organiser 2 (Event Organisers in Test Organisation)
-- and Test Coordinator -- created by the migrations and supabase/seed.sql
-- (see supabase/SEED.md). Seed those first -- `supabase db reset` does it:
-- this script stops with an error naming whichever account is missing.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-coordinator-view/seed.sql --local
--
-- Run against the linked remote project:
--   supabase db query --file scripts/seed-coordinator-view/seed.sql --linked
--
-- Safe to run more than once: every insert is guarded by an existence check,
-- so re-running finds everything already there and changes nothing. That also
-- means it never resets a request you have since decided in the app -- for
-- that, run teardown.sql first. verify.sql checks the seeded state.
--
-- Test Coordinator is assigned a request in every state the coordinator
-- screens tell apart: two Under Review, one assigned but still Submitted (a
-- request assigned by some route other than SPM-130's assignment, which moves
-- it to Under Review), one Returned and one Approved -- so the queue
-- (Submitted, Under Review and Returned) and the detail view (any status, by
-- assignment) can both be exercised. The requests are split across both
-- organisers, so the organisation-wide view (SPM-39) shows a colleague's too.
--
-- There is only one real coordinator, so no request is assigned to a
-- different one. Quarterly Partner Forum -- Submitted and unassigned -- is the
-- request Test Coordinator must get a not-found for by direct id (#91), and
-- the one Test Ops Manager has to assign.

do $$
declare
  v_organisation bigint;
  v_organiser    bigint;
  v_organiser_2  bigint;
  v_coordinator  bigint;
begin
  -- 1. The real test accounts ------------------------------------------------
  select client_organisation_id into v_organisation
    from public.client_organisation where name = 'Test Organisation';

  select user_account_id into v_organiser
    from public.user_account
    where name = 'Test Organiser' and client_organisation_id = v_organisation;

  select user_account_id into v_organiser_2
    from public.user_account
    where name = 'Test Organiser 2' and client_organisation_id = v_organisation;

  select user_account_id into v_coordinator
    from public.user_account
    where name = 'Test Coordinator' and client_organisation_id is null;

  if v_organisation is null or v_organiser is null or v_organiser_2 is null
     or v_coordinator is null then
    raise exception 'Missing test accounts: %',
      concat_ws(', ',
        case when v_organisation is null then 'Test Organisation' end,
        case when v_organiser is null then 'Test Organiser' end,
        case when v_organiser_2 is null then 'Test Organiser 2' end,
        case when v_coordinator is null then 'Test Coordinator' end)
      using hint = 'Seed the accounts first: supabase db reset locally, or supabase db query --file supabase/seed.sql --linked (supabase/SEED.md).';
  end if;

  -- 2. Event requests -------------------------------------------------------
  -- Not assigned to a coordinator: the everyday pre-review lifecycle, and the
  -- Submitted request Operations assigns from (SPM-130).
  insert into public.event_request (
    event_name, preferred_date, preferred_start_time, preferred_end_time,
    expected_attendance, status, requesting_user_account_id, client_organisation_id
  )
  select 'Founders'' Day Celebration', date '2026-11-04', timestamptz '2026-11-04 09:00+08',
    timestamptz '2026-11-04 17:00+08', 150, 'Draft', v_organiser, v_organisation
  where not exists (
    select 1 from public.event_request
    where event_name = 'Founders'' Day Celebration' and requesting_user_account_id = v_organiser
  );

  insert into public.event_request (
    event_name, preferred_date, preferred_start_time, preferred_end_time,
    expected_attendance, status, requesting_user_account_id, client_organisation_id
  )
  select 'Quarterly Partner Forum', date '2026-11-18', timestamptz '2026-11-18 09:00+08',
    timestamptz '2026-11-18 12:00+08', 80, 'Submitted', v_organiser_2, v_organisation
  where not exists (
    select 1 from public.event_request
    where event_name = 'Quarterly Partner Forum' and requesting_user_account_id = v_organiser_2
  );

  insert into public.event_request (
    event_name, preferred_date, preferred_start_time, preferred_end_time,
    expected_attendance, status, requesting_user_account_id, client_organisation_id
  )
  select 'Annual General Meeting', date '2026-12-02', timestamptz '2026-12-02 09:00+08',
    timestamptz '2026-12-02 11:00+08', 200, 'Draft', v_organiser_2, v_organisation
  where not exists (
    select 1 from public.event_request
    where event_name = 'Annual General Meeting' and requesting_user_account_id = v_organiser_2
  );

  -- Assigned to Test Coordinator (SPM-121/SPM-32), from both organisers.
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
    null, 'Under Review', v_organiser, v_coordinator, v_organisation
  where not exists (
    select 1 from public.event_request
    where event_name = 'Venue Safety Review' and requesting_user_account_id = v_organiser
  );

  -- Assigned but still Submitted: not what operations_assign_event_coordinator
  -- (SPM-130) leaves behind -- it moves a Submitted request to Under Review as
  -- it assigns -- but a request assigned by any other route can land here,
  -- and the queue must not drop it.
  insert into public.event_request (
    event_name, description, purpose, preferred_date, preferred_start_time,
    preferred_end_time, expected_attendance, venue_requirements, status,
    requesting_user_account_id, assigned_coordinator_user_account_id, client_organisation_id
  )
  select 'Winter Volunteer Briefing', 'A briefing for volunteers working the winter events season.',
    'Bring new volunteers up to speed before the season opens.', date '2026-12-09',
    timestamptz '2026-12-09 14:00+08', timestamptz '2026-12-09 16:00+08', 45,
    'A room that seats 45 with a projector.', 'Submitted', v_organiser, v_coordinator, v_organisation
  where not exists (
    select 1 from public.event_request
    where event_name = 'Winter Volunteer Briefing' and requesting_user_account_id = v_organiser
  );

  insert into public.event_request (
    event_name, description, purpose, preferred_date, preferred_start_time,
    preferred_end_time, expected_attendance, equipment_requirements,
    registration_requirements, status, requesting_user_account_id,
    assigned_coordinator_user_account_id, client_organisation_id
  )
  select 'Operations Roadmap Conference', 'A day of talks and workshops for the operations team.',
    'Kick off next year''s operations roadmap.', date '2026-11-25', timestamptz '2026-11-25 09:00+08',
    timestamptz '2026-11-25 18:00+08', 300, 'Projector, stage microphones, livestream setup.',
    'Attendees must register in advance; no walk-ins.', 'Under Review', v_organiser_2, v_coordinator,
    v_organisation
  where not exists (
    select 1 from public.event_request
    where event_name = 'Operations Roadmap Conference' and requesting_user_account_id = v_organiser_2
  );

  insert into public.event_request (
    event_name, description, purpose, preferred_date, preferred_start_time,
    preferred_end_time, expected_attendance, venue_requirements, status,
    requesting_user_account_id, assigned_coordinator_user_account_id, client_organisation_id
  )
  select 'Vendor Appreciation Day', 'An informal thank-you event for this year''s vendors.',
    'Strengthen vendor relationships ahead of contract renewals.', date '2026-11-06',
    timestamptz '2026-11-06 17:00+08', timestamptz '2026-11-06 20:00+08', 60,
    'Outdoor courtyard with a covered fallback.', 'Returned', v_organiser, v_coordinator, v_organisation
  where not exists (
    select 1 from public.event_request
    where event_name = 'Vendor Appreciation Day' and requesting_user_account_id = v_organiser
  );

  -- Approved: frozen and still reachable by direct id (SPM-32), but excluded
  -- from the queue (SPM-121) -- it has become an Event, a separate view.
  insert into public.event_request (
    event_name, description, purpose, preferred_date, preferred_start_time,
    preferred_end_time, expected_attendance, status,
    requesting_user_account_id, assigned_coordinator_user_account_id, client_organisation_id
  )
  select 'Founders'' Gala Dinner', 'A formal dinner marking the company''s founding.',
    'Celebrate the year''s milestones with clients and staff.', date '2026-12-12',
    timestamptz '2026-12-12 19:00+08', timestamptz '2026-12-12 23:00+08', 220,
    'Approved', v_organiser_2, v_coordinator, v_organisation
  where not exists (
    select 1 from public.event_request
    where event_name = 'Founders'' Gala Dinner' and requesting_user_account_id = v_organiser_2
  );
end;
$$;
