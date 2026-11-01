-- Checks the e2e data is complete and in the states seed.sql promises. Read-only. Every row must
-- read ok = true. Run by `pnpm e2e:data verify`, before testing: it looks at the whole database,
-- so anything a tester adds or changes afterwards shows up here.
--
--   supabase db query --file scripts/seed-e2e/verify.sql --local
--
-- One statement: the CLI refuses a file holding more than one.

with checks (check_name, expected, actual) as (
  -- Venues -------------------------------------------------------------------
  select 'the six standard venues', 'Main Hall, Rooftop Terrace, Seminar Room 2-1, Studio, UAT-44 Garden Hall, UAT-44 Harbour Room',
         (select string_agg(location, ', ' order by location) from public.venue)
  union all
  select 'venues missing a horizon, buffers, hours or layouts', 'none',
         coalesce((select string_agg(v.location, ', ' order by v.location) from public.venue v
                   where v.booking_horizon_days is null or v.setup_time_minutes is null
                      or not exists (select 1 from public.venue_slot s where s.venue_id = v.venue_id)
                      or not exists (select 1 from public.venue_supported_layout l where l.venue_id = v.venue_id)), 'none')
  union all
  select 'venue buffers as seeded', 'Main Hall 30/45, Rooftop Terrace 30/30, Seminar Room 2-1 15/15, Studio 0/0, UAT-44 Garden Hall 30/60, UAT-44 Harbour Room 15/30',
         (select string_agg(location || ' ' || setup_time_minutes || '/' || turnaround_time_minutes, ', ' order by location) from public.venue)
  -- Equipment ------------------------------------------------------------------
  union all
  select 'equipment owned, and out of service', 'Crowd barrier 40-2, Livestream kit 2-0, PA speaker 5-0, Presentation laptop 8-0, Projector 10-0, Wireless microphone 30-0',
         (select string_agg(type || ' ' || quantity || '-' || out_of_service, ', ' order by type) from public.equipment_item)
  -- Event requests -------------------------------------------------------------
  union all
  select 'event requests per status', 'Approved 7, Draft 1, Rejected 1, Returned 1, Submitted 1, Under Review 2, Withdrawn 1',
         (select string_agg(status || ' ' || n, ', ' order by status)
          from (select status, count(*) n from public.event_request group by status) t)
  union all
  select 'requests missing a detail or their times', 'none',
         coalesce((select string_agg(r.event_name, ', ' order by r.event_name) from public.event_request r
                   where r.description is null or r.purpose is null or r.preferred_date is null
                      or r.expected_attendance is null or r.venue_requirements is null
                      or r.accessibility_needs is null or r.equipment_requirements is null
                      or r.registration_requirements is null or r.room_layout_preferences is null
                      or r.general_programme is null or r.other_special_arrangements is null
                      or not exists (select 1 from public.event_request_slot s where s.event_request_id = r.event_request_id)), 'none')
  union all
  select 'decided requests without a reason', 'none',
         coalesce((select string_agg(event_name, ', ') from public.event_request
                   where status in ('Rejected', 'Withdrawn', 'Approved') and decision_record is null), 'none')
  union all
  select 'Returned requests with an open question', '1',
         (select count(*)::text from public.event_request r
          where r.status = 'Returned'
            and exists (select 1 from public.event_request_comment c
                        where c.event_request_id = r.event_request_id
                          and c.is_clarification_request and c.resolved_at is null))
  union all
  select 'requests past Submitted with no coordinator', 'none',
         coalesce((select string_agg(event_name, ', ') from public.event_request
                   where status not in ('Draft', 'Submitted') and assigned_coordinator_user_account_id is null), 'none')
  -- Events ---------------------------------------------------------------------
  union all
  select 'events per status', 'Cancelled 1, Completed 1, Confirmed 1, Planning 4',
         (select string_agg(status || ' ' || n, ', ' order by status)
          from (select status, count(*) n from public.event group by status) t)
  union all
  select 'events missing a detail, coordinator, request or slots', 'none',
         coalesce((select string_agg(e.name, ', ' order by e.name) from public.event e
                   where e.event_request_id is null or e.assigned_coordinator_user_account_id is null
                      or e.room_layout_preference is null or e.expected_attendance is null
                      or e.event_capacity is null or e.description is null or e.purpose is null
                      or e.programme_agenda is null or e.preferred_date is null
                      or e.required_facilities is null or e.category_type is null
                      or e.operational_notes is null
                      or not exists (select 1 from public.event_slot s where s.event_id = e.event_id)), 'none')
  union all
  select 'events with no booking', 'none',
         coalesce((select string_agg(e.name, ', ') from public.event e
                   where not exists (select 1 from public.booking b where b.event_id = e.event_id)), 'none')
  -- Bookings -------------------------------------------------------------------
  union all
  select 'bookings per status', 'Confirmed 4, Rejected 1, Released 1, Requested 1, Tentative Hold 1',
         (select string_agg(status || ' ' || n, ', ' order by status)
          from (select status, count(*) n from public.booking group by status) t)
  union all
  select 'bookings with no layout or no slots', 'none',
         coalesce((select string_agg(b.booking_id::text, ', ') from public.booking b
                   where b.room_layout_id is null
                      or not exists (select 1 from public.booking_slot s where s.booking_id = b.booking_id)), 'none')
  union all
  select 'bookings outside their venue''s opening hours', 'none',
         coalesce((select string_agg(distinct bs.booking_id::text, ', ') from public.booking_slot bs
                   where not exists (select 1 from public.venue_slot vs
                                     where vs.venue_id = bs.venue_id and vs.slot_code = bs.slot)), 'none')
  union all
  select 'live bookings too small for the event', 'none',
         coalesce((select string_agg(e.name, ', ') from public.booking b
                   join public.event e on e.event_id = b.event_id
                   join public.venue_supported_layout l on l.venue_id = b.venue_id and l.room_layout_id = b.room_layout_id
                   where b.status in ('Requested', 'Tentative Hold', 'Confirmed')
                     and l.capacity < e.expected_attendance), 'none')
  -- Blocks and flags -----------------------------------------------------------
  union all
  select 'venue blocks, and how many are lifted', '4, 1 lifted',
         (select count(*) || ', ' || count(lifted_at) || ' lifted' from public.venue_unavailability)
  union all
  select 'open flags', 'Year-End Town Hall at Main Hall',
         coalesce((select string_agg(e.name || ' at ' || v.location, ', ') from public.booking_review_flag f
                   join public.booking b on b.booking_id = f.booking_id
                   join public.event e on e.event_id = b.event_id
                   join public.venue v on v.venue_id = b.venue_id
                   where f.cleared_at is null), 'none')
  -- The Confirmed event --------------------------------------------------------
  union all
  select 'registrants on the Confirmed event', '3',
         (select count(*)::text from public.registration r
          join public.event e on e.event_id = r.event_id
          where e.status = 'Confirmed' and r.status = 'Registered')
  union all
  select 'pending change requests', 'Annual Customer Conference',
         coalesce((select string_agg(e.name, ', ') from public.change_request_item i
                   join public.change_request c on c.change_request_id = i.change_request_id
                   join public.event e on e.event_id = c.event_id
                   where i.decision = 'Pending'), 'none')
)
select check_name, expected, actual, expected = actual as ok
from checks
order by ok, check_name;
