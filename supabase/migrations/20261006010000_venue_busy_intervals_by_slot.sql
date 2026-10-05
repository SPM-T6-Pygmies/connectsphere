-- Venue busy intervals, read from slots.
--
-- Supersedes the timestamp version in 20261001000000_venue_busy_intervals.sql.
-- A live booking now makes its venue busy for each slot it holds in
-- booking_slot: the slot's start and end on that date, in Singapore time.
-- The return shape and the signature are unchanged, so the app adapter does not
-- change.
--
-- A booking with no booking_slot rows blocks nothing, the same rule as before for
-- a booking with no event or session times.

begin;

create or replace function public.venue_busy_intervals(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'venue_id', b.venue_id,
             'starts_at', b.starts_at,
             'ends_at', b.ends_at)
           order by b.venue_id, b.starts_at), '[]'::jsonb)
  from (
    select
      bs.venue_id,
      (bs.slot_date + s.start_time) at time zone 'Asia/Singapore' as starts_at,
      (bs.slot_date + s.end_time)   at time zone 'Asia/Singapore' as ends_at
    from public.booking_slot bs
    join public.slot s on s.slot_code = bs.slot
    where bs.status in ('Tentative Hold', 'Confirmed')
  ) b
  where auth.uid() is not null
    -- Half-open: a slot ending exactly when the window starts does not overlap.
    and b.starts_at < p_to
    and b.ends_at > p_from;
$$;

revoke execute on function public.venue_busy_intervals(timestamptz, timestamptz) from public, anon;
grant execute on function public.venue_busy_intervals(timestamptz, timestamptz) to authenticated;

commit;
