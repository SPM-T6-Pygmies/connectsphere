-- Checks that the SPM-274 reserve seed (seed.sql in this directory) is in
-- place and untouched. Read-only.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-equipment-reserve/verify.sql --local
--
-- Prints one row per check, failures first. Every row should read ok = true.
-- A false row names what drifted: an event or line that was never seeded, or
-- one someone has since reserved or changed in the app. To start over, run
-- teardown.sql and then seed.sql.
--
-- One statement on purpose: `supabase db query --file` refuses a file holding
-- more than one, and exits 0 even when a query fails -- so read the rows, not
-- the exit code. The expected rows below must stay in step with seed.sql.

with organisation as (
  select client_organisation_id from public.user_account where name = 'Test Organiser'
),
expected_items (type, expected) as (
  values ('Wireless presenter', '6 owned, 0 out of service'),
         ('Confidence monitor', '3 owned, 0 out of service'),
         ('Lapel microphone',   '10 owned, 0 out of service')
),
expected_events (name, expected) as (
  values ('Design Sprint Demo', '2026-11-20 Planning'),
         ('Sales Kickoff',      '2026-11-21 Planning'),
         ('Board Offsite',      '2026-11-20 Confirmed'),
         ('Press Briefing',     'no date Planning')
),
expected_lines (event, type, expected) as (
  values ('Design Sprint Demo', 'Wireless presenter', '4/0 Requested'),
         ('Design Sprint Demo', 'Confidence monitor', '2/0 Requested'),
         ('Sales Kickoff',      'Wireless presenter', '3/0 Requested'),
         ('Sales Kickoff',      'Lapel microphone',   '2/0 Requested'),
         ('Board Offsite',      'Confidence monitor', '2/0 Requested'),
         ('Press Briefing',     'Wireless presenter', '1/0 Requested')
),
checks as (
  select 'catalogue ' || x.type as check_name, x.expected,
         coalesce((
           select i.quantity || ' owned, ' || i.out_of_service || ' out of service'
           from public.equipment_item i where i.type = x.type
         ), 'missing') as actual
  from expected_items x
  union all
  select 'event ' || x.name, x.expected,
         coalesce((
           select coalesce(e.preferred_date::text, 'no date') || ' ' || e.status
           from public.event e
           where e.name = x.name and e.client_organisation_id = (select client_organisation_id from organisation)
         ), 'missing')
  from expected_events x
  union all
  select 'line ' || x.event || ' / ' || x.type, x.expected,
         coalesce((
           select l.quantity_requested || '/' || l.quantity_reserved || ' ' || l.line_state
           from public.equipment_reservation_line l
           join public.equipment_reservation r on r.equipment_reservation_id = l.equipment_reservation_id
           join public.event e on e.event_id = r.event_id
           join public.equipment_item i on i.equipment_item_id = l.equipment_item_id
           where e.name = x.event and i.type = x.type
             and e.client_organisation_id = (select client_organisation_id from organisation)
         ), 'missing')
  from expected_lines x
)
select check_name, expected, actual, expected = actual as ok
from checks
order by ok, check_name;
