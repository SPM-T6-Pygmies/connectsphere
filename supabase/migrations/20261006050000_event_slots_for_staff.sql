-- Slot-based timing: staff read an event's slots, not its start and end time.
--
-- 1. `event_slots(event)` is a PostgREST computed field: the event's
--    event_slot rows as [{date, slot}], in the order they fall. A caller adds
--    it with `select=*,event_slots`. Security definer because event_slot has no
--    read policy. It answers for any event only to a signed-in caller -- the
--    same reach coordinator_event(s) already give staff -- and, to anyone else,
--    only for a Confirmed event: an event still being planned is internal
--    information (brief s8b). Granted to signed-in users here; the attendee
--    catalogue grants it to anon when it reads slots.
--
-- 2. venue_staff_bookings reports the event's slots in place of its
--    start_time/end_time. Same signature; the function is otherwise unchanged
--    from 20261005030000_venue_staff_decide_booking.sql.

begin;

create or replace function public.event_slots(p_event public.event)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object('date', es.slot_date, 'slot', es.slot_code)
           order by es.slot_date, s.start_time), '[]'::jsonb)
  from public.event_slot es
  join public.slot s on s.slot_code = es.slot_code
  join public.event e on e.event_id = es.event_id
  where es.event_id = p_event.event_id
    and (auth.uid() is not null or e.status = 'Confirmed');
$$;

revoke execute on function public.event_slots(public.event) from public, anon;
grant execute on function public.event_slots(public.event) to authenticated;

create or replace function public.venue_staff_bookings(
  p_staff_user_account_id bigint,
  p_section text,
  p_booking_id bigint default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'booking_id', b.booking_id,
      'status', b.status,
      'venue_id', b.venue_id,
      'venue_location', v.location,
      'room_layout_name', rl.name,
      'slots', (
        select coalesce(jsonb_agg(
                 jsonb_build_object('date', bs.slot_date, 'slot', bs.slot)
                 order by bs.slot_date, array_position(array['AM', 'PM', 'Night'], bs.slot)
               ), '[]'::jsonb)
        from public.booking_slot bs
        where bs.booking_id = b.booking_id
      ),
      'requested_by_name', rb.name,
      'requested_at', b.created_at,
      'decided_by_name', db.name,
      'rejection_note', b.rejection_note,
      'suggested_alternative_location', av.location,
      'event', jsonb_build_object(
        'name', e.name,
        'status', e.status,
        'organisation_name', co.name,
        'category', e.category_type,
        'preferred_date', e.preferred_date,
        'slots', (
          select coalesce(jsonb_agg(
                   jsonb_build_object('date', es.slot_date, 'slot', es.slot_code)
                   order by es.slot_date, s.start_time
                 ), '[]'::jsonb)
          from public.event_slot es
          join public.slot s on s.slot_code = es.slot_code
          where es.event_id = e.event_id
        ),
        'expected_attendance', e.expected_attendance,
        'room_layout_preference', e.room_layout_preference,
        'accessibility_requirements', e.accessibility_requirements,
        'venue_requirements', e.venue_requirements,
        'equipment_requirements', e.equipment_requirements,
        'special_arrangements', e.special_arrangements
      )
    )
    order by b.created_at, b.booking_id
  ), '[]'::jsonb)
  from public.booking b
  join public.venue v on v.venue_id = b.venue_id
  join public.event e on e.event_id = b.event_id
  join public.client_organisation co on co.client_organisation_id = e.client_organisation_id
  join public.user_account rb on rb.user_account_id = b.requested_by_user_account_id
  left join public.user_account db on db.user_account_id = b.decided_by_user_account_id
  left join public.venue av on av.venue_id = b.suggested_alternative_venue_id
  left join public.room_layout rl on rl.room_layout_id = b.room_layout_id
  where exists (
          select 1
          from public.user_account_role uar
          join public.role r on r.role_id = uar.role_id
          where uar.user_account_id = p_staff_user_account_id
            and r.role_name = 'Venue Staff'
        )
    and (p_booking_id is null or b.booking_id = p_booking_id)
    and b.status = any (
      case p_section
        when 'requests' then array['Requested']
        when 'decided' then array['Tentative Hold', 'Confirmed']
        when 'archive' then array['Rejected', 'Released', 'Cancelled']
        else array['Requested', 'Tentative Hold', 'Confirmed', 'Rejected', 'Released', 'Cancelled']
      end
    );
$$;

commit;
