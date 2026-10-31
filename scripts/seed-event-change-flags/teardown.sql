-- Undoes the SPM-309 fixture (seed.sql): deletes the "Event Change:" events with their bookings,
-- flags and change requests, by cascade.
--   supabase db query --file scripts/seed-event-change-flags/teardown.sql --local
delete from public.event
where name like 'Event Change: %'
  and client_organisation_id = (select client_organisation_id from public.user_account where name = 'Test Organiser')
returning name;
