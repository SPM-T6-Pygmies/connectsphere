-- Seeds the venues and bookings the SPM-44 manual UAT cases (TC-VSEARCH-*,
-- docs/tests/test-registry.csv) search against.
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
-- A search or booking is a start and end time on the 15-minute grid; a venue
-- is open for it only if it operates for the whole of it.
--
--   UAT-44 Harbour Room  08:00-20:00, horizon 60,
--                        venue capacity 250
--                        Theatre 200, Boardroom 20
--                        Projector, Wi-Fi / Step-free access, Hearing loop
--                        Confirmed booking on D, 14:00-16:00
--   UAT-44 Garden Hall   09:00-17:00, horizon 60,
--                        venue capacity 500
--                        Banquet 150, Classroom 80
--                        PA system, Catering area / Lift access
--                        Rejected booking on D, 09:00-11:00 (must not block)
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
      operating_hours_start, operating_hours_end, booking_horizon_days)
    values ('UAT-44 Harbour Room', 250, 'Projector, Wi-Fi', 'Step-free access, Hearing loop',
      '08:00', '20:00', 60)
    returning venue_id into v_harbour;
    insert into public.venue_supported_layout (venue_id, room_layout_id, capacity)
    select v_harbour, room_layout_id, c.capacity
    from (values ('Theatre', 200), ('Boardroom', 20)) c(name, capacity)
    join public.room_layout using (name);
  end if;

  select venue_id into v_garden from public.venue where location = 'UAT-44 Garden Hall';
  if v_garden is null then
    insert into public.venue (location, capacity, facilities, accessibility,
      operating_hours_start, operating_hours_end, booking_horizon_days)
    values ('UAT-44 Garden Hall', 500, 'PA system, Catering area', 'Lift access',
      '09:00', '17:00', 60)
    returning venue_id into v_garden;
    insert into public.venue_supported_layout (venue_id, room_layout_id, capacity)
    select v_garden, room_layout_id, c.capacity
    from (values ('Banquet', 150), ('Classroom', 80)) c(name, capacity)
    join public.room_layout using (name);
  end if;

  -- Bookings: a venue is taken for the times its live bookings hold -------
  if not exists (select 1 from public.event where name = 'UAT-44 Booked Harbour') then
    insert into public.event (name, owning_organiser_user_account_id, client_organisation_id, status)
    values ('UAT-44 Booked Harbour', v_organiser, v_organisation, 'Planning')
    returning event_id into v_event;
    insert into public.booking (venue_id, event_id, requested_by_user_account_id,
      decided_by_user_account_id, status)
    values (v_harbour, v_event, v_coordinator, v_coordinator, 'Confirmed');
  end if;

  if not exists (select 1 from public.event where name = 'UAT-44 Rejected Garden') then
    insert into public.event (name, owning_organiser_user_account_id, client_organisation_id, status)
    values ('UAT-44 Rejected Garden', v_organiser, v_organisation, 'Planning')
    returning event_id into v_event;
    insert into public.booking (venue_id, event_id, requested_by_user_account_id,
      decided_by_user_account_id, status)
    values (v_garden, v_event, v_coordinator, v_coordinator, 'Rejected');
  end if;

  -- The times those bookings hold. Separate from the inserts above so a re-run
  -- also gives bookings from an earlier version of this seed their times.
  insert into public.booking_slot (booking_id, slot_date, start_time, end_time)
  select b.booking_id, v_day, c.start_time::time, c.end_time::time
  from (values
    ('UAT-44 Booked Harbour', '14:00', '16:00'),
    ('UAT-44 Rejected Garden', '09:00', '11:00')
  ) c(event_name, start_time, end_time)
  join public.event e on e.name = c.event_name
  join public.booking b on b.event_id = e.event_id
  on conflict (booking_id, slot_date, start_time) do nothing;

  raise notice 'SPM-44 UAT data ready. Booking day D = %', v_day;
end;
$$;
