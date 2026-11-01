-- Removes what seed.sql created: its event requests and events, with everything that cascades
-- from them, its venue blocks and their audit records. Never touches venues or equipment.
--
--   supabase db query --file scripts/seed-e2e/teardown.sql --local
--
-- Safe to run more than once. One `do` block: the CLI refuses a file holding more than one
-- statement.

do $$
declare
  v_names text[] := array[
    'Spring Leadership Offsite', 'Quarterly Partner Briefing', 'Customer Advisory Day',
    'Graduate Intake Welcome', 'Supplier Awards Lunch', 'Rooftop Product Launch',
    'Team Volunteering Day', 'Winter Networking Mixer', 'Year-End Town Hall',
    'Client Appreciation Dinner', 'Product Roadmap Workshop', 'Annual Customer Conference',
    'Autumn Partner Summit', 'Holiday Charity Gala'
  ];
  v_requests bigint[];
  v_events   bigint[];
  v_bookings bigint[];
  v_reservations bigint[];
  v_blocks   bigint[];
begin
  select array_agg(event_request_id) into v_requests
  from public.event_request where event_name = any (v_names);
  select array_agg(event_id) into v_events
  from public.event where event_request_id = any (v_requests);
  select array_agg(booking_id) into v_bookings
  from public.booking where event_id = any (v_events);
  select array_agg(equipment_reservation_id) into v_reservations
  from public.equipment_reservation where event_id = any (v_events);

  -- A block is matched by its venue, reason and exact dates, so a block recorded by hand on the
  -- same venue stays.
  select array_agg(u.venue_unavailability_id) into v_blocks
  from public.venue_unavailability u
  join public.venue vn on vn.venue_id = u.venue_id
  join (values
    ('Studio',           'Safety',            date '2026-12-05', date '2026-12-05'),
    ('Seminar Room 2-1', 'Maintenance',       date '2026-12-09', date '2026-12-09'),
    ('Main Hall',        'Equipment failure', date '2026-12-10', date '2026-12-10'),
    ('Rooftop Terrace',  'Renovation',        date '2026-12-21', date '2026-12-23')
  ) as t (location, reason, first_date, last_date)
    on t.location = vn.location and t.reason = u.reason_category
  where (select min(s.slot_date) from public.venue_unavailability_slot s
         where s.venue_unavailability_id = u.venue_unavailability_id) = t.first_date
    and (select max(s.slot_date) from public.venue_unavailability_slot s
         where s.venue_unavailability_id = u.venue_unavailability_id) = t.last_date;

  delete from public.audit_record
  where (entity_type = 'event_request' and entity_id = any (v_requests))
     or (entity_type = 'event' and entity_id = any (v_events))
     or (entity_type = 'booking' and entity_id = any (v_bookings))
     or (entity_type = 'equipment_reservation' and entity_id = any (v_reservations))
     or (entity_type = 'venue_unavailability' and entity_id = any (v_blocks));

  delete from public.venue_unavailability where venue_unavailability_id = any (v_blocks);
  delete from public.event where event_id = any (v_events);
  delete from public.event_request where event_request_id = any (v_requests);
end;
$$;
