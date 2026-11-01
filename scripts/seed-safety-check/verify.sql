-- Checks that the safety check seed (seed.sql in this directory) is in place
-- and untouched. Read-only.
--
-- Run against a local stack:
--   supabase db query --file scripts/seed-safety-check/verify.sql --local
--
-- Prints one row per check, failures first. Every row should read ok = true.
-- A false row names what drifted: an event, booking or line that was never
-- seeded, or one someone has since changed in the app (an outcome recorded, a
-- booking decided, the demo's projector line removed). To start over, run
-- teardown.sql and then seed.sql.
--
-- One statement on purpose: `supabase db query --file` refuses a file holding
-- more than one, and exits 0 even when a query fails -- so read the rows, not
-- the exit code. The expected rows below must stay in step with seed.sql.

with organisation as (
  select client_organisation_id from public.user_account where name = 'Test Organiser'
),
expected_events (name, expected) as (
  values ('Marina Bay Gala',     '2026-12-18 Planning 220 Test Coordinator'),
         ('Canal Side Workshop', 'no date Planning no attendance Test Coordinator'),
         ('Winter Lantern Ball', '2026-12-05 Planning 90 Test Coordinator 2'),
         ('Harbour Dawn Run',    '2026-12-12 Planning 150 no coordinator'),
         ('Lakeside Tech Expo',  '2026-12-03 Planning 300 Test Coordinator'),
         ('Charity Book Fair',   '2026-12-19 Planning 300 Test Coordinator'),
         ('Spring Lantern Walk', '2026-12-05 Planning 120 Test Coordinator'),
         ('Rooftop Jazz Night',  'no date Planning no attendance Test Coordinator')
),
expected_bookings (event, location, expected) as (
  values ('Marina Bay Gala',     'Main Hall',        'Banquet Confirmed'),
         ('Canal Side Workshop', 'Seminar Room 2-1', 'Classroom Confirmed'),
         ('Winter Lantern Ball', 'Studio',           'Theatre Confirmed'),
         ('Harbour Dawn Run',    'Rooftop Terrace',  'Exhibition Confirmed'),
         ('Lakeside Tech Expo',  'Main Hall',        'Theatre Tentative Hold'),
         ('Charity Book Fair',   'Main Hall',        'Theatre Confirmed'),
         ('Spring Lantern Walk', 'Main Hall',        'Banquet Requested'),
         ('Spring Lantern Walk', 'Rooftop Terrace',  'Banquet Requested'),
         ('Rooftop Jazz Night',  'Rooftop Terrace',  'Banquet Confirmed'),
         ('Rooftop Jazz Night',  'Seminar Room 2-1', 'Classroom Requested')
),
expected_lines (event, type, expected) as (
  values ('Marina Bay Gala',   'Wireless microphone', '4/4 Reserved'),
         ('Marina Bay Gala',   'Crowd barrier',       '10/10 Reserved'),
         ('Charity Book Fair', 'Projector',           '2/0 Requested essential')
),
checks as (
  select 'event ' || x.name as check_name, x.expected,
         coalesce((
           select coalesce(e.preferred_date::text, 'no date') || ' ' || e.status || ' '
                  || coalesce(e.expected_attendance::text, 'no attendance') || ' '
                  || coalesce(c.name, 'no coordinator')
           from public.event e
           left join public.user_account c on c.user_account_id = e.assigned_coordinator_user_account_id
           where e.name = x.name
             and e.client_organisation_id = (select client_organisation_id from organisation)
         ), 'missing') as actual
  from expected_events x
  union all
  select 'booking ' || x.event || ' / ' || x.location, x.expected,
         coalesce((
           select rl.name || ' ' || b.status
           from public.booking b
           join public.event e on e.event_id = b.event_id
           join public.venue v on v.venue_id = b.venue_id
           left join public.room_layout rl on rl.room_layout_id = b.room_layout_id
           where e.name = x.event and v.location = x.location
             and e.client_organisation_id = (select client_organisation_id from organisation)
         ), 'missing')
  from expected_bookings x
  union all
  select 'line ' || x.event || ' / ' || x.type, x.expected,
         coalesce((
           select l.quantity_requested || '/' || l.quantity_reserved || ' ' || l.line_state
                  || case when l.essential then ' essential' else '' end
           from public.equipment_reservation_line l
           join public.equipment_reservation r on r.equipment_reservation_id = l.equipment_reservation_id
           join public.event e on e.event_id = r.event_id
           join public.equipment_item i on i.equipment_item_id = l.equipment_item_id
           where e.name = x.event and i.type = x.type
             and e.client_organisation_id = (select client_organisation_id from organisation)
         ), 'missing')
  from expected_lines x
  union all
  select 'no outcome recorded on ' || x.name, '0',
         (select count(*)::text
          from public.safety_check s
          join public.event e on e.event_id = s.event_id
          where e.name = x.name
            and e.client_organisation_id = (select client_organisation_id from organisation))
  from expected_events x
)
select check_name, expected, actual, expected = actual as ok
from checks
order by ok, check_name;
