-- Undoes the event cancel seed (seed.sql in this directory) and what the cases did: deletes the
-- Founders' Gala Dinner's bookings at the two UAT-44 venues (seed-booking-cancel's five and L;
-- their slots go by cascade) and puts the event back in Planning. Its audit rows stay as the
-- record of the run. Then run seed-booking-cancel/seed.sql and this directory's seed.sql again.
--
--   supabase db query --file scripts/seed-event-cancel/teardown.sql --local
--
-- One statement on purpose: `supabase db query --file` refuses a file holding more than one.

with founders as (
  update public.event
  set status = 'Planning'
  where name = 'Founders'' Gala Dinner'
  returning event_id
)
delete from public.booking
where event_id = (select event_id from founders)
  and venue_id in (select venue_id from public.venue
                   where location in ('UAT-44 Harbour Room', 'UAT-44 Garden Hall'));
