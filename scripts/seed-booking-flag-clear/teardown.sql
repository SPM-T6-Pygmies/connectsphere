-- Undoes the SPM-310 cases: the Harbour Room blocks on C (17 December 2026) and every flag row on the
-- Founders' Gala Dinner's bookings, so blocks.sql can be run again. Leaves the bookings to
-- seed-booking-cancel (its teardown.sql removes them).
--
--   supabase db query --file scripts/seed-booking-flag-clear/teardown.sql --local

with doomed as (
  select distinct u.venue_unavailability_id
  from public.venue_unavailability u
  join public.venue_unavailability_slot us on us.venue_unavailability_id = u.venue_unavailability_id
  join public.venue v on v.venue_id = u.venue_id
  where v.location = 'UAT-44 Harbour Room'
    and us.slot_date = date '2026-12-17'
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
flags as (
  delete from public.booking_review_flag f
  using public.booking b, public.event e
  where b.booking_id = f.booking_id and e.event_id = b.event_id
    and e.name = 'Founders'' Gala Dinner'
  returning 1
)
select (select count(*) from blocks) as blocks_deleted,
       (select count(*) from flags) as flags_deleted;
