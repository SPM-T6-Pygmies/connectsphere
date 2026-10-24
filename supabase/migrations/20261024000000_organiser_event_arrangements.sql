-- SPM-66: the Organiser's view of the arrangements made for the event their
-- request became, so a "your event is confirmed" notification opens onto
-- what was confirmed (AC3).
--
--   organiser_event_request_arrangements(p_event_request_id)
--     The event's status, the venue of each Confirmed booking (on the event or
--     any of its sessions) and each equipment line with anything reserved.
--     Null until the request is approved and has an event. Same reach as
--     organiser_event_request_times: the caller has already been checked
--     against the request by eventRequestAccessFor.

begin;

create or replace function public.organiser_event_request_arrangements(p_event_request_id bigint)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'status', e.status,
    'venues', coalesce((
      select jsonb_agg(distinct v.location order by v.location)
      from public.booking b
      join public.venue v on v.venue_id = b.venue_id
      where b.status = 'Confirmed'
        and (
          b.event_id = e.event_id
          or b.session_id in (select s.session_id from public.session s where s.event_id = e.event_id)
        )
    ), '[]'::jsonb),
    'equipment', coalesce((
      select jsonb_agg(jsonb_build_object(
        'equipment_type', i.type,
        'quantity_reserved', l.quantity_reserved
      ) order by i.type)
      from public.equipment_reservation_line l
      join public.equipment_reservation r on r.equipment_reservation_id = l.equipment_reservation_id
      join public.equipment_item i on i.equipment_item_id = l.equipment_item_id
      where r.event_id = e.event_id
        and l.quantity_reserved > 0
    ), '[]'::jsonb)
  )
  from public.event e
  where e.event_request_id = p_event_request_id;
$$;

revoke execute on function public.organiser_event_request_arrangements(bigint) from public;
grant execute on function public.organiser_event_request_arrangements(bigint) to anon, authenticated;

commit;
