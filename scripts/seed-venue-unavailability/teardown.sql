-- Undoes the venue unavailability seed (seed.sql in this directory): deletes
-- the three seeded blocks (their slot rows go with them, by cascade) and the
-- audit rows they wrote. It matches on venue and reason, so a block you
-- recorded yourself on Main Hall as Renovation or Maintenance, or on Studio
-- as Safety, goes too.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-venue-unavailability/teardown.sql --local
--
-- One statement: a CTE deletes the audit rows and the blocks together, and
-- audit_record has no foreign key to a block, so the order does not matter.

with doomed as (
  select u.venue_unavailability_id
  from public.venue_unavailability u
  join public.venue v on v.venue_id = u.venue_id
  where (v.location = 'Main Hall' and u.reason_category in ('Renovation', 'Maintenance'))
     or (v.location = 'Studio'    and u.reason_category = 'Safety')
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
select (select count(*) from blocks) as blocks_deleted,
       (select count(*) from audit)  as audit_rows_deleted;
