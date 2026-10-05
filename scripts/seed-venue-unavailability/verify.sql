-- Checks that the venue unavailability seed (seed.sql in this directory) is in
-- place and untouched. Read-only.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-venue-unavailability/verify.sql --local
--
-- Prints one row per check, failures first. Every row should read ok = true.
-- A false row names what drifted: a block that was never seeded, or one
-- someone has since lifted or edited in the app. To start over, run
-- teardown.sql and then seed.sql. The bad-input checks (reason Holiday, a note
-- under Safety, a 501-character note) are in refusals.sql, because trying them
-- means writing.
--
-- One statement on purpose: `supabase db query --file` refuses a file holding
-- more than one, and exits 0 even when a query fails -- so read the rows, not
-- the exit code. The expected rows below must stay in step with seed.sql.

with block (venue, reason, expected) as (
  values ('Main Hall', 'Renovation',  '5 slots, In force'),
         ('Main Hall', 'Maintenance', '3 slots, In force'),
         ('Studio',    'Safety',      '1 slots, Lifted')
),
checks as (
  select 'block ' || b.venue || ' ' || b.reason as check_name, b.expected,
         coalesce((
           select count(s.*) || ' slots, '
                  || case when u.lifted_at is null then 'In force' else 'Lifted' end
           from public.venue_unavailability u
           join public.venue v on v.venue_id = u.venue_id
           left join public.venue_unavailability_slot s
             on s.venue_unavailability_id = u.venue_unavailability_id
           where v.location = b.venue and u.reason_category = b.reason
           group by u.venue_unavailability_id, u.lifted_at
           limit 1), 'missing') as actual
  from block b
  union all
  select 'Main Hall slot covered by two In force blocks', '1',
         (select count(*)::text from (
            select s.slot_date, s.slot
            from public.venue_unavailability_slot s
            join public.venue_unavailability u on u.venue_unavailability_id = s.venue_unavailability_id
            join public.venue v on v.venue_id = s.venue_id
            where v.location = 'Main Hall' and u.lifted_at is null
            group by s.slot_date, s.slot
            having count(*) = 2) two_blocks)
  union all
  select 'audit rows for the seeded blocks', '3 recorded, 1 lifted',
         (select count(*) filter (where a.action = 'recorded') || ' recorded, '
                 || count(*) filter (where a.action = 'lifted') || ' lifted'
          from public.audit_record a
          join public.venue_unavailability u on u.venue_unavailability_id = a.entity_id
          join public.venue v on v.venue_id = u.venue_id
          where a.entity_type = 'venue_unavailability'
            and ((v.location = 'Main Hall' and u.reason_category in ('Renovation', 'Maintenance'))
              or (v.location = 'Studio' and u.reason_category = 'Safety')))
)
select check_name, expected, actual, actual = expected as ok
from checks
order by ok, check_name;
