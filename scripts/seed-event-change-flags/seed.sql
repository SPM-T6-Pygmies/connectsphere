-- SPM-309 manual tests (docs/testing/EVENT_CHANGE_FLAG_MANUAL_TESTS.md): four events of Test
-- Coordinator, each with a change request waiting and the same four bookings on one day,
-- on fixed dates in December 2026.
--
--   Event                          Day       Waiting change request
--   Event Change: Gala Dinner      Thu 3 Dec  date and time -> Thu 10 Dec 9:00 am - 5:00 pm
--   Event Change: Product Launch   Fri 4 Dec  attendance 120 -> 150; venue requirements -> Stage and a lectern
--   Event Change: Staff Briefing   Mon 7 Dec  equipment -> Projector and two microphones
--   Event Change: Town Hall        Tue 8 Dec  date and time -> Thu 10 Dec 9:00 am - 5:00 pm; attendance 120 -> 150
--
-- Each event has 120 expected attendance and these bookings, all 1:00 pm - 6:00 pm on its day:
--   Main Hall            Confirmed                       live
--   Studio               Tentative Hold, unexpired       live
--   Rooftop Terrace      Requested                       not live
--   UAT-44 Harbour Room  Tentative Hold, lapsed          not live
--
-- Run after supabase db reset, seed-coordinator-view, seed-venues and seed-venue-search-uat:
--
--   supabase db query --file scripts/seed-event-change-flags/seed.sql --local
--
-- Re-running replaces the four events with everything on them. List the result with show.sql;
-- undo with teardown.sql.

do $$
declare
  v_coord     bigint := (select user_account_id from public.user_account
                          where name = 'Test Coordinator' and client_organisation_id is null);
  v_organiser bigint;
  v_org       bigint;
  v_event     bigint;
  v_request   bigint;
  v_booking   bigint;
  v_main      bigint := (select venue_id from public.venue where location = 'Main Hall');
  v_studio    bigint := (select venue_id from public.venue where location = 'Studio');
  v_rooftop   bigint := (select venue_id from public.venue where location = 'Rooftop Terrace');
  v_harbour   bigint := (select venue_id from public.venue where location = 'UAT-44 Harbour Room');
  e           record;
  i           int;
begin
  select user_account_id, client_organisation_id into v_organiser, v_org
    from public.user_account where name = 'Test Organiser';
  if v_coord is null or v_organiser is null or v_main is null or v_harbour is null then
    raise exception 'The test accounts or venues are missing'
      using hint = 'Run supabase db reset, then seed-coordinator-view, seed-venues and seed-venue-search-uat.';
  end if;

  delete from public.event where name like 'Event Change: %' and client_organisation_id = v_org;

  for e in
    select * from (values
      ('Event Change: Gala Dinner',    date '2026-12-03',
       '[["times","[{\"date\":\"2026-12-10\",\"start\":\"09:00\",\"end\":\"17:00\"}]"]]'::jsonb),
      ('Event Change: Product Launch', date '2026-12-04',
       '[["expected_attendance","150"],["venue_requirements","Stage and a lectern"]]'::jsonb),
      ('Event Change: Staff Briefing', date '2026-12-07',
       '[["equipment_requirements","Projector and two microphones"]]'::jsonb),
      ('Event Change: Town Hall',      date '2026-12-08',
       '[["times","[{\"date\":\"2026-12-10\",\"start\":\"09:00\",\"end\":\"17:00\"}]"],["expected_attendance","150"]]'::jsonb)
    ) as t (event_name, day, items)
  loop
    insert into public.event (name, preferred_date, status, expected_attendance, venue_requirements,
                              assigned_coordinator_user_account_id, owning_organiser_user_account_id,
                              client_organisation_id)
    values (e.event_name, e.day, 'Planning', 120, 'None', v_coord, v_organiser, v_org)
    returning event_id into v_event;

    for i in 1..4 loop
      insert into public.booking (venue_id, event_id, requested_by_user_account_id)
      values ((array[v_main, v_studio, v_rooftop, v_harbour])[i], v_event, v_coord)
      returning booking_id into v_booking;
      insert into public.booking_slot (booking_id, slot_date, slot)
      select v_booking, e.day, n::text from generate_series(52, 71) n;
      if i = 1 then
        update public.booking set status = 'Confirmed', decided_by_user_account_id = v_coord
         where booking_id = v_booking;
      elsif i = 2 then
        update public.booking set status = 'Tentative Hold', decided_by_user_account_id = v_coord,
               hold_expires_at = now() + interval '1 year' where booking_id = v_booking;
      elsif i = 4 then
        update public.booking set status = 'Tentative Hold', decided_by_user_account_id = v_coord,
               hold_expires_at = now() - interval '1 hour' where booking_id = v_booking;
      end if;
    end loop;

    insert into public.change_request (event_id, requesting_user_account_id)
    values (v_event, v_organiser) returning change_request_id into v_request;
    insert into public.change_request_item (change_request_id, field_name, requested_value)
    select v_request, x ->> 0, x ->> 1 from jsonb_array_elements(e.items) x;
  end loop;
end $$;
