-- Undoes the booking-holds seed (seed.sql in this directory): deletes "Holds Test Event";
-- its two holds go with it, by cascade.
--
--   supabase db query --file scripts/seed-booking-holds/teardown.sql --local

delete from public.event
where name = 'Holds Test Event'
  and client_organisation_id = (select client_organisation_id from public.user_account where name = 'Test Organiser');
