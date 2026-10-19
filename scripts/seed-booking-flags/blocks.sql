-- Lists the blocks on Main Hall and Studio that touch 27 to 38 days from today (the days the
-- booking-flags cases use),
-- so a case can name the block it is looking at. Empty before TC-VFLAG-001. Read-only.
--
--   supabase db query --file scripts/seed-booking-flags/blocks.sql --local

select v.location as venue,
       u.venue_unavailability_id as block,
       u.reason_category as reason,
       min(us.slot_date) as first_day,
       max(us.slot_date) as last_day,
       case when u.lifted_at is null then 'In force' else 'Lifted' end as status
from public.venue_unavailability u
join public.venue v on v.venue_id = u.venue_id
join public.venue_unavailability_slot us on us.venue_unavailability_id = u.venue_unavailability_id
where v.location in ('Main Hall', 'Studio')
  and us.slot_date between (now() at time zone 'Asia/Singapore')::date + 27
                       and (now() at time zone 'Asia/Singapore')::date + 38
group by v.location, u.venue_unavailability_id, u.reason_category, u.lifted_at
order by u.venue_unavailability_id;
