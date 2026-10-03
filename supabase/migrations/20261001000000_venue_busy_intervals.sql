-- SPM-44 (SPM-150): when each venue is already taken, so the venue search can
-- exclude a venue that is not free for the searched window.
--
-- No table change. A booking holds no times of its own: it books an event or a
-- session (`booking_scope_chk`), and its busy time is that session's
-- start/end, or else the event's. Moving the event moves the booking with it.
-- Only live bookings ('Tentative Hold', 'Confirmed') make a venue busy; a
-- booking whose event or session has no times yet blocks nothing.
--
-- Not here: setup/turnaround buffers around a booking (#123, SPM-19) -- the
-- booking request (SPM-46) checks those -- and `booking_slot`, which this does
-- not read.
--
-- `booking` has RLS on and no read policy for signed-in users, so this is a
-- `security definer` read, open to every signed-in user like
-- `venue_catalogue` and closed to `anon`. It reveals only that a venue is busy
-- and when -- not which event holds it.

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
      bo.venue_id,
      case when bo.session_id is not null then s.start_time else e.start_time end
        as starts_at,
      case when bo.session_id is not null then s.end_time else e.end_time end
        as ends_at
    from public.booking bo
    left join public.session s on s.session_id = bo.session_id
    left join public.event e on e.event_id = bo.event_id
    where bo.status in ('Tentative Hold', 'Confirmed')
  ) b
  where auth.uid() is not null
    and b.starts_at is not null
    and b.ends_at is not null
    -- Half-open: a booking ending exactly when the window starts does not overlap.
    and b.starts_at < p_to
    and b.ends_at > p_from;
$$;

revoke execute on function public.venue_busy_intervals(timestamptz, timestamptz) from public, anon;
grant execute on function public.venue_busy_intervals(timestamptz, timestamptz) to authenticated;

commit;
