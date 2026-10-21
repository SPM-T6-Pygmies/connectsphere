-- Seeds the venue booking cancel cases (SPM-20, docs/testing/VENUE_BOOKING_CANCEL_MANUAL_TESTS.md):
-- five bookings on the Founders' Gala Dinner, one in each status the Request a venue page
-- treats differently.
--
--   Booking  Venue                Day, slot  Status          What it is for
--   P        UAT-44 Harbour Room  C, AM      Confirmed       cancelled in TC-VCANCEL-001; its calendar cell
--                                                            turns Available
--   Q        UAT-44 Harbour Room  C, Night   Confirmed       kept in TC-VCANCEL-002, cancelled from two tabs
--                                                            in TC-VCANCEL-005
--   R        UAT-44 Garden Hall   C, AM      Requested       a pending request, cancelled in TC-VCANCEL-003
--   S        UAT-44 Garden Hall   C, PM      Tentative Hold  a hold, also cancellable (TC-VCANCEL-003)
--   U        UAT-44 Harbour Room  C + 1, AM  Rejected        holds nothing, so offers no button
--
-- C is 10 days from today, Singapore time: inside the UAT-44 venues' 60-day booking horizon,
-- and clear of day D (14 days out), where seed-venue-search-uat puts its own two bookings.
-- The UAT-44 venues are used because they are the only ones that offer slots, so their
-- calendar shows a freed slot as Available rather than Not offered.
--
-- Run after the reset and seed-coordinator-view, seed-venues, seed-venue-search-uat and
-- seed-equipment (which opens the Founders' Gala Dinner):
--
--   supabase db query --file scripts/seed-booking-cancel/seed.sql --local
--
-- Safe to run more than once: a booking already on its venue, day and slot for the event is
-- left as it is, so one you have since cancelled stays Released. For a fresh start, run
-- teardown.sql first. verify.sql checks the seeded state.

do $$
declare
  v_event bigint := (select event_id from public.event where name = 'Founders'' Gala Dinner');
  v_coord bigint := (select user_account_id from public.user_account
                     where name = 'Test Coordinator' and client_organisation_id is null);
  v_staff bigint := (select user_account_id from public.user_account
                     where name = 'Test Venue Staff' and client_organisation_id is null);
  c date := (now() at time zone 'Asia/Singapore')::date + 10;
  v_venue bigint;
  v_id bigint;
  r record;
begin
  if v_event is null or v_coord is null or v_staff is null
     or (select count(*) from public.venue
         where location in ('UAT-44 Harbour Room', 'UAT-44 Garden Hall')) < 2 then
    raise exception 'Missing: %',
      concat_ws(', ',
        case when v_coord is null or v_staff is null then 'the test accounts' end,
        case when v_event is null then 'the Founders'' Gala Dinner event (run seed-equipment)' end,
        case when (select count(*) from public.venue
                   where location in ('UAT-44 Harbour Room', 'UAT-44 Garden Hall')) < 2
             then 'the UAT-44 venues (run seed-venue-search-uat)' end)
      using hint = 'Run supabase db reset, then the seeds listed at the top of this file.';
  end if;

  for r in
    select * from (values
      ('UAT-44 Harbour Room', c,     'AM',    'Confirmed'),       -- P
      ('UAT-44 Harbour Room', c,     'Night', 'Confirmed'),       -- Q
      ('UAT-44 Garden Hall',  c,     'AM',    'Requested'),       -- R
      ('UAT-44 Garden Hall',  c,     'PM',    'Tentative Hold'),  -- S
      ('UAT-44 Harbour Room', c + 1, 'AM',    'Rejected')         -- U
    ) as v(venue, slot_date, slot, status)
  loop
    v_venue := (select venue_id from public.venue where location = r.venue);

    if not exists (
      select 1
      from public.booking b
      join public.booking_slot bs on bs.booking_id = b.booking_id
      where b.event_id = v_event and b.venue_id = v_venue
        and bs.slot_date = r.slot_date and bs.slot = r.slot
    ) then
      insert into public.booking (
        venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id,
        status, rejection_note, hold_expires_at
      )
      values (
        v_venue, v_event, v_coord,
        case when r.status = 'Requested' then null else v_staff end,
        r.status,
        case when r.status = 'Rejected' then 'The room is being repainted that day.' end,
        case when r.status = 'Tentative Hold' then now() + interval '72 hours' end
      )
      returning booking_id into v_id;
      insert into public.booking_slot (booking_id, slot_date, slot) values (v_id, r.slot_date, r.slot);
    end if;
  end loop;
end $$;
