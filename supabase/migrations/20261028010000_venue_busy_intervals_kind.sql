-- SPM-250: venue search pads a live booking with its venue's setup and turnaround, and leaves a
-- block as it is, so each busy interval now says which it is: `kind` is 'booking' or 'block'.
-- The padding itself is applied in the core (`searchVenues`), which already has each venue's two
-- values; the rows are unchanged otherwise.
--
-- Redefined from its latest definition: venue_busy_intervals 20261014020000. The return type is
-- still jsonb, so it is replaced in place.

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
             'ends_at', b.ends_at,
             'kind', b.kind)
           order by b.venue_id, b.starts_at), '[]'::jsonb)
  from (
    select
      bs.venue_id,
      (bs.slot_date + s.start_time) at time zone 'Asia/Singapore' as starts_at,
      (bs.slot_date + s.end_time)   at time zone 'Asia/Singapore' as ends_at,
      'booking' as kind
    from public.booking_slot bs
    join public.booking bk on bk.booking_id = bs.booking_id
    join public.slot s on s.slot_code = bs.slot
    where public.booking_holds_slot(bk.status, bk.hold_expires_at)
    union
    select
      us.venue_id,
      (us.slot_date + s.start_time) at time zone 'Asia/Singapore',
      (us.slot_date + s.end_time)   at time zone 'Asia/Singapore',
      'block'
    from public.venue_unavailability_slot us
    join public.venue_unavailability u
      on u.venue_unavailability_id = us.venue_unavailability_id
    join public.slot s on s.slot_code = us.slot
    where u.lifted_at is null
  ) b
  where auth.uid() is not null
    -- Half-open: a slot ending exactly when the window starts does not overlap.
    and b.starts_at < p_to
    and b.ends_at > p_from;
$$;

revoke execute on function public.venue_busy_intervals(timestamptz, timestamptz) from public, anon;
grant execute on function public.venue_busy_intervals(timestamptz, timestamptz) to authenticated;

commit;
