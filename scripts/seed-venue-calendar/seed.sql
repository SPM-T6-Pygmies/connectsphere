-- Venue calendar manual tests (docs/testing/VENUE_CALENDAR_MANUAL_TESTS.md): two Confirmed
-- bookings on the 15-minute grid (SPM-323).
--
--   UAT-44 Harbour Room  D+3  10:15-11:45 (codes 41-46)  exactly those periods (AC2, TC-VCAL-007)
--   UAT-44 Garden Hall   D+7  18:30-19:00 (codes 74-75)  after the hall closes at 18:00, as a
--                                                        booking kept from before its hours
--                                                        changed (AC1, TC-VCAL-008)
--
-- D is the booking day of seed-venue-search-uat: 14 days after today in Singapore. No other
-- calendar case writes to these days, and the Garden Hall booking is a week after D, so the
-- week with D still ends at closing. Neither venue has setup or turnaround, and the calendar
-- shows booked time only.
--
-- Run after supabase db reset and seed-venue-search-uat:
--
--   supabase db query --file scripts/seed-venue-calendar/seed.sql --local
--
-- Re-running replaces the bookings, dated from today again. Undo with teardown.sql in this
-- directory.

do $$
declare
  v_day          date := (now() at time zone 'Asia/Singapore')::date + 14;
  v_harbour      bigint := (select venue_id from public.venue where location = 'UAT-44 Harbour Room');
  v_garden       bigint := (select venue_id from public.venue where location = 'UAT-44 Garden Hall');
  v_coordinator  bigint := (
    select user_account_id from public.user_account
    where name = 'Test Coordinator' and client_organisation_id is null
  );
  v_organiser    bigint;
  v_organisation bigint;
  v_event        bigint;
  v_booking      bigint;
begin
  select user_account_id, client_organisation_id into v_organiser, v_organisation
    from public.user_account where name = 'Test Organiser';

  if v_harbour is null or v_garden is null then
    raise exception 'The UAT-44 venues are missing' using hint = 'Run seed-venue-search-uat first.';
  end if;
  if v_coordinator is null or v_organiser is null then
    raise exception 'The test accounts are missing' using hint = 'Run supabase db reset first.';
  end if;

  -- The event the bookings hang from; an earlier run's bookings go with it.
  delete from public.event
  where name = 'Calendar Test Event' and client_organisation_id = v_organisation;

  insert into public.event (name, owning_organiser_user_account_id, client_organisation_id, status)
  values ('Calendar Test Event', v_organiser, v_organisation, 'Planning')
  returning event_id into v_event;
  insert into public.event_slot (event_id, slot_date, slot_code)
  select v_event, v_day + 3, n::text from generate_series(41, 46) n;

  insert into public.booking (venue_id, event_id, requested_by_user_account_id,
    decided_by_user_account_id, status)
  values (v_harbour, v_event, v_coordinator, v_coordinator, 'Confirmed')
  returning booking_id into v_booking;
  insert into public.booking_slot (booking_id, slot_date, slot)
  select v_booking, v_day + 3, n::text from generate_series(41, 46) n;

  -- Written straight to the table: the app refuses a request after closing (SPM-334).
  insert into public.booking (venue_id, event_id, requested_by_user_account_id,
    decided_by_user_account_id, status)
  values (v_garden, v_event, v_coordinator, v_coordinator, 'Confirmed')
  returning booking_id into v_booking;
  insert into public.booking_slot (booking_id, slot_date, slot)
  select v_booking, v_day + 7, n::text from generate_series(74, 75) n;

  raise notice 'Calendar bookings ready: Harbour Room % 10:15-11:45, Garden Hall % 18:30-19:00', v_day + 3, v_day + 7;
end $$;
