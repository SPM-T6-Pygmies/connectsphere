-- Checks that the equipment review seed (seed.sql in this directory) is in
-- place and untouched. Read-only.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-equipment-review/verify.sql --local
--
-- Prints one row per check, failures first. Every row should read ok = true.
-- A false row names what drifted: an event or line that was never seeded, or
-- one someone has since changed in the app. To start over, run teardown.sql
-- and then seed.sql.
--
-- One statement on purpose: `supabase db query --file` refuses a file holding
-- more than one, and exits 0 even when a query fails -- so read the rows, not
-- the exit code. The expected rows below must stay in step with seed.sql.

with organisation as (
  select client_organisation_id from public.user_account where name = 'Test Organiser'
),
catalogue (type, owned) as (
  values ('Projector', 10), ('Wireless microphone', 30), ('PA speaker', 5), ('Livestream kit', 2)
),
expected_events (name, expected) as (
  values ('Tech Summit Keynote',      '2026-11-15 Planning'),
         ('Alumni Networking Night',  '2026-12-03 Blocked'),
         ('Partner Roadshow',         'no date Confirmed'),
         ('Product Launch Rehearsal', '2026-11-14 Planning'),
         ('Board Strategy Day',       '2026-11-15 Confirmed'),
         ('Charity Gala Setup',       '2026-11-16 Blocked'),
         ('Year-End Town Hall',       '2026-11-17 Planning'),
         ('Autumn Workshop',          '2026-11-15 Cancelled'),
         ('Spring Conference',        '2026-09-20 Completed')
),
expected_lines (event, type, expected) as (
  values ('Tech Summit Keynote',      'Projector',           '4/0 Requested'),
         ('Tech Summit Keynote',      'Wireless microphone', '6/4 Under review, was 4'),
         ('Tech Summit Keynote',      'PA speaker',          '2/2 Under review, was 2, removal requested'),
         ('Alumni Networking Night',  'Livestream kit',      '1/0 Requested'),
         ('Partner Roadshow',         'Projector',           '2/0 Requested'),
         ('Product Launch Rehearsal', 'Projector',           '3/3 Reserved'),
         ('Board Strategy Day',       'Projector',           '2/2 Reserved'),
         ('Board Strategy Day',       'Wireless microphone', '2/2 Reserved'),
         ('Charity Gala Setup',       'Projector',           '1/1 Reserved'),
         ('Year-End Town Hall',       'Projector',           '5/5 Reserved'),
         ('Autumn Workshop',          'Projector',           '4/4 Reserved'),
         ('Autumn Workshop',          'Livestream kit',      '1/0 Requested'),
         ('Spring Conference',        'Wireless microphone', '2/2 Reserved')
),
checks as (
  select 'catalogue ' || c.type as check_name, c.owned || ' owned' as expected,
         coalesce((select quantity || ' owned' from public.equipment_item where type = c.type),
                  'missing') as actual
  from catalogue c
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
                  || coalesce(', was ' || l.reviewed_quantity_requested, '')
                  || case when l.removal_requested_at is not null then ', removal requested' else '' end
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
