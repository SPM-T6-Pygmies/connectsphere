-- Removes what the SPM-44 venue search UAT seed (seed.sql in this directory)
-- created: the two "UAT-44" events (their bookings cascade), then the two
-- "UAT-44" venues (their layouts cascade).
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-venue-search-uat/teardown.sql --local
--
-- One statement on purpose: `supabase db query --file` refuses a file holding
-- more than one.

with events as (
  delete from public.event where name like 'UAT-44 %' returning event_id
)
delete from public.venue
where location like 'UAT-44 %'
  -- Reference the CTE so it runs first; its bookings cascade with the events.
  and (select count(*) from events) >= 0;
