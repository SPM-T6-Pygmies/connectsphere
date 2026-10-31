-- SPM-218 manual tests (docs/testing/VENUE_HOLD_MANUAL_TESTS.md): the nine booking
-- requests the cases decide on, for the Founders' Gala Dinner event, and a venue block
-- on Rooftop Terrace recorded after its request.
--
-- Run after seed-coordinator-view, seed-venues, seed-venue-search-uat, seed-equipment
-- and seed-booking-holds, once per fresh database (it adds rows each time):
--
--   supabase db query --file scripts/seed-booking-holds/fixture.sql --local
--
-- T is Wednesday 9 December 2026, inside venue search's 60 days ahead from 10 October 2026.
-- Main Hall's two bookings D and E sit on day H, Sunday 6 December 2026, the day seed.sql
-- holds. Times are 15-minute codes, first to last: code n starts n*15
-- minutes after midnight, so 28-47 is 07:00-12:00, 52-71 13:00-18:00, 56-71 14:00-18:00 and
-- 76-95 19:00-24:00.
--
-- The nine rows are inserted in the order A, B, C, X, Y, D, E, F, G, so ordered by
-- booking id they are exactly that sequence.

do $$
declare
  v_event bigint := (select event_id from public.event where name = 'Founders'' Gala Dinner');
  v_coord bigint := (select user_account_id from public.user_account where name = 'Test Coordinator');
  v_staff bigint := (select user_account_id from public.user_account where name = 'Test Venue Staff');
  v_id bigint;
  t date := date '2026-12-09';
  h date := date '2026-12-06';
  r record;
begin
  if v_event is null or v_coord is null or v_staff is null then
    raise exception 'The Founders'' Gala Dinner event or the test accounts are missing'
      using hint = 'Run supabase db reset, then the seeds listed at the top of this file.';
  end if;

  for r in
    select * from (values
      ('Studio',              t,     28, 47, 'Requested'),   -- A 07:00-12:00: held in TC-VHOLD-001
      ('Studio',              t,     28, 47, 'Requested'),   -- B: same times as A, refused in TC-VHOLD-002
      ('Studio',              t + 1, 52, 71, 'Requested'),   -- C 13:00-18:00: other times, unaffected
      ('Main Hall',           t + 2, 76, 95, 'Confirmed'),   -- X 19:00-24:00: already confirmed
      ('Main Hall',           t + 2, 76, 95, 'Requested'),   -- Y: same times as X, refused in TC-VHOLD-003
      ('Main Hall',           h,     28, 47, 'Requested'),   -- D 07:00-12:00: over the expired hold, TC-VHOLD-004
      ('Main Hall',           h,     56, 71, 'Requested'),   -- E 14:00-18:00: over the live hold, TC-VHOLD-004
      ('Rooftop Terrace',     t + 6, 28, 47, 'Requested'),   -- F 07:00-12:00: blocked afterwards, TC-VHOLD-003
      ('UAT-44 Harbour Room', t + 3, 28, 47, 'Requested')    -- G 07:00-12:00: held, then searched for, TC-VHOLD-002
    ) as v(venue, slot_date, first_code, last_code, status)
  loop
    insert into public.booking (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status)
    values ((select venue_id from public.venue where location = r.venue), v_event, v_coord,
            case when r.status = 'Requested' then null else v_staff end, r.status)
    returning booking_id into v_id;
    insert into public.booking_slot (booking_id, slot_date, slot)
    select v_id, r.slot_date, n::text from generate_series(r.first_code, r.last_code) n;
  end loop;

  perform public.venue_staff_record_unavailability(
    v_staff, (select venue_id from public.venue where location = 'Rooftop Terrace'), 'Renovation', null,
    -- 07:00-12:00, as 15-minute codes 28-47 (SPM-321)
    (select jsonb_agg(jsonb_build_object('date', t + 6, 'slot', n::text) order by n) from generate_series(28, 47) n));
end $$;
