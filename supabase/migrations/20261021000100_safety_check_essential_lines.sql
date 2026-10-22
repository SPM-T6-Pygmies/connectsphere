-- SPM-319: an event reaches the Safety Officer's list once its essential
-- equipment is reserved in full; a non-essential line never holds it back.
--
-- The rule is `awaitsSafetyCheck` in the core, which now needs each line's
-- SPM-109 mark. The two candidate reads below return it as `essential` in each
-- equipment line, and are otherwise as SPM-261 left them; their signatures do
-- not change. Everything else that reads a candidate goes through these two:
-- safety_check_candidate_for_booking and safety_officer_safety_check_review
-- both call safety_check_candidate.
--
-- A line nobody has marked reads as not essential (AC3): the column is
-- `not null default false` since SPM-109.

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
  equipment_lines     jsonb,
  checked             boolean
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
        'quantity_reserved', l.quantity_reserved,
        'essential', l.essential
      ))
      from public.equipment_reservation_line l
      join public.equipment_reservation res on res.equipment_reservation_id = l.equipment_reservation_id
      where res.event_id = e.event_id
    ), '[]'::jsonb),
    exists (select 1 from public.safety_check sc where sc.event_id = e.event_id and sc.resubmitted_at is null)
  from public.event e
  where e.status = 'Planning'
  order by e.preferred_date nulls last, e.name;
end;
$$;

create or replace function public.safety_check_candidate(p_event_id bigint)
returns table (
  event_id            bigint,
  event_name          text,
  status              text,
  preferred_date      date,
  expected_attendance integer,
  bookings            jsonb,
  equipment_lines     jsonb,
  checked             boolean
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
        'quantity_reserved', l.quantity_reserved,
        'essential', l.essential
      ))
      from public.equipment_reservation_line l
      join public.equipment_reservation res on res.equipment_reservation_id = l.equipment_reservation_id
      where res.event_id = e.event_id
    ), '[]'::jsonb),
    exists (select 1 from public.safety_check sc where sc.event_id = e.event_id and sc.resubmitted_at is null)
  from public.event e
  where e.event_id = p_event_id;
$$;

commit;
