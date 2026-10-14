-- SPM-62: the coordinator sees Venue Staff's answer to a rejected booking.
--
-- `coordinator_event_bookings`
--     As in 20261005040000, plus the booking's `rejection_note` and the venue
--     Venue Staff suggested instead (`suggested_alternative_venue_id` and its
--     location), so the coordinator can read the reason and request the
--     suggestion afresh (AC2, AC3). The return type changes, so it is dropped
--     and recreated, and its grants restated.

begin;

drop function if exists public.coordinator_event_bookings(bigint, bigint);

create function public.coordinator_event_bookings(
  p_coordinator_user_account_id bigint,
  p_event_id bigint
)
returns table (
  booking_id bigint,
  venue_id bigint,
  venue_location text,
  room_layout_name text,
  status text,
  created_at timestamptz,
  slots jsonb,
  rejection_note text,
  suggested_alternative_venue_id bigint,
  suggested_alternative_location text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    b.booking_id,
    b.venue_id,
    v.location,
    rl.name,
    b.status,
    b.created_at,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object('date', bs.slot_date, 'slot', bs.slot)
                 order by bs.slot_date, array_position(array['AM', 'PM', 'Night'], bs.slot)
               )
        from public.booking_slot bs
        where bs.booking_id = b.booking_id
      ),
      '[]'::jsonb
    ),
    b.rejection_note,
    b.suggested_alternative_venue_id,
    av.location
  from public.booking b
  join public.event e on e.event_id = b.event_id
  join public.venue v on v.venue_id = b.venue_id
  left join public.room_layout rl on rl.room_layout_id = b.room_layout_id
  left join public.venue av on av.venue_id = b.suggested_alternative_venue_id
  where b.event_id = p_event_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id
  order by b.created_at desc;
$$;

revoke execute on function public.coordinator_event_bookings(bigint, bigint) from public;
grant execute on function public.coordinator_event_bookings(bigint, bigint) to anon, authenticated;

commit;
