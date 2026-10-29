-- Lists the SPM-309 fixture's bookings with their status and open "event-change" reasons.
--   supabase db query --file scripts/seed-event-change-flags/show.sql --local
select e.name as event, v.location as venue, b.status,
       case when b.status = 'Tentative Hold' and b.hold_expires_at < now() then 'lapsed' end as hold,
       f.source_ref, f.detail, f.cleared_at
from public.event e
join public.booking b on b.event_id = e.event_id
join public.venue v on v.venue_id = b.venue_id
left join public.booking_review_flag f on f.booking_id = b.booking_id and f.reason_code = 'event-change'
where e.name like 'Event Change: %'
order by e.name, v.location, f.source_ref;
