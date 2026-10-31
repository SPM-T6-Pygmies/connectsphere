-- Checks that the venue booking cancel seed (seed.sql in this directory) is in place and
-- untouched. Read-only.
--
--   supabase db query --file scripts/seed-booking-cancel/verify.sql --local
--
-- Prints one row per check, failures first. Every row should read ok = true. A false row
-- names a booking that was never seeded, or one someone has since changed in the app (a
-- cancellation, a decision). To start over, run teardown.sql and then seed.sql.
--
-- One statement on purpose: `supabase db query --file` refuses a file holding more than one,
-- and exits 0 even when a query fails -- so read the rows, not the exit code. The expected
-- rows below must stay in step with seed.sql.

with c as (
  select date '2026-12-17' as day
),
expected (booking, venue, slot_date, starts, ends, status) as (
  select 'P', 'UAT-44 Harbour Room', day,     time '07:00', time '12:00', 'Confirmed'      from c union all
  select 'Q', 'UAT-44 Harbour Room', day,     time '19:00', time '24:00', 'Confirmed'      from c union all
  select 'R', 'UAT-44 Garden Hall',  day,     time '07:00', time '12:00', 'Requested'      from c union all
  select 'S', 'UAT-44 Garden Hall',  day,     time '13:00', time '18:00', 'Tentative Hold' from c union all
  select 'U', 'UAT-44 Harbour Room', day + 1, time '07:00', time '12:00', 'Rejected'       from c
),
actual as (
  -- A booking's 15-minute slots read back as the time they fill, once per booking (SPM-324).
  select b.booking_id, v.location as venue, bs.slot_date,
         min(sl.start_time) as starts, max(sl.end_time) as ends, b.status, b.hold_expires_at
  from public.booking b
  join public.event e on e.event_id = b.event_id
  join public.venue v on v.venue_id = b.venue_id
  join public.booking_slot bs on bs.booking_id = b.booking_id
  join public.slot sl on sl.slot_code = bs.slot
  where e.name = 'Founders'' Gala Dinner'
  group by b.booking_id, v.location, bs.slot_date, b.status, b.hold_expires_at
),
checks as (
  select
    format('booking %s: %s %s %s-%s is %s', x.booking, x.venue, x.slot_date,
           to_char(x.starts, 'HH24:MI'), case when x.ends = time '24:00' then '24:00' else to_char(x.ends, 'HH24:MI') end,
           x.status) as "check",
    coalesce(string_agg(a.status, ', '), 'missing') as found,
    count(a.status) = 1 and bool_and(a.status = x.status)
      and bool_and(x.status <> 'Tentative Hold' or a.hold_expires_at > now()) as ok
  from expected x
  left join actual a
    on a.venue = x.venue and a.slot_date = x.slot_date and a.starts = x.starts and a.ends = x.ends
  group by x.booking, x.venue, x.slot_date, x.starts, x.ends, x.status
  union all
  -- Opening hours are 15-minute slot codes '0'-'95' (SPM-320): 07:00-24:00 is 28-95.
  select 'UAT-44 Harbour Room is open 07:00-24:00',
         format('%s of 68 slots', count(*) filter (where vs.slot_code in (
           select generate_series(28, 95)::text))),
         count(*) filter (where vs.slot_code in (select generate_series(28, 95)::text)) = 68
  from public.venue_slot vs
  join public.venue v on v.venue_id = vs.venue_id
  where v.location = 'UAT-44 Harbour Room'
  union all
  select 'Founders'' Gala Dinner is assigned to Test Coordinator', coalesce(ua.name, 'nobody'),
         ua.name is not distinct from 'Test Coordinator'
  from public.event e
  left join public.user_account ua on ua.user_account_id = e.assigned_coordinator_user_account_id
  where e.name = 'Founders'' Gala Dinner'
)
select * from checks order by ok, "check";
