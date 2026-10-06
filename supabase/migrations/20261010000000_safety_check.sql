-- SPM-260: the outcomes Safety Officers record on an event.
--
--   safety_check   one row per outcome: the event, Approved or Rejected, the
--                  Officer's comments, who recorded it and when. Rows are only
--                  ever added, so earlier checks on an event stay readable (AC5).
--
-- Rejected is also the request for changes: its comments say what must change,
-- so they are required, here as well as in the core (`recordSafetyCheck`), so a
-- caller that skips the core cannot store a bare rejection (AC3).
--
-- An event leaves the Safety Officer's list once it has an outcome (AC6). The
-- candidate reads from 20261008000000 and 20261009000000 are recreated to say
-- so, as `checked`; `awaitsSafetyCheck` (src/core/domain/safety-check.ts) makes
-- the call. Their return type changes, so they are dropped first.
--
-- Recording goes through a security definer function (20261010010000), like
-- booking. The table carries no policy, so nothing reads or writes it directly.

begin;

create table safety_check (
  safety_check_id            bigint generated always as identity primary key,
  event_id                   bigint not null references event (event_id) on delete cascade,
  outcome                    text   not null,
  comments                   text,
  checked_by_user_account_id bigint not null references user_account (user_account_id) on delete restrict,
  checked_at                 timestamptz not null default now(),
  constraint safety_check_outcome_chk
    check (outcome in ('Approved', 'Rejected')),
  constraint safety_check_comments_chk
    check (comments is null or btrim(comments) <> ''),
  constraint safety_check_rejection_comments_chk
    check (outcome <> 'Rejected' or comments is not null)
);

create index safety_check_event_idx on safety_check (event_id, checked_at desc);

alter table safety_check enable row level security;

drop function if exists public.safety_officer_safety_check_candidates(bigint);
drop function if exists public.safety_check_candidate_for_booking(bigint);
drop function if exists public.safety_check_candidate(bigint);

create function public.safety_officer_safety_check_candidates(
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
        'quantity_reserved', l.quantity_reserved
      ))
      from public.equipment_reservation_line l
      join public.equipment_reservation res on res.equipment_reservation_id = l.equipment_reservation_id
      where res.event_id = e.event_id
    ), '[]'::jsonb),
    exists (select 1 from public.safety_check sc where sc.event_id = e.event_id)
  from public.event e
  where e.status = 'Planning'
  order by e.preferred_date nulls last, e.name;
end;
$$;

create function public.safety_check_candidate(p_event_id bigint)
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
        'quantity_reserved', l.quantity_reserved
      ))
      from public.equipment_reservation_line l
      join public.equipment_reservation res on res.equipment_reservation_id = l.equipment_reservation_id
      where res.event_id = e.event_id
    ), '[]'::jsonb),
    exists (select 1 from public.safety_check sc where sc.event_id = e.event_id)
  from public.event e
  where e.event_id = p_event_id;
$$;

create function public.safety_check_candidate_for_booking(p_booking_id bigint)
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
  select c.*
  from public.booking b
  left join public.session s on s.session_id = b.session_id
  cross join lateral public.safety_check_candidate(coalesce(b.event_id, s.event_id)) c
  where b.booking_id = p_booking_id;
$$;

revoke execute on function public.safety_officer_safety_check_candidates(bigint) from public;
grant execute on function public.safety_officer_safety_check_candidates(bigint) to anon, authenticated;
revoke execute on function public.safety_check_candidate(bigint) from public, anon, authenticated;
revoke execute on function public.safety_check_candidate_for_booking(bigint) from public, anon, authenticated;
grant execute on function public.safety_check_candidate(bigint) to service_role;
grant execute on function public.safety_check_candidate_for_booking(bigint) to service_role;

commit;
