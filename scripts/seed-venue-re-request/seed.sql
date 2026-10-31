-- SPM-251 manual tests (docs/testing/VENUE_RE_REQUEST_MANUAL_TESTS.md): an event whose two
-- bookings are flagged, for its coordinator to re-request. Every event is named
-- "Re-request Test: ...". D is Sunday 20 December 2026: fixed, after the November 2026 test
-- window, and a day no other seed of the `full` profile (pnpm e2e:data) books in the afternoon
-- at Main Hall or Studio.
--
--   Event                          Coordinator          Times, needs                  Venue      D           Status
--   Re-request Test: Tech Summit   Test Coordinator     D 14:00-17:00, 110, Banquet   Main Hall  13:00-18:00 Confirmed, Theatre (A)
--                                                                                     Studio     13:00-18:00 Confirmed, Theatre (B)
--   Re-request Test: Evening Gala  Test Coordinator 2   D 19:00-24:00                 Main Hall  19:00-24:00 Confirmed
--
-- A was booked 13:00-18:00 in Theatre; the event has since moved to 14:00-17:00 and prefers
-- Banquet, so a re-request starts from the event, not from A. Two blocks, recorded as Test Venue
-- Staff through the function the Unavailability form calls, flag A and B:
--
--   Main Hall  D 13:00-14:00  Maintenance  flags A (its first hour only)
--   Studio     D 13:00-18:00  Renovation   flags B
--
-- Run after supabase db reset, seed-coordinator-view and seed-venues:
--
--   supabase db query --file scripts/seed-venue-re-request/seed.sql --local
--
-- Re-running replaces the events, their bookings and re-requests, and the blocks on D. List
-- what loaded with show.sql; undo with teardown.sql.

do $$
declare
  d date := date '2026-12-20';
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

  -- Earlier runs' events go, and their bookings and flags with them, by cascade; then the
  -- blocks on D at the two venues, with the audit rows they wrote.
  delete from public.event
  where name like 'Re-request Test: %' and client_organisation_id = v_organisation;
  delete from public.audit_record a
  using public.venue_unavailability u
  where a.entity_type = 'venue_unavailability' and a.entity_id = u.venue_unavailability_id
    and u.venue_id in (select venue_id from public.venue where location in ('Main Hall', 'Studio'))
    and exists (select 1 from public.venue_unavailability_slot us
                where us.venue_unavailability_id = u.venue_unavailability_id and us.slot_date = d);
  delete from public.venue_unavailability u
  where u.venue_id in (select venue_id from public.venue where location in ('Main Hall', 'Studio'))
    and exists (select 1 from public.venue_unavailability_slot us
                where us.venue_unavailability_id = u.venue_unavailability_id and us.slot_date = d);

  for r in
    select * from (values
      ('Re-request Test: Tech Summit',  'Test Coordinator',   110, 'Banquet', 56, 67),
      ('Re-request Test: Evening Gala', 'Test Coordinator 2',  80, null,      76, 95)
    ) as e (name, coordinator, attendance, layout, first_code, last_code)
  loop
    insert into public.event (
      name, preferred_date, status, assigned_coordinator_user_account_id,
      owning_organiser_user_account_id, client_organisation_id, expected_attendance, room_layout_preference
    )
    values (
      r.name, d, 'Planning',
      (select user_account_id from public.user_account where name = r.coordinator and client_organisation_id is null),
      v_organiser, v_organisation, r.attendance, r.layout
    )
    returning event_id into v_event;
    -- The event's own times, as 15-minute slots (SPM-324).
    insert into public.event_slot (event_id, slot_date, slot_code)
    select v_event, d, n::text from generate_series(r.first_code, r.last_code) n;
  end loop;

  -- 13:00-18:00 is codes 52-71; 19:00-24:00 is 76-95.
  for r in
    select * from (values
      ('Re-request Test: Tech Summit',  'Main Hall', 52, 71),
      ('Re-request Test: Tech Summit',  'Studio',    52, 71),
      ('Re-request Test: Evening Gala', 'Main Hall', 76, 95)
    ) as b (event_name, venue, first_code, last_code)
  loop
    select event_id into v_event
      from public.event where name = r.event_name and client_organisation_id = v_organisation;

    insert into public.booking (
      venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status, room_layout_id
    )
    values (
      (select venue_id from public.venue where location = r.venue), v_event,
      (select assigned_coordinator_user_account_id from public.event where event_id = v_event),
      v_staff, 'Confirmed',
      (select room_layout_id from public.room_layout where name = 'Theatre')
    )
    returning booking_id into v_booking;
    insert into public.booking_slot (booking_id, slot_date, slot)
    select v_booking, d, n::text from generate_series(r.first_code, r.last_code) n;
  end loop;

  perform public.venue_staff_record_unavailability(
    v_staff, (select venue_id from public.venue where location = 'Main Hall'), 'Maintenance', null,
    (select jsonb_agg(jsonb_build_object('date', d, 'slot', n::text) order by n) from generate_series(52, 55) n));
  perform public.venue_staff_record_unavailability(
    v_staff, (select venue_id from public.venue where location = 'Studio'), 'Renovation', null,
    (select jsonb_agg(jsonb_build_object('date', d, 'slot', n::text) order by n) from generate_series(52, 71) n));
end $$;
