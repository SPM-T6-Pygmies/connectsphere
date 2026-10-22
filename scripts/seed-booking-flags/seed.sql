-- SPM-313 manual tests (docs/testing/VENUE_FLAG_MANUAL_TESTS.md): the events and bookings
-- that Venue Staff's blocks flag. Every event is named "Flag Test: ...". F is the day the
-- cases block, 28 days from today in Singapore time, so nothing here goes stale and nothing
-- lands on the days the other seeds use (seed-venue-unavailability: +14 to +20,
-- seed-booking-holds: +21).
--
--   Event                          Coordinator          Venue            Day, slot   Status
--   Flag Test: Tech Summit         Test Coordinator     Main Hall        F, PM       Confirmed
--                                                       Studio           F, PM       Confirmed
--   Flag Test: Offsite Day         Test Coordinator     Main Hall        F + 4, PM   Confirmed
--   Flag Test: Second Event        Test Coordinator     Rooftop Terrace  F, PM       Requested
--   Flag Test: Hold Event          Test Coordinator     Studio           F + 2, PM   Tentative Hold, live
--                                                       Studio           F + 3, PM   Tentative Hold, expired an hour ago
--   Flag Test: Workshop            Test Coordinator 2   Main Hall        F, AM       Confirmed
--   Flag Test: Gala                Test Coordinator 2   Main Hall        F, Night    Confirmed
--   Flag Test: Quiz                Test Coordinator 2   Main Hall        F + 1, PM   Confirmed
--
-- Run after supabase db reset, seed-coordinator-view and seed-venues:
--
--   supabase db query --file scripts/seed-booking-flags/seed.sql --local
--
-- Re-running replaces the "Flag Test:" events and their bookings, with the dates measured
-- from today again. It does not touch blocks: the cases record those as Venue Staff, and
-- teardown.sql removes them. List what loaded with show.sql; undo with teardown.sql.

do $$
declare
  f date := (now() at time zone 'Asia/Singapore')::date + 28;
  v_staff bigint := (select user_account_id from public.user_account where name = 'Test Venue Staff');
  v_organiser bigint;
  v_organisation bigint;
  v_event bigint;
  v_booking bigint;
  r record;
begin
  select user_account_id, client_organisation_id into v_organiser, v_organisation
    from public.user_account where name = 'Test Organiser';

  if v_staff is null or v_organiser is null
     or not exists (select 1 from public.user_account where name = 'Test Coordinator' and client_organisation_id is null)
     or not exists (select 1 from public.user_account where name = 'Test Coordinator 2' and client_organisation_id is null) then
    raise exception 'The test accounts are missing' using hint = 'Run supabase db reset first.';
  end if;
  if (select count(*) from public.venue where location in ('Main Hall', 'Studio', 'Rooftop Terrace')) < 3 then
    raise exception 'Main Hall, Studio or Rooftop Terrace is missing' using hint = 'Run seed-venues first.';
  end if;

  -- Earlier runs' events go, and their bookings with them, by cascade.
  delete from public.event
  where name like 'Flag Test: %' and client_organisation_id = v_organisation;

  for r in
    select * from (values
      ('Flag Test: Tech Summit',  'Test Coordinator',   'Main Hall', f,     'PM',    'Confirmed',      null::interval),
      ('Flag Test: Tech Summit',  'Test Coordinator',   'Studio',    f,     'PM',    'Confirmed',      null),
      ('Flag Test: Offsite Day',  'Test Coordinator',   'Main Hall', f + 4, 'PM',    'Confirmed',      null),
      ('Flag Test: Second Event', 'Test Coordinator',   'Rooftop Terrace', f, 'PM',    'Requested',      null),
      ('Flag Test: Hold Event',   'Test Coordinator',   'Studio',    f + 2, 'PM',    'Tentative Hold', interval '20 days'),
      ('Flag Test: Hold Event',   'Test Coordinator',   'Studio',    f + 3, 'PM',    'Tentative Hold', interval '-1 hour'),
      ('Flag Test: Workshop',     'Test Coordinator 2', 'Main Hall', f,     'AM',    'Confirmed',      null),
      ('Flag Test: Gala',         'Test Coordinator 2', 'Main Hall', f,     'Night', 'Confirmed',      null),
      ('Flag Test: Quiz',         'Test Coordinator 2', 'Main Hall', f + 1, 'PM',    'Confirmed',      null)
    ) as v(event_name, coordinator, venue, slot_date, slot, status, hold_for)
  loop
    select event_id into v_event
      from public.event where name = r.event_name and client_organisation_id = v_organisation;
    if v_event is null then
      insert into public.event (
        name, preferred_date, status, assigned_coordinator_user_account_id,
        owning_organiser_user_account_id, client_organisation_id
      )
      values (
        r.event_name, r.slot_date, 'Planning',
        (select user_account_id from public.user_account
          where name = r.coordinator and client_organisation_id is null),
        v_organiser, v_organisation
      )
      returning event_id into v_event;
    end if;

    insert into public.booking (
      venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status, hold_expires_at
    )
    values (
      (select venue_id from public.venue where location = r.venue), v_event,
      (select assigned_coordinator_user_account_id from public.event where event_id = v_event),
      case when r.status = 'Requested' then null else v_staff end,
      r.status,
      case when r.hold_for is null then null else now() + r.hold_for end
    )
    returning booking_id into v_booking;
    -- The slot's hours as 15-minute slots (SPM-324).
    insert into public.booking_slot (booking_id, slot_date, slot)
    select v_booking, r.slot_date, g.slot_code
    from public.slot s
    join public.slot g on g.slot_code ~ '^[0-9]+$' and g.start_time >= s.start_time and g.end_time <= s.end_time
    where s.slot_code = r.slot;
  end loop;
end $$;
