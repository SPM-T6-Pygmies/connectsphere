-- SPM-46 / SPM-22 manual tests: two Tentative Holds at Main Hall, three weeks from today, Singapore time.
--
--   AM  expired an hour ago      -- must not block (TC-VENUE-BOOK-019)
--   PM  expires in thirty days   -- must block    (TC-VENUE-BOOK-020)
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
  insert into public.booking_slot (booking_id, slot_date, slot) values (v_hold, v_day, 'AM');

  insert into public.booking
    (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status, hold_expires_at)
  values (v_venue, v_event, v_staff, v_staff, 'Tentative Hold', now() + interval '30 days')
  returning booking_id into v_hold;
  insert into public.booking_slot (booking_id, slot_date, slot) values (v_hold, v_day, 'PM');
end $$;
