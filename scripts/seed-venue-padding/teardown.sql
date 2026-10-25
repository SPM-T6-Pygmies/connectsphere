-- Removes what seed.sql made: its thirteen events and, with them, their bookings.
--   supabase db query --file scripts/seed-venue-padding/teardown.sql --local
delete from public.event
where name in ('Charity Run', 'Spring Gala', 'Book Fair', 'Early Bird', 'Quiz Night', 'Open Mic', 'Old Fete', 'Lapsed Fair', 'Wine Tasting', 'Night Gala', 'After Party', 'Race A', 'Race B')
  and client_organisation_id = (select client_organisation_id from public.user_account where name = 'Test Organiser');
