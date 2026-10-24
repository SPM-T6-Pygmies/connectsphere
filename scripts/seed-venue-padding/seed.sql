-- SPM-19 manual tests: bookings at Main Hall (setup 30, turnaround 45) on fixed December 2026
-- dates, so Venue Staff can approve or hold a request and see the padded time refuse it.
-- Every event is named named for the case they serve and assigned to Test Coordinator. Run after
-- supabase db reset, seed-coordinator-view and seed-venues:
--
--   supabase db query --file scripts/seed-venue-padding/seed.sql --local
--
-- Re-running replaces everything it made. Undo with teardown.sql in this directory.
--
--   Mon 14 Dec  Charity Run  Confirmed 07:00-09:15, its turnaround keeps the room until 10:00
--               Spring Gala  Requested 10:00-12:00, setting up from 09:30  -> overlaps Charity Run
--               Book Fair    Requested 10:30-12:00, setting up from 10:00  -> only touches it
--   Tue 15 Dec  Quiz Night   Tentative Hold 07:00-09:15 (expires 30 days from now, so unexpired)
--               Open Mic     Requested 10:00-12:00                         -> overlaps the hold
--   Wed 16 Dec  Old Fete     Rejected 07:00-09:15, and Lapsed Fair, a hold that expired an hour ago
--               Wine Tasting Requested 10:00-12:00                         -> nothing live in the way
--   Thu 17 Dec  Night Gala   Confirmed 22:00-24:00, its turnaround runs to 00:45 on Fri 18 Dec
--   Fri 18 Dec  After Party  Requested 00:15-01:15, setting up from 23:45 on Thu 17 Dec
--   Sat 19 Dec  Race A       Requested 10:00-12:00 \ their padded times overlap, and neither has
--               Race B       Requested 12:15-14:00 / the room yet (for race.mjs)
-- A booking's 15-minute slot n starts n * 15 minutes after midnight: 28 is 07:00, 40 is 10:00.

do $$
declare
  v_venue bigint := (select venue_id from public.venue where location = 'Main Hall');
  v_staff bigint := (
    select ua.user_account_id
    from public.user_account ua
    join auth.users u on u.id = ua.auth_user_id
    where u.email = 'venue@test.com'
  );
  v_coordinator bigint := (
    select user_account_id from public.user_account
    where name = 'Test Coordinator' and client_organisation_id is null
  );
  v_organiser bigint;
  v_organisation bigint;
  c record;
  v_event bigint;
  v_booking bigint;
begin
  select user_account_id, client_organisation_id into v_organiser, v_organisation
    from public.user_account where name = 'Test Organiser';

  if v_venue is null then
    raise exception 'Main Hall is missing' using hint = 'Run seed-venues first.';
  end if;
  if v_staff is null or v_coordinator is null or v_organiser is null then
    raise exception 'The test accounts are missing' using hint = 'Run supabase db reset first.';
  end if;

  delete from public.event where name like '%' and client_organisation_id = v_organisation;

  for c in
    select * from (values
      ('Charity Run',  date '2026-12-14', 28, 36, 'Confirmed'),
      ('Spring Gala',  date '2026-12-14', 40, 47, 'Requested'),
      ('Book Fair',    date '2026-12-14', 42, 47, 'Requested'),
      ('Quiz Night',   date '2026-12-15', 28, 36, 'Hold'),
      ('Open Mic',     date '2026-12-15', 40, 47, 'Requested'),
      ('Old Fete',     date '2026-12-16', 28, 36, 'Rejected'),
      ('Lapsed Fair',  date '2026-12-16', 28, 36, 'LapsedHold'),
      ('Wine Tasting', date '2026-12-16', 40, 47, 'Requested'),
      ('Night Gala',   date '2026-12-17', 88, 95, 'Confirmed'),
      ('After Party',  date '2026-12-18', 1, 4, 'Requested'),
      ('Race A',       date '2026-12-19', 40, 47, 'Requested'),
      ('Race B',       date '2026-12-19', 49, 55, 'Requested')
    ) as t (event_name, day, first_slot, last_slot, state)
  loop
    insert into public.event (
      name, preferred_date, status, assigned_coordinator_user_account_id,
      owning_organiser_user_account_id, client_organisation_id
    )
    values (c.event_name, c.day, 'Planning', v_coordinator, v_organiser, v_organisation)
    returning event_id into v_event;

    insert into public.booking (venue_id, event_id, requested_by_user_account_id)
    values (v_venue, v_event, v_coordinator)
    returning booking_id into v_booking;
    insert into public.booking_slot (booking_id, slot_date, slot)
    select v_booking, c.day, n::text from generate_series(c.first_slot, c.last_slot) n;

    if c.state = 'Confirmed' then
      update public.booking set status = 'Confirmed', decided_by_user_account_id = v_staff where booking_id = v_booking;
    elsif c.state = 'Hold' then
      update public.booking set status = 'Tentative Hold', decided_by_user_account_id = v_staff,
             hold_expires_at = now() + interval '30 days' where booking_id = v_booking;
    elsif c.state = 'LapsedHold' then
      update public.booking set status = 'Tentative Hold', decided_by_user_account_id = v_staff,
             hold_expires_at = now() - interval '1 hour' where booking_id = v_booking;
    elsif c.state = 'Rejected' then
      update public.booking set status = 'Rejected', decided_by_user_account_id = v_staff,
             rejection_note = 'Not needed' where booking_id = v_booking;
    end if;
  end loop;
end $$;
