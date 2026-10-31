-- Lists where the re-request seed's bookings stand (seed.sql in this directory), so a case can
-- name the booking it is looking at and check what a re-request did. Read-only.
--
--   supabase db query --file scripts/seed-venue-re-request/show.sql --local
--
-- Straight after seed.sql it lists 3 bookings: A (Main Hall) and B (Studio) Confirmed with one
-- open flag each, and the Evening Gala's Main Hall booking with none. Re-requests the cases send
-- appear as more rows of the Tech Summit, with `replaces` set.

select e.name as event,
       b.booking_id,
       v.location as venue,
       to_char(min(sl.start_time), 'HH24:MI') || '-' || to_char(max(sl.end_time), 'HH24:MI') as time,
       b.status,
       b.replaces_booking_id as replaces,
       b.replaced_by_booking_id as replaced_by,
       (select string_agg(coalesce(f.cleared_how, 'open'), ', ' order by f.booking_review_flag_id)
          from public.booking_review_flag f where f.booking_id = b.booking_id) as flags
from public.booking b
join public.event e on e.event_id = b.event_id
join public.venue v on v.venue_id = b.venue_id
join public.booking_slot bs on bs.booking_id = b.booking_id
join public.slot sl on sl.slot_code = bs.slot
where e.name like 'Re-request Test: %'
group by e.name, b.booking_id, v.location, b.status, b.replaces_booking_id, b.replaced_by_booking_id
order by b.booking_id;
