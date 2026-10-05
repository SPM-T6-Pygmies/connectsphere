-- SPM-262: what tells Safety Officers that an event has joined their list.
--
-- "Awaiting a safety check" is never stored: `awaitsSafetyCheck`
-- (src/core/domain/safety-check.ts) works it out from an event's bookings and
-- equipment each time. So the app reads the event before and after a change to
-- see whether that change put it on the list, and these are those reads.
--
--   safety_check_candidate(p_event_id)
--     One event, whatever its status, with the same facts as
--     safety_officer_safety_check_candidates (20261008000000): status, date,
--     attendance, its bookings (on the event or a session) and its equipment
--     lines. No row for an event that does not exist.
--
--   safety_check_candidate_for_booking(p_booking_id)
--     The same, for the event a booking is for.
--
--   safety_officer_ids()
--     Every account holding the Safety Officer role -- each gets the notice.
--
-- System reads, made on behalf of Venue Staff or a coordinator who cannot see
-- the list themselves: executable by service_role only, which the app's admin
-- client uses, never by anon or authenticated.

begin;

create or replace function public.safety_check_candidate(p_event_id bigint)
returns table (
  event_id            bigint,
  event_name          text,
  status              text,
  preferred_date      date,
  expected_attendance integer,
  bookings            jsonb,
  equipment_lines     jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    e.event_id,
    e.name,
    e.status,
    e.preferred_date,
    e.expected_attendance,
    coalesce((
      select jsonb_agg(jsonb_build_object('status', b.status, 'venue_location', v.location))
      from public.booking b
      join public.venue v on v.venue_id = b.venue_id
      left join public.session s on s.session_id = b.session_id
      where b.event_id = e.event_id or s.event_id = e.event_id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'line_state', l.line_state,
        'quantity_requested', l.quantity_requested,
        'quantity_reserved', l.quantity_reserved
      ))
      from public.equipment_reservation_line l
      join public.equipment_reservation res on res.equipment_reservation_id = l.equipment_reservation_id
      where res.event_id = e.event_id
    ), '[]'::jsonb)
  from public.event e
  where e.event_id = p_event_id;
$$;

create or replace function public.safety_check_candidate_for_booking(p_booking_id bigint)
returns table (
  event_id            bigint,
  event_name          text,
  status              text,
  preferred_date      date,
  expected_attendance integer,
  bookings            jsonb,
  equipment_lines     jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select c.*
  from public.booking b
  left join public.session s on s.session_id = b.session_id
  cross join lateral public.safety_check_candidate(coalesce(b.event_id, s.event_id)) c
  where b.booking_id = p_booking_id;
$$;

create or replace function public.safety_officer_ids()
returns table (user_account_id bigint)
language sql
security definer
set search_path = ''
stable
as $$
  select ur.user_account_id
  from public.user_account_role ur
  join public.role r on r.role_id = ur.role_id
  where r.role_name = 'Safety Officer'
  order by ur.user_account_id;
$$;

revoke execute on function public.safety_check_candidate(bigint) from public, anon, authenticated;
revoke execute on function public.safety_check_candidate_for_booking(bigint) from public, anon, authenticated;
revoke execute on function public.safety_officer_ids() from public, anon, authenticated;
grant execute on function public.safety_check_candidate(bigint) to service_role;
grant execute on function public.safety_check_candidate_for_booking(bigint) to service_role;
grant execute on function public.safety_officer_ids() to service_role;

commit;
