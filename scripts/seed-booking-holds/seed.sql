-- SPM-46 / SPM-22 manual tests: two Tentative Holds at Main Hall on 2026-12-01.
--
--   AM  expired an hour ago      -- must not block (TC-VENUE-BOOK-019)
--   PM  expires in thirty days   -- must block    (TC-VENUE-BOOK-020)
--
-- Holds have no UI until SPM-218, so they are inserted here. Run after
-- seed-coordinator-view and seed-venues, once coordinator@test.com has
-- approved a request so at least one event exists:
--
--   supabase db query --file scripts/seed-booking-holds/seed.sql --local
--
-- Re-running replaces the two holds, with expiries measured from now again.

do $$
declare
  v_event bigint := (select min(event_id) from public.event);
  v_venue bigint := (select venue_id from public.venue where location = 'Main Hall');
  v_staff bigint := (
    select ua.user_account_id
    from public.user_account ua
    join auth.users u on u.id = ua.auth_user_id
    where u.email = 'venue@test.com'
  );
  v_hold bigint;
begin
  if v_event is null or v_venue is null or v_staff is null then
    raise exception 'Run seed-venues and approve a request as coordinator@test.com first';
  end if;

  delete from public.booking b
  where b.venue_id = v_venue
    and b.status = 'Tentative Hold'
    and exists (
      select 1 from public.booking_slot bs
      where bs.booking_id = b.booking_id and bs.slot_date = '2026-12-01'
    );

  insert into public.booking
    (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status, hold_expires_at)
  values (v_venue, v_event, v_staff, v_staff, 'Tentative Hold', now() - interval '1 hour')
  returning booking_id into v_hold;
  insert into public.booking_slot (booking_id, slot_date, slot) values (v_hold, '2026-12-01', 'AM');

  insert into public.booking
    (venue_id, event_id, requested_by_user_account_id, decided_by_user_account_id, status, hold_expires_at)
  values (v_venue, v_event, v_staff, v_staff, 'Tentative Hold', now() + interval '30 days')
  returning booking_id into v_hold;
  insert into public.booking_slot (booking_id, slot_date, slot) values (v_hold, '2026-12-01', 'PM');
end $$;
