-- Seeds the event cancel cases (SPM-55, docs/testing/EVENT_CANCEL_MANUAL_TESTS.md): on top of
-- seed-booking-cancel's five bookings on the Founders' Gala Dinner, one Tentative Hold whose
-- expiry has already passed but which nothing has marked Expired yet.
--
--   Booking  Venue               Day, slot  Status          What it is for
--   L        UAT-44 Garden Hall  C, Night   Tentative Hold  lapsed an hour before seeding; it must end
--                                                           Expired, never Released by the cancel
--
-- C is 10 days from today, Singapore time, the same day as seed-booking-cancel's bookings.
-- Every staff page sweeps lapsed holds after it renders (SPM-254, staff-shell.tsx), so L reads
-- Expired from the first page you open. Run verify.sql before signing in.
--
-- Run after the reset and seed-coordinator-view, seed-venues, seed-venue-search-uat,
-- seed-equipment and seed-booking-cancel:
--
--   supabase db query --file scripts/seed-event-cancel/seed.sql --local
--
-- Safe to run more than once: a booking already on L's venue, day and slot for the event is left
-- as it is. For a fresh start, run teardown.sql first. verify.sql checks the seeded state.

do $$
declare
  v_event bigint := (select event_id from public.event where name = 'Founders'' Gala Dinner');
  v_coord bigint := (select user_account_id from public.user_account
                     where name = 'Test Coordinator' and client_organisation_id is null);
  v_staff bigint := (select user_account_id from public.user_account
                     where name = 'Test Venue Staff' and client_organisation_id is null);
  v_venue bigint := (select venue_id from public.venue where location = 'UAT-44 Garden Hall');
  c date := (now() at time zone 'Asia/Singapore')::date + 10;
  v_id bigint;
begin
  if v_event is null or v_coord is null or v_staff is null or v_venue is null
     or not exists (select 1 from public.booking where event_id = v_event and venue_id = v_venue) then
    raise exception 'Missing: %',
      concat_ws(', ',
        case when v_coord is null or v_staff is null then 'the test accounts' end,
        case when v_event is null then 'the Founders'' Gala Dinner event (run seed-equipment)' end,
        case when v_venue is null then 'UAT-44 Garden Hall (run seed-venue-search-uat)' end,
        case when v_event is not null and v_venue is not null
              and not exists (select 1 from public.booking where event_id = v_event and venue_id = v_venue)
             then 'the venue booking cancel bookings (run seed-booking-cancel)' end)
      using hint = 'Run supabase db reset, then the seeds listed at the top of this file.';
  end if;

  if not exists (
    select 1
    from public.booking b
    join public.booking_slot bs on bs.booking_id = b.booking_id
    where b.event_id = v_event and b.venue_id = v_venue
      and bs.slot_date = c and bs.slot = 'Night'
  ) then
    insert into public.booking (
      venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id,
      status, hold_expires_at
    )
    values (v_venue, v_event, v_coord, v_staff, 'Tentative Hold', now() - interval '1 hour')
    returning booking_id into v_id;
    insert into public.booking_slot (booking_id, slot_date, slot) values (v_id, c, 'Night');
  end if;
end $$;
