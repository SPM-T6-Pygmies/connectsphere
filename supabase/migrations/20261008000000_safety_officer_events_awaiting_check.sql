-- SPM-259: the events a Safety Officer may need to check.
--
--   safety_officer_safety_check_candidates(p_user_account_id)
--     Every Planning event, with its expected attendance, its venue bookings
--     (on the event or any of its sessions, with the venue's location) and its
--     equipment lines: one row per event, soonest first, events with no date
--     last. Facts only -- which of them await a check is `awaitsSafetyCheck`'s
--     call (src/core/domain/safety-check.ts). Restates AC7 at the read
--     boundary: only an account holding the Safety Officer role may read it.
--
-- Custom SQLSTATE, translated back into a DomainError by
-- SupabaseSafetyCheckCandidateRepository (CS040 belongs to the Technical
-- Support re-check list):
--   CS050  the account does not hold the Safety Officer role (AC7)
--
-- Known gap, shared with the other staff functions: the reader's id is
-- supplied by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

begin;

create or replace function public.safety_officer_safety_check_candidates(
  p_user_account_id bigint
)
returns table (
  event_id            bigint,
  event_name          text,
  status              text,
  preferred_date      date,
  expected_attendance integer,
  bookings            jsonb,
  equipment_lines     jsonb
)
language plpgsql
security definer
set search_path = ''
stable
as $$
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

  return query
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
  where e.status = 'Planning'
  order by e.preferred_date nulls last, e.name;
end;
$$;

revoke execute on function public.safety_officer_safety_check_candidates(bigint) from public;
grant execute on function public.safety_officer_safety_check_candidates(bigint) to anon, authenticated;

commit;
