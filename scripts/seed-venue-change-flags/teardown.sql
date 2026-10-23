-- Undoes the venue-change seed (seed.sql in this directory): deletes every "Venue Change:"
-- event (its bookings and their flags go with it, by cascade) and Change Test Hall, under
-- whatever name the cases left it.
--
--   supabase db query --file scripts/seed-venue-change-flags/teardown.sql --local

with events as (
  delete from public.event
  where name like 'Venue Change: %'
    and client_organisation_id = (select client_organisation_id from public.user_account where name = 'Test Organiser')
  returning 1
)
select (select count(*) from events) as events_deleted;

delete from public.venue v
where v.location like 'Change Test Hall%'
  and not exists (select 1 from public.booking b where b.venue_id = v.venue_id);
