-- Checks that the equipment seed (seed.sql in this directory) is in place and
-- untouched. Read-only.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-equipment/verify.sql --local
--
-- Prints one row per check, failures first. Every row should read ok = true.
-- A false row names what drifted: a catalogue item or line that was never
-- seeded, or a line someone has since edited or removed in the app. To start
-- over, run teardown.sql and then seed.sql.
--
-- One statement on purpose: `supabase db query --file` refuses a file holding
-- more than one, and exits 0 even when a query fails -- so read the rows, not
-- the exit code. The expected rows below must stay in step with seed.sql.

with event as (
  select e.event_id, e.status, e.assigned_coordinator_user_account_id
  from public.event e
  join public.event_request r on r.event_request_id = e.event_request_id
  where r.event_name = 'Founders'' Gala Dinner'
),
catalogue (type) as (
  values ('Projector'), ('Wireless microphone'), ('PA speaker'),
         ('Presentation laptop'), ('Livestream kit')
),
lines (type, expected) as (
  values ('Projector',           '2 requested, 2 reserved, Reserved'),
         ('Wireless microphone', '4 requested, 0 reserved, Requested')
),
checks as (
  select 'catalogue ' || c.type as check_name, 'present' as expected,
         case when i.equipment_item_id is null then 'missing' else 'present' end as actual
  from catalogue c
  left join public.equipment_item i on i.type = c.type
  union all
  select 'event Founders'' Gala Dinner', 'Planning, assigned to Test Coordinator',
         coalesce((
           select e.status || case
             when e.assigned_coordinator_user_account_id = (
               select user_account_id from public.user_account
               where name = 'Test Coordinator' and client_organisation_id is null)
             then ', assigned to Test Coordinator'
             else ', assigned to user_account ' || coalesce(e.assigned_coordinator_user_account_id::text, 'none')
           end
           from event e), 'missing')
  union all
  select 'line ' || l.type, l.expected,
         coalesce((
           select x.quantity_requested || ' requested, ' || x.quantity_reserved || ' reserved, '
                  || x.line_state
           from event e
           join public.equipment_reservation r on r.event_id = e.event_id
           join public.equipment_reservation_line x on x.equipment_reservation_id = r.equipment_reservation_id
           join public.equipment_item i on i.equipment_item_id = x.equipment_item_id
           where i.type = l.type), 'missing')
  from lines l
)
select check_name, expected, actual, actual = expected as ok
from checks
order by ok, check_name;
