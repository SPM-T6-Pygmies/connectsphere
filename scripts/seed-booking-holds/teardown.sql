-- Undoes the booking-holds seed (seed.sql in this directory): deletes "Holds Test Event";
-- its two holds go with it, by cascade. Also deletes the Rooftop Terrace block fixture.sql
-- records (Renovation, 15 December 2026, T + 6) and its audit rows; fixture.sql's bookings are on
-- the Founders' Gala Dinner and go with seed-equipment's teardown.
--
--   supabase db query --file scripts/seed-booking-holds/teardown.sql --local
--
-- One statement: the CLI refuses a file with more than one.

with event as (
  delete from public.event
  where name = 'Holds Test Event'
    and client_organisation_id = (select client_organisation_id from public.user_account where name = 'Test Organiser')
  returning 1
),
doomed as (
  select u.venue_unavailability_id
  from public.venue_unavailability u
  join public.venue v on v.venue_id = u.venue_id
  where v.location = 'Rooftop Terrace' and u.reason_category = 'Renovation'
    and exists (select 1 from public.venue_unavailability_slot s
                where s.venue_unavailability_id = u.venue_unavailability_id
                  and s.slot_date = date '2026-12-15')
),
audit as (
  delete from public.audit_record a
  using doomed d
  where a.entity_type = 'venue_unavailability' and a.entity_id = d.venue_unavailability_id
  returning 1
),
blocks as (
  delete from public.venue_unavailability u
  using doomed d
  where u.venue_unavailability_id = d.venue_unavailability_id
  returning 1
)
select (select count(*) from event)  as events_deleted,
       (select count(*) from blocks) as blocks_deleted,
       (select count(*) from audit)  as audit_rows_deleted;
