-- Checks that the event cancel seed (seed.sql in this directory) is in place and untouched.
-- Read-only. Run seed-booking-cancel's verify.sql as well: it checks the other five bookings.
--
--   supabase db query --file scripts/seed-event-cancel/verify.sql --local
--
-- Prints one row per check, failures first. Every row should read ok = true. A false row means
-- the event was already cancelled, or L was never seeded or has since been marked Expired --
-- which any staff page does as it loads (SPM-254), so run this before signing in. To start over,
-- run teardown.sql and then the seeds again.
--
-- One statement on purpose: `supabase db query --file` refuses a file holding more than one,
-- and exits 0 even when a query fails -- so read the rows, not the exit code.

with c as (
  select (now() at time zone 'Asia/Singapore')::date + 10 as day
),
lapsed as (
  select b.status, b.hold_expires_at
  from public.booking b
  join public.event e on e.event_id = b.event_id
  join public.venue v on v.venue_id = b.venue_id
  join public.booking_slot bs on bs.booking_id = b.booking_id
  cross join c
  where e.name = 'Founders'' Gala Dinner'
    and v.location = 'UAT-44 Garden Hall'
    and bs.slot_date = c.day and bs.slot = 'Night'
),
checks as (
  select 'booking L: UAT-44 Garden Hall C Night is a Tentative Hold past its expiry' as "check",
         coalesce(string_agg(status || ', expired ' || (hold_expires_at < now())::text, '; '), 'missing') as found,
         count(*) = 1 and bool_and(status = 'Tentative Hold' and hold_expires_at < now()) as ok
  from lapsed
  union all
  select 'Founders'' Gala Dinner is Planning', coalesce(max(status), 'missing'), max(status) = 'Planning'
  from public.event
  where name = 'Founders'' Gala Dinner'
)
select * from checks order by ok, "check";
