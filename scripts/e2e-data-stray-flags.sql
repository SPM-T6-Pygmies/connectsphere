-- Checks that, with every seed of the `full` profile loaded, no booking is flagged except the ones
-- a seed means to flag. Read-only. Run by `pnpm e2e:data verify`.
--
-- The seeds mix dates counted from today with fixed dates on the same venues, so on some days one
-- seed's venue block lands on another's booking and flags it. No seed fails when that happens;
-- this row does, and names the bookings. Load the affected document's own seeds instead.
--
-- Flagged on purpose: the Founders' Gala Dinner's Harbour Room bookings (seed-booking-flag-clear)
-- and the Re-request Test events (seed-venue-re-request).

select 'no open flag outside the seeded ones' as check_name,
       coalesce(string_agg(distinct e.name || ' at ' || v.location, '; '), 'none') as actual,
       count(*) = 0 as ok
from public.booking_review_flag f
join public.booking b on b.booking_id = f.booking_id
join public.event e on e.event_id = b.event_id
join public.venue v on v.venue_id = b.venue_id
where f.cleared_at is null
  and not (e.name = 'Founders'' Gala Dinner' and v.location = 'UAT-44 Harbour Room')
  and e.name not like 'Re-request Test: %';
