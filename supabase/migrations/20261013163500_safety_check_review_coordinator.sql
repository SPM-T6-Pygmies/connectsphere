-- SPM-263: who to tell when a safety check is recorded.
--
--   safety_officer_safety_check_review(p_user_account_id, p_event_id)
--     As in 20261010010000, plus `coordinator_user_account_id`: the event's
--     assigned Event Coordinator, or null if it has none. Recording an outcome
--     reads it here and notifies that account (AC1), and nobody when it is
--     null (AC6). Same signature and grants, so it is replaced in place.

begin;

create or replace function public.safety_officer_safety_check_review(
  p_user_account_id bigint,
  p_event_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_review jsonb;
begin
  if not exists (
    select 1
    from public.user_account_role ur
    join public.role r on r.role_id = ur.role_id
    where ur.user_account_id = p_user_account_id
      and r.role_name = 'Safety Officer'
  ) then
    raise exception 'Account % is not a Safety Officer', p_user_account_id
      using errcode = 'CS050';
  end if;

  select to_jsonb(c) || jsonb_build_object(
    'accessibility_requirements', e.accessibility_requirements,
    'coordinator_user_account_id', e.assigned_coordinator_user_account_id,
    'venues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'venue_location', v.location,
        'room_layout_name', rl.name,
        'layout_capacity', vsl.capacity,
        'accessibility', v.accessibility
      ) order by v.location, b.booking_id)
      from public.booking b
      join public.venue v on v.venue_id = b.venue_id
      left join public.session s on s.session_id = b.session_id
      left join public.room_layout rl on rl.room_layout_id = b.room_layout_id
      left join public.venue_supported_layout vsl
        on vsl.venue_id = b.venue_id and vsl.room_layout_id = b.room_layout_id
      where (b.event_id = e.event_id or s.event_id = e.event_id)
        and b.status = 'Confirmed'
    ), '[]'::jsonb),
    'equipment', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item', i.type,
        'quantity_requested', l.quantity_requested,
        'quantity_reserved', l.quantity_reserved
      ) order by i.type)
      from public.equipment_reservation_line l
      join public.equipment_reservation res on res.equipment_reservation_id = l.equipment_reservation_id
      join public.equipment_item i on i.equipment_item_id = l.equipment_item_id
      where res.event_id = e.event_id
    ), '[]'::jsonb),
    'checks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'outcome', sc.outcome,
        'comments', sc.comments,
        'checked_by_name', ua.name,
        'checked_at', sc.checked_at
      ) order by sc.checked_at desc, sc.safety_check_id desc)
      from public.safety_check sc
      join public.user_account ua on ua.user_account_id = sc.checked_by_user_account_id
      where sc.event_id = e.event_id
    ), '[]'::jsonb)
  )
  into v_review
  from public.event e
  cross join lateral public.safety_check_candidate(e.event_id) c
  where e.event_id = p_event_id;

  return v_review;
end;
$$;

commit;
