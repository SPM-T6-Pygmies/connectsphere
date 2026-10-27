-- Venue hold manual tests (docs/testing/VENUE_HOLD_MANUAL_TESTS.md): two Tentative Holds at Main
-- Hall, three weeks from today, Singapore time.
--
--   07:00-12:00  expired an hour ago      -- must not block (TC-VHOLD-004)
--   14:00-18:00  expires in thirty days   -- must block    (TC-VHOLD-004, TC-VHOLD-012)
--
-- Main Hall has 30 minutes' setup and 45 minutes' turnaround (SPM-23), so the live hold keeps the
-- room from 13:30 to 18:45 (SPM-19). A request for 07:00-12:00 that day, padded to 06:30-12:45,
-- clears it.
--
-- Venue Staff place holds from the decision page (SPM-218), and an expiry is always 72
-- hours from placement, so to have one already expired, or expiring on a chosen day,
-- they are inserted here. The holds belong to their own event, "Holds Test Event".
-- Run after supabase db reset and seed-venues:
--
--   supabase db query --file scripts/seed-booking-holds/seed.sql --local
--
-- Re-running replaces the two holds, with expiries and the date measured from today again.
-- Undo with teardown.sql in this directory.

do $$
declare
  v_day date := (now() at time zone 'Asia/Singapore')::date + 21;
  v_venue bigint := (select venue_id from public.venue where location = 'Main Hall');
  v_staff bigint := (
    select ua.user_account_id
    from public.user_account ua
    join auth.users u on u.id = ua.auth_user_id
    where u.email = 'venue@test.com'
  );
  v_coordinator bigint := (
    select user_account_id from public.user_account
    where name = 'Test Coordinator' and client_organisation_id is null
  );
  v_organiser bigint;
  v_organisation bigint;
  v_event bigint;
  v_hold bigint;
begin
  select user_account_id, client_organisation_id into v_organiser, v_organisation
    from public.user_account where name = 'Test Organiser';

  if v_venue is null then
    raise exception 'Main Hall is missing' using hint = 'Run seed-venues first.';
  end if;
  if v_staff is null or v_coordinator is null or v_organiser is null then
    raise exception 'The test accounts are missing' using hint = 'Run supabase db reset first.';
  end if;

  -- The event the holds hang from; earlier runs' holds go with it.
  delete from public.event
  where name = 'Holds Test Event' and client_organisation_id = v_organisation;

  insert into public.event (
    name, preferred_date, status, assigned_coordinator_user_account_id,
    owning_organiser_user_account_id, client_organisation_id
  )
  values ('Holds Test Event', v_day, 'Planning', v_coordinator, v_organiser, v_organisation)
  returning event_id into v_event;

  insert into public.booking
    (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status, hold_expires_at)
  values (v_venue, v_event, v_staff, v_staff, 'Tentative Hold', now() - interval '1 hour')
  returning booking_id into v_hold;
  -- 07:00-12:00, as 15-minute codes 28-47 (SPM-324).
  insert into public.booking_slot (booking_id, slot_date, slot)
  select v_hold, v_day, n::text from generate_series(28, 47) n;

  insert into public.booking
    (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status, hold_expires_at)
  values (v_venue, v_event, v_staff, v_staff, 'Tentative Hold', now() + interval '30 days')
  returning booking_id into v_hold;
  -- 14:00-18:00, as 15-minute codes 56-71 (SPM-324).
  insert into public.booking_slot (booking_id, slot_date, slot)
  select v_hold, v_day, n::text from generate_series(56, 71) n;
end $$;
