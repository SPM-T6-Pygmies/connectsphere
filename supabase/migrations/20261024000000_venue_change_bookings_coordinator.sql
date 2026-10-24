-- SPM-71: say whom to tell about the bookings a venue edit flags.
--
-- venue_change_bookings (SPM-105) gives each Confirmed booking and live hold at a venue
-- with its event's needs. The app now also tells the event's coordinator when the edit
-- flags their booking, so each booking also carries its event's id, name and assigned
-- coordinator (null while it has none). Otherwise unchanged: the return type is still
-- jsonb, so replacing it keeps its grants.

begin;

create or replace function public.venue_change_bookings(p_venue_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  perform public.venue_catalogue_require_staff();

  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'booking_id', b.booking_id,
        'event_id', e.event_id,
        'event_name', e.name,
        'coordinator_user_account_id', e.assigned_coordinator_user_account_id,
        'status', b.status,
        'hold_expires_at', b.hold_expires_at,
        'room_layout_name', rl.name,
        'slots', (
          select coalesce(jsonb_agg(jsonb_build_object('date', bs.slot_date, 'slot', bs.slot)
                                    order by bs.slot_date, bs.slot), '[]'::jsonb)
          from public.booking_slot bs
          where bs.booking_id = b.booking_id
        ),
        'expected_attendance', e.expected_attendance,
        'room_layout_preference', e.room_layout_preference,
        'accessibility_requirements', e.accessibility_requirements,
        'required_facilities', e.required_facilities
      )
      order by b.booking_id
    ), '[]'::jsonb)
    from public.booking b
    join public.event e on e.event_id = b.event_id
    left join public.room_layout rl on rl.room_layout_id = b.room_layout_id
    where b.venue_id = p_venue_id
      and public.booking_holds_slot(b.status, b.hold_expires_at)
  );
end;
$$;

commit;
