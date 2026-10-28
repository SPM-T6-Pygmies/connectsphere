-- Undoes the venue calendar seed (seed.sql in this directory): deletes "Calendar Test Event";
-- its two bookings go with it, by cascade.
--
--   supabase db query --file scripts/seed-venue-calendar/teardown.sql --local

delete from public.event
where name = 'Calendar Test Event'
  and client_organisation_id = (select client_organisation_id from public.user_account where name = 'Test Organiser');
