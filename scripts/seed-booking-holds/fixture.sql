-- SPM-218 manual tests (docs/testing/VENUE_HOLD_MANUAL_TESTS.md): the nine booking
-- requests the cases decide on, for the Founders' Gala Dinner event, and a venue block
-- on Rooftop Terrace recorded after its request.
--
-- Run after seed-coordinator-view, seed-venues, seed-venue-search-uat, seed-equipment
-- and seed-booking-holds, once per fresh database (it adds rows each time):
--
--   supabase db query --file scripts/seed-booking-holds/fixture.sql --local
--
-- T is 14 days from today, Singapore time, so venue search (60 days ahead) can still see it.
-- Main Hall's two bookings D and E sit on the day the holds are on: 21 days from today,
-- the same day seed.sql uses.
--
-- The nine rows are inserted in the order A, B, C, X, Y, D, E, F, G, so ordered by
-- booking id they are exactly that sequence.

do $$
declare
  v_event bigint := (select event_id from public.event where name = 'Founders'' Gala Dinner');
  v_coord bigint := (select user_account_id from public.user_account where name = 'Test Coordinator');
  v_staff bigint := (select user_account_id from public.user_account where name = 'Test Venue Staff');
  v_id bigint;
  t date := (now() at time zone 'Asia/Singapore')::date + 14;
  h date := (now() at time zone 'Asia/Singapore')::date + 21;
  r record;
begin
  if v_event is null or v_coord is null or v_staff is null then
    raise exception 'The Founders'' Gala Dinner event or the test accounts are missing'
      using hint = 'Run supabase db reset, then the seeds listed at the top of this file.';
  end if;

  for r in
    select * from (values
      ('Studio',              t,     'AM',    'Requested'),   -- A: held in TC-VHOLD-001
      ('Studio',              t,     'AM',    'Requested'),   -- B: same slot as A, refused in TC-VHOLD-002
      ('Studio',              t + 1, 'PM',    'Requested'),   -- C: a different slot, unaffected
      ('Main Hall',           t + 2, 'Night', 'Confirmed'),   -- X: already confirmed
      ('Main Hall',           t + 2, 'Night', 'Requested'),   -- Y: same slot as X, refused in TC-VHOLD-003
      ('Main Hall',           h,     'AM',    'Requested'),   -- D: over the expired hold, TC-VHOLD-004
      ('Main Hall',           h,     'PM',    'Requested'),   -- E: over the live hold, TC-VHOLD-004
      ('Rooftop Terrace',     t + 6, 'AM',    'Requested'),   -- F: blocked afterwards, TC-VHOLD-003
      ('UAT-44 Harbour Room', t + 3, 'AM',    'Requested')    -- G: held, then searched for, TC-VHOLD-002
    ) as v(venue, slot_date, slot, status)
  loop
    insert into public.booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status)
    values ((select venue_id from public.venue where location = r.venue), v_event, v_coord,
            case when r.status = 'Requested' then null else v_staff end, r.status)
    returning booking_id into v_id;
    -- The slot's hours as 15-minute slots (SPM-324).
    insert into public.booking_slot (booking_id, slot_date, slot)
    select v_id, r.slot_date, g.slot_code
    from public.slot s
    join public.slot g on g.slot_code ~ '^[0-9]+$' and g.start_time >= s.start_time and g.end_time <= s.end_time
    where s.slot_code = r.slot;
  end loop;

  perform public.venue_staff_record_unavailability(
    v_staff, (select venue_id from public.venue where location = 'Rooftop Terrace'), 'Renovation', null,
    jsonb_build_array(jsonb_build_object('date', t + 6, 'slot', 'AM')));
end $$;
