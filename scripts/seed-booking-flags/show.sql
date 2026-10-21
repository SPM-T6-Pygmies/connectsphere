-- Lists what seed.sql loaded, so a case can name the booking it is looking at. Read-only.
-- Blocks the cases record are listed by blocks.sql.
--
--   supabase db query --file scripts/seed-booking-flags/show.sql --local
--
-- F is 28 days from today in Singapore time; `day_label` says which day each booking is on, so
-- no case needs F worked out by hand. It should list 9 bookings.

select e.event_id,
       e.name as event,
       b.booking_id,
       c.name as coordinator,
       v.location as venue,
       bs.slot_date,
       case when bs.slot_date = f.day then 'F' else 'F + ' || (bs.slot_date - f.day) end as day_label,
       bs.slot,
       b.status,
       case when b.status = 'Tentative Hold'
            then case when b.hold_expires_at > now() then 'live' else 'expired' end
       end as hold
from public.booking b
join public.event e on e.event_id = b.event_id
join public.user_account c on c.user_account_id = e.assigned_coordinator_user_account_id
join public.venue v on v.venue_id = b.venue_id
join public.booking_slot bs on bs.booking_id = b.booking_id
cross join (select (now() at time zone 'Asia/Singapore')::date + 28 as day) f
where e.name like 'Flag Test: %'
order by e.name, bs.slot_date, array_position(array['AM', 'PM', 'Night'], bs.slot);
