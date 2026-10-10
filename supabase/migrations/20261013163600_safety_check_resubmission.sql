-- SPM-261: a coordinator sends a rejected event back for a fresh safety check.
--
-- A rejected event stays Planning (Q6: always back to Planning, and nothing
-- here changes its status). Resubmitting marks its latest check:
--
--   safety_check.resubmitted_at / resubmitted_by_user_account_id
--     When, and by which coordinator, a rejection was sent back. Only a
--     rejection can be, and both are set together.
--
-- An event is "checked" -- off the Awaiting check list, and refusing another
-- outcome -- only while it has a check not yet resubmitted. So a resubmitted
-- event is back on the list as soon as its arrangements are all confirmed
-- again (AC4), through the same rule as every other event, and its earlier
-- checks stay as they were. The candidate reads, the Safety Officer's record
-- and review functions are replaced to say so; their signatures do not change.
-- At most one check per event is ever open, which an index restates.
--
--   coordinator_event_safety_checks(p_coordinator_user_account_id, p_event_id)
--     The event's status and every check, newest first, for its assigned
--     coordinator (AC2). Null when there is no such event or it is not theirs.
--
--   coordinator_resubmit_safety_check(p_coordinator_user_account_id, p_event_id)
--     Marks the latest check resubmitted (AC3). Restates
--     `canResubmitForSafetyCheck` under a lock on the event row, so two
--     presses cannot both succeed.
--
-- Custom SQLSTATEs, translated back into DomainErrors by
-- SupabaseSafetyCheckRepository:
--   CS053  no such event, or not assigned to this coordinator (#91)
--   CS054  the event cannot be resubmitted: not Planning, or its latest check
--          is not a rejection still open
--
-- Known gap, shared with the other coordinator functions: the coordinator's id
-- is supplied by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

begin;

alter table safety_check
  add column resubmitted_at timestamptz,
  add column resubmitted_by_user_account_id bigint references user_account (user_account_id) on delete restrict,
  add constraint safety_check_resubmission_chk
    check ((resubmitted_at is null) = (resubmitted_by_user_account_id is null)),
  add constraint safety_check_resubmit_rejected_chk
    check (resubmitted_at is null or outcome = 'Rejected');

create unique index safety_check_one_open_uidx on safety_check (event_id) where resubmitted_at is null;

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
        'quantity_reserved', l.quantity_reserved
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
        'quantity_reserved', l.quantity_reserved
      ))
      from public.equipment_reservation_line l
      join public.equipment_reservation res on res.equipment_reservation_id = l.equipment_reservation_id
      where res.event_id = e.event_id
    ), '[]'::jsonb),
    exists (select 1 from public.safety_check sc where sc.event_id = e.event_id and sc.resubmitted_at is null)
  from public.event e
  where e.event_id = p_event_id;
$$;

create or replace function public.safety_officer_record_safety_check(
  p_user_account_id bigint,
  p_event_id bigint,
  p_outcome text,
  p_comments text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_comments text := nullif(btrim(p_comments), '');
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

  select status into v_status from public.event where event_id = p_event_id for update;

  if v_status is distinct from 'Planning'
     or exists (select 1 from public.safety_check where event_id = p_event_id and resubmitted_at is null) then
    raise exception 'Event % is not awaiting a safety check', p_event_id
      using errcode = 'CS051';
  end if;

  if p_outcome = 'Rejected' and v_comments is null then
    raise exception 'A rejection needs comments' using errcode = 'CS052';
  end if;

  insert into public.safety_check (event_id, outcome, comments, checked_by_user_account_id)
  values (p_event_id, p_outcome, v_comments, p_user_account_id);
end;
$$;

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
        'checked_at', sc.checked_at,
        'resubmitted_at', sc.resubmitted_at
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

create or replace function public.coordinator_event_safety_checks(
  p_coordinator_user_account_id bigint,
  p_event_id bigint
)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'event_status', e.status,
    'checks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'outcome', sc.outcome,
        'comments', sc.comments,
        'checked_by_name', ua.name,
        'checked_at', sc.checked_at,
        'resubmitted_at', sc.resubmitted_at
      ) order by sc.checked_at desc, sc.safety_check_id desc)
      from public.safety_check sc
      join public.user_account ua on ua.user_account_id = sc.checked_by_user_account_id
      where sc.event_id = e.event_id
    ), '[]'::jsonb)
  )
  from public.event e
  where e.event_id = p_event_id
    and e.assigned_coordinator_user_account_id = p_coordinator_user_account_id;
$$;

create or replace function public.coordinator_resubmit_safety_check(
  p_coordinator_user_account_id bigint,
  p_event_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_latest public.safety_check%rowtype;
begin
  select status into v_status
  from public.event
  where event_id = p_event_id
    and assigned_coordinator_user_account_id = p_coordinator_user_account_id
  for update;

  if not found then
    raise exception 'No event % for coordinator %', p_event_id, p_coordinator_user_account_id
      using errcode = 'CS053';
  end if;

  select * into v_latest
  from public.safety_check
  where event_id = p_event_id
  order by checked_at desc, safety_check_id desc
  limit 1;

  if v_status <> 'Planning'
     or v_latest.safety_check_id is null
     or v_latest.outcome <> 'Rejected'
     or v_latest.resubmitted_at is not null then
    raise exception 'Event % cannot be resubmitted for a safety check', p_event_id
      using errcode = 'CS054';
  end if;

  update public.safety_check
  set resubmitted_at = now(),
      resubmitted_by_user_account_id = p_coordinator_user_account_id
  where safety_check_id = v_latest.safety_check_id;
end;
$$;

revoke execute on function public.coordinator_event_safety_checks(bigint, bigint) from public;
grant execute on function public.coordinator_event_safety_checks(bigint, bigint) to anon, authenticated;
revoke execute on function public.coordinator_resubmit_safety_check(bigint, bigint) from public;
grant execute on function public.coordinator_resubmit_safety_check(bigint, bigint) to anon, authenticated;

commit;
