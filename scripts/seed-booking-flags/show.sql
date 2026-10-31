-- Lists what seed.sql loaded, so a case can name the booking it is looking at. Read-only.
-- Blocks the cases record are listed by blocks.sql.
--
--   supabase db query --file scripts/seed-booking-flags/show.sql --local
--
-- F is Wednesday 23 December 2026; `day_label` says which day each booking is on, so
-- no case needs F worked out by hand. It should list 9 bookings.

select e.event_id,
       e.name as event,
       b.booking_id,
       c.name as coordinator,
       v.location as venue,
       bs.slot_date,
       case when bs.slot_date = f.day then 'F' else 'F + ' || (bs.slot_date - f.day) end as day_label,
       -- A booking is its 15-minute slots (SPM-324); each seeded one fills one span a day.
       to_char(min(sl.start_time), 'HH24:MI') || '-' || to_char(max(sl.end_time), 'HH24:MI') as time,
       b.status,
       case when b.status = 'Tentative Hold'
            then case when b.hold_expires_at > now() then 'live' else 'expired' end
       end as hold
from public.booking b
join public.event e on e.event_id = b.event_id
join public.user_account c on c.user_account_id = e.assigned_coordinator_user_account_id
join public.venue v on v.venue_id = b.venue_id
join public.booking_slot bs on bs.booking_id = b.booking_id
join public.slot sl on sl.slot_code = bs.slot
cross join (select date '2026-12-23' as day) f
where e.name like 'Flag Test: %'
group by e.event_id, e.name, b.booking_id, c.name, v.location, bs.slot_date, f.day, b.status, b.hold_expires_at
order by e.name, bs.slot_date, min(sl.start_time);
