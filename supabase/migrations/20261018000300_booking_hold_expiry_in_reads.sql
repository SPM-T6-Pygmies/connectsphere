-- SPM-218: a held booking shows when its hold lapses, to Venue Staff and to
-- the coordinator.
--
-- 1. `venue_staff_bookings` returns JSON, so it gains a `hold_expires_at` key
--    with no change to its signature. The rest is its latest definition
--    (20261018000000, SPM-62).
-- 2. `coordinator_event_bookings` returns a table, so a new column means drop
--    and create. The rest is its latest definition (20261018000100, SPM-62),
--    grants restated.
--
-- Both are reads. Nothing here decides whether a hold is still live: that is
-- `booking_holds_slot`, and SPM-253 moves expired holds to their own status.

begin;

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
      'hold_expires_at', b.hold_expires_at,
      'rejection_note', b.rejection_note,
      'suggested_alternative_location', av.location,
      'event', jsonb_build_object(
        'event_id', e.event_id,
        'event_request_id', e.event_request_id,
        'coordinator_user_account_id', e.assigned_coordinator_user_account_id,
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
  hold_expires_at timestamptz,
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
    b.hold_expires_at,
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
