-- Undoes the venue booking cancel seed (seed.sql in this directory): deletes the Founders'
-- Gala Dinner's bookings at the two UAT-44 venues; their slots go with them, by cascade. That
-- includes any you requested there while running the cases. The event and the venues are
-- left in place: they are seed-equipment's and seed-venue-search-uat's.
--
--   supabase db query --file scripts/seed-booking-cancel/teardown.sql --local

delete from public.booking
where event_id = (select event_id from public.event where name = 'Founders'' Gala Dinner')
  and venue_id in (select venue_id from public.venue
                   where location in ('UAT-44 Harbour Room', 'UAT-44 Garden Hall'));
