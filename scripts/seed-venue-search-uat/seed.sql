-- Seeds the venues and bookings the SPM-44 manual UAT cases (TC-VSEARCH-*,
-- docs/testing/VENUE_SEARCH_MANUAL_TESTS.md) search against.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-venue-search-uat/seed.sql --local
--
-- Every name starts with "UAT-44" so the data is easy to spot and teardown.sql
-- removes exactly it. Safe to run more than once: each insert is guarded.
--
-- D below is the booking day: 14 days after today in Singapore, so it is
-- inside both venues' 60-day booking horizon whenever the cases are run.
--
--   UAT-44 Harbour Room  slots AM, PM, Night; horizon 60, venue capacity 250
--                        Theatre 200, Boardroom 20
--                        Wi-Fi, Video-conferencing / Step-free access, Hearing loop
--                        Confirmed booking on D, PM
--   UAT-44 Garden Hall   slots AM, PM; horizon 60, venue capacity 500
--                        Banquet 150, Classroom 80
--                        Catering area / Lift access
--                        Rejected booking on D, AM (must not block)
--
-- Uses the test accounts from the migrations and supabase/seed.sql
-- (supabase/SEED.md): Test Organiser owns the events, Test Coordinator
-- requests the bookings and Test Venue Staff decides them.

do $$
declare
  v_organisation bigint;
  v_organiser    bigint;
  v_coordinator  bigint;
  v_day          date := (now() at time zone 'Asia/Singapore')::date + 14;
  v_harbour      bigint;
  v_garden       bigint;
  v_event        bigint;
  v_booking      bigint;
begin
  select client_organisation_id into v_organisation
    from public.client_organisation where name = 'Test Organisation';
  select user_account_id into v_organiser
    from public.user_account
    where name = 'Test Organiser' and client_organisation_id = v_organisation;
  select user_account_id into v_coordinator
    from public.user_account
    where name = 'Test Coordinator' and client_organisation_id is null;

  if v_organisation is null or v_organiser is null or v_coordinator is null then
    raise exception 'Missing test accounts'
      using hint = 'Seed the accounts first: supabase db reset (supabase/SEED.md).';
  end if;

  -- Venues ------------------------------------------------------------------
  select venue_id into v_harbour from public.venue where location = 'UAT-44 Harbour Room';
  if v_harbour is null then
    insert into public.venue (location, capacity, facilities, accessibility,
      booking_horizon_days)
    values ('UAT-44 Harbour Room', 250, 'Wi-Fi, Video-conferencing', 'Step-free access, Hearing loop', 60)
    returning venue_id into v_harbour;
    -- Opening hours as 15-minute slots (SPM-320): 07:00-12:00, 13:00-18:00 and 19:00-24:00.
    insert into public.venue_slot (venue_id, slot_code)
    select v_harbour, n::text from generate_series(28, 95) n
    where n between 28 and 47 or n between 52 and 71 or n between 76 and 95;
    insert into public.venue_supported_layout (venue_id, room_layout_id, capacity)
    select v_harbour, room_layout_id, c.capacity
    from (values ('Theatre', 200), ('Boardroom', 20)) c(name, capacity)
    join public.room_layout using (name);
  end if;

  select venue_id into v_garden from public.venue where location = 'UAT-44 Garden Hall';
  if v_garden is null then
    insert into public.venue (location, capacity, facilities, accessibility,
      booking_horizon_days)
    values ('UAT-44 Garden Hall', 500, 'Catering area', 'Lift access', 60)
    returning venue_id into v_garden;
    -- Open 07:00-12:00 and 13:00-18:00 (no evening).
    insert into public.venue_slot (venue_id, slot_code)
    select v_garden, n::text from generate_series(28, 71) n
    where n between 28 and 47 or n between 52 and 71;
    insert into public.venue_supported_layout (venue_id, room_layout_id, capacity)
    select v_garden, room_layout_id, c.capacity
    from (values ('Banquet', 150), ('Classroom', 80)) c(name, capacity)
    join public.room_layout using (name);
  end if;

  -- Bookings: busy time comes from the slots a booking holds ---------------
  if not exists (select 1 from public.event where name = 'UAT-44 Booked Harbour') then
    insert into public.event (name, owning_organiser_user_account_id, client_organisation_id, status)
    values ('UAT-44 Booked Harbour', v_organiser, v_organisation, 'Planning')
    returning event_id into v_event;
    -- PM's hours as 15-minute slots (SPM-326).
    insert into public.event_slot (event_id, slot_date, slot_code)
    select v_event, v_day, n::text from generate_series(52, 71) as n;
    insert into public.booking (venue_id, event_id, requested_by_user_account_id,
      decided_by_user_account_id, status)
    values (v_harbour, v_event, v_coordinator, v_coordinator, 'Confirmed')
    returning booking_id into v_booking;
    -- The slot's hours as 15-minute slots (SPM-324).
    insert into public.booking_slot (booking_id, slot_date, slot)
    select v_booking, v_day, g.slot_code
    from public.slot s
    join public.slot g on g.slot_code ~ '^[0-9]+$' and g.start_time >= s.start_time and g.end_time <= s.end_time
    where s.slot_code = 'PM';
  end if;

  if not exists (select 1 from public.event where name = 'UAT-44 Rejected Garden') then
    insert into public.event (name, owning_organiser_user_account_id, client_organisation_id, status)
    values ('UAT-44 Rejected Garden', v_organiser, v_organisation, 'Planning')
    returning event_id into v_event;
    -- AM's hours as 15-minute slots (SPM-326).
    insert into public.event_slot (event_id, slot_date, slot_code)
    select v_event, v_day, n::text from generate_series(28, 47) as n;
    insert into public.booking (venue_id, event_id, requested_by_user_account_id,
      decided_by_user_account_id, status)
    values (v_garden, v_event, v_coordinator, v_coordinator, 'Rejected')
    returning booking_id into v_booking;
    -- The slot's hours as 15-minute slots (SPM-324).
    insert into public.booking_slot (booking_id, slot_date, slot)
    select v_booking, v_day, g.slot_code
    from public.slot s
    join public.slot g on g.slot_code ~ '^[0-9]+$' and g.start_time >= s.start_time and g.end_time <= s.end_time
    where s.slot_code = 'AM';
  end if;

  raise notice 'SPM-44 UAT data ready. Booking day D = %', v_day;
end;
$$;
