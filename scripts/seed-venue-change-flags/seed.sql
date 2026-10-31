-- SPM-105 manual tests (docs/testing/VENUE_CHANGE_FLAG_MANUAL_TESTS.md): a venue of its own
-- for Venue Staff to edit, and the bookings those edits flag or leave alone. Every event is
-- named "Venue Change: ...". F is Thursday 10 December 2026: fixed, after the November 2026
-- test window, and on a day no other seed of the `full` profile (pnpm e2e:data) books Studio.
-- Past Expo is on Wednesday 28 October 2026, which stays in the past.
--
--   Change Test Hall: Theatre seats 300, Banquet 150. Wi-Fi, Catering area.
--                     Step-free access, Hearing loop. Open 07:00-12:00, 13:00-18:00, 19:00-24:00.
--
--   Event                        Needs                                        Venue             Day, slot  Status
--   Venue Change: Gala Dinner    120, Banquet, Step-free access, Wi-Fi        Change Test Hall  F, PM      Confirmed
--                                                                             Studio            F, PM      Confirmed
--   Venue Change: Board Lunch     60, Banquet                                 Change Test Hall  F + 1, PM  Confirmed
--   Venue Change: Video Call      50, Theatre, Video-conferencing (missing)   Change Test Hall  F + 2, PM  Confirmed
--   Venue Change: Open Day        no attendance, Banquet                      Change Test Hall  F + 3, PM  Confirmed
--   Venue Change: Pending Talk   120, Banquet                                 Change Test Hall  F + 4, PM  Requested
--   Venue Change: Past Expo      120, Banquet                                 Change Test Hall  28 Oct     Confirmed
--
-- All belong to Test Coordinator. Run after supabase db reset, seed-coordinator-view and
-- seed-venues:
--
--   supabase db query --file scripts/seed-venue-change-flags/seed.sql --local
--
-- Re-running puts Change Test Hall back as above and replaces the events, their bookings
-- and their flags. List what loaded with
-- show.sql; undo with teardown.sql.

do $$
declare
  f date := date '2026-12-10';
  v_staff bigint := (select user_account_id from public.user_account where name = 'Test Venue Staff');
  v_coordinator bigint := (select user_account_id from public.user_account
                            where name = 'Test Coordinator' and client_organisation_id is null);
  v_organiser bigint;
  v_organisation bigint;
  v_venue bigint;
  v_event bigint;
  v_booking bigint;
  r record;
begin
  select user_account_id, client_organisation_id into v_organiser, v_organisation
    from public.user_account where name = 'Test Organiser';

  if v_staff is null or v_organiser is null or v_coordinator is null then
    raise exception 'The test accounts are missing' using hint = 'Run supabase db reset first.';
  end if;
  if not exists (select 1 from public.venue where location = 'Studio')
     or not exists (select 1 from public.room_layout where name = 'Banquet') then
    raise exception 'Studio or the Banquet layout is missing' using hint = 'Run seed-venues first.';
  end if;

  -- Earlier runs' events go, and their bookings and flags with them, by cascade; then the
  -- venue, whatever the cases renamed it to, so it comes back as the cases expect.
  delete from public.event
  where name like 'Venue Change: %' and client_organisation_id = v_organisation;
  delete from public.venue
  where location like 'Change Test Hall%'
    and not exists (select 1 from public.booking b where b.venue_id = venue.venue_id);

  insert into public.venue (location, capacity, facilities, accessibility, booking_horizon_days)
  values ('Change Test Hall', 300, 'Wi-Fi, Catering area', 'Step-free access, Hearing loop', 180)
  returning venue_id into v_venue;

  insert into public.venue_slot (venue_id, slot_code)
  select v_venue, n::text
  from generate_series(28, 95) n
  where n between 28 and 47 or n between 52 and 71 or n between 76 and 95;

  insert into public.venue_supported_layout (venue_id, room_layout_id, capacity)
  select v_venue, room_layout_id, case name when 'Theatre' then 300 else 150 end
  from public.room_layout where name in ('Theatre', 'Banquet');

  for r in
    select * from (values
      ('Venue Change: Gala Dinner',   120,           'Banquet', 'Step-free access', 'Wi-Fi',              'Change Test Hall', f,     'Confirmed'),
      ('Venue Change: Gala Dinner',   120,           'Banquet', 'Step-free access', 'Wi-Fi',              'Studio',           f,     'Confirmed'),
      ('Venue Change: Board Lunch',    60,           'Banquet', null,               null,                 'Change Test Hall', f + 1, 'Confirmed'),
      ('Venue Change: Video Call',     50,           'Theatre', null,               'Video-conferencing', 'Change Test Hall', f + 2, 'Confirmed'),
      ('Venue Change: Open Day',     null::integer,  'Banquet', null,               null,                 'Change Test Hall', f + 3, 'Confirmed'),
      ('Venue Change: Pending Talk',  120,           'Banquet', null,               null,                 'Change Test Hall', f + 4, 'Requested'),
      ('Venue Change: Past Expo',     120,           'Banquet', null,               null,                 'Change Test Hall', date '2026-10-28', 'Confirmed')
    ) as v(event_name, attendance, layout, accessibility, facilities, venue, slot_date, status)
  loop
    select event_id into v_event
      from public.event where name = r.event_name and client_organisation_id = v_organisation;
    if v_event is null then
      insert into public.event (
        name, preferred_date, status, expected_attendance, room_layout_preference,
        accessibility_requirements, required_facilities, assigned_coordinator_user_account_id,
        owning_organiser_user_account_id, client_organisation_id
      )
      values (
        r.event_name, r.slot_date, 'Planning', r.attendance, r.layout,
        r.accessibility, r.facilities, v_coordinator, v_organiser, v_organisation
      )
      returning event_id into v_event;
    end if;

    -- Studio has only Theatre; the booking takes the layout its venue offers.
    insert into public.booking (
      venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status, room_layout_id
    )
    select vn.venue_id, v_event, v_coordinator,
           case when r.status = 'Requested' then null else v_staff end,
           r.status,
           (select vsl.room_layout_id from public.venue_supported_layout vsl
              join public.room_layout rl on rl.room_layout_id = vsl.room_layout_id
             where vsl.venue_id = vn.venue_id
             order by rl.name = r.layout desc, rl.name limit 1)
    from public.venue vn where vn.location = r.venue
    returning booking_id into v_booking;

    -- PM as 15-minute slots (SPM-324).
    insert into public.booking_slot (booking_id, slot_date, slot)
    select v_booking, r.slot_date, n::text from generate_series(52, 71) n;
  end loop;
end $$;
