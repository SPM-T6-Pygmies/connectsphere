-- The Organiser's view of their event follows an accepted change request.
--
-- A request's own row keeps what was submitted, so after the Coordinator
-- accepts a new date or attendance the Organiser still read the old ones.
--
--   organiser_event_request_arrangements
--     Also returns the event's date and expected attendance as they are now.
--   organiser_event_dates(p_client_organisation_id)
--     The current date of each approved event in the organisation, by request,
--     so "My requests" can list the date the event now has.

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
    'date', e.preferred_date,
    'expected_attendance', e.expected_attendance,
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

create or replace function public.organiser_event_dates(p_client_organisation_id bigint)
returns table (event_request_id bigint, preferred_date date)
language sql
security definer
set search_path = ''
stable
as $$
  select e.event_request_id, e.preferred_date
  from public.event e
  join public.event_request r on r.event_request_id = e.event_request_id
  where r.client_organisation_id = p_client_organisation_id;
$$;

revoke execute on function public.organiser_event_dates(bigint) from public;
grant execute on function public.organiser_event_dates(bigint) to anon, authenticated;

commit;
