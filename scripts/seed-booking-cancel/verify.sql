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
  select (now() at time zone 'Asia/Singapore')::date + 10 as day
),
expected (booking, venue, slot_date, slot, status) as (
  select 'P', 'UAT-44 Harbour Room', day,     'AM',    'Confirmed'      from c union all
  select 'Q', 'UAT-44 Harbour Room', day,     'Night', 'Confirmed'      from c union all
  select 'R', 'UAT-44 Garden Hall',  day,     'AM',    'Requested'      from c union all
  select 'S', 'UAT-44 Garden Hall',  day,     'PM',    'Tentative Hold' from c union all
  select 'U', 'UAT-44 Harbour Room', day + 1, 'AM',    'Rejected'       from c
),
actual as (
  select v.location as venue, bs.slot_date, bs.slot, b.status, b.hold_expires_at
  from public.booking b
  join public.event e on e.event_id = b.event_id
  join public.venue v on v.venue_id = b.venue_id
  join public.booking_slot bs on bs.booking_id = b.booking_id
  where e.name = 'Founders'' Gala Dinner'
),
checks as (
  select
    format('booking %s: %s %s %s is %s', x.booking, x.venue, x.slot_date, x.slot, x.status) as "check",
    coalesce(string_agg(a.status, ', '), 'missing') as found,
    count(a.status) = 1 and bool_and(a.status = x.status)
      and bool_and(x.status <> 'Tentative Hold' or a.hold_expires_at > now()) as ok
  from expected x
  left join actual a
    on a.venue = x.venue and a.slot_date = x.slot_date and a.slot = x.slot
  group by x.booking, x.venue, x.slot_date, x.slot, x.status
  union all
  select 'UAT-44 Harbour Room offers AM and Night', string_agg(vs.slot_code, ', ' order by vs.slot_code),
         count(*) filter (where vs.slot_code in ('AM', 'Night')) = 2
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
