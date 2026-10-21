-- Undoes the booking-flags seed (seed.sql in this directory): deletes every "Flag Test:"
-- event (its bookings go with it, by cascade) and every block on Main Hall, Studio or Rooftop Terrace that
-- touches 27 to 38 days from today (the days the cases use), together with the audit rows
-- those blocks wrote. Blocks on other venues or other days are left alone.
--
--   supabase db query --file scripts/seed-booking-flags/teardown.sql --local
--
-- Run it, then seed.sql, to start the cases again without a database reset.

with doomed as (
  select distinct u.venue_unavailability_id
  from public.venue_unavailability u
  join public.venue_unavailability_slot us on us.venue_unavailability_id = u.venue_unavailability_id
  join public.venue v on v.venue_id = u.venue_id
  where v.location in ('Main Hall', 'Studio', 'Rooftop Terrace')
    and us.slot_date between (now() at time zone 'Asia/Singapore')::date + 27
                         and (now() at time zone 'Asia/Singapore')::date + 38
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
),
events as (
  delete from public.event
  where name like 'Flag Test: %'
    and client_organisation_id = (select client_organisation_id from public.user_account where name = 'Test Organiser')
  returning 1
)
select (select count(*) from events) as events_deleted,
       (select count(*) from blocks) as blocks_deleted,
       (select count(*) from audit)  as audit_rows_deleted;
