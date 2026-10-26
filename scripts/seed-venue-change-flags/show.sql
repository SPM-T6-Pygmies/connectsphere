-- Lists the "Venue Change:" bookings and any flag on them, so a case can check what an edit
-- did. Read-only. Before any case it lists 7 bookings and no flags.
--
--   supabase db query --file scripts/seed-venue-change-flags/show.sql --local

select e.name as event,
       b.booking_id,
       v.location as venue,
       min(bs.slot_date) as day,
       b.status,
       rl.name as layout,
       f.source_ref,
       f.detail,
       case when f.booking_review_flag_id is null then null
            when f.cleared_at is null then 'open' else 'cleared' end as flag
from public.booking b
join public.event e on e.event_id = b.event_id
join public.venue v on v.venue_id = b.venue_id
join public.booking_slot bs on bs.booking_id = b.booking_id
left join public.room_layout rl on rl.room_layout_id = b.room_layout_id
left join public.booking_review_flag f on f.booking_id = b.booking_id
where e.name like 'Venue Change: %'
group by e.name, b.booking_id, v.location, b.status, rl.name, f.booking_review_flag_id
order by e.name, b.booking_id, f.source_ref;
