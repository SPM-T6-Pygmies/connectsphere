-- SPM-260: a Safety Officer reviews an event and records its safety check.
--
--   safety_officer_safety_check_review(p_user_account_id, p_event_id)
--     One event as the Officer reviews it, or null if there is none: the facts
--     `awaitsSafetyCheck` judges (as safety_check_candidate gives them), its
--     accessibility requirements, each Confirmed booking's venue, chosen layout,
--     that layout's capacity at the venue and the venue's accessibility notes,
--     each equipment line by item, and every outcome recorded on it, newest
--     first, with who recorded it (AC1, AC5).
--
--   safety_officer_record_safety_check(p_user_account_id, p_event_id, p_outcome, p_comments)
--     Adds an outcome. Restates at the write boundary what a caller that skips
--     the core could get wrong: the event is still Planning and has no outcome
--     yet (AC6), and a rejection says what must change (AC3). It locks the
--     event row first, so of two Officers recording at once the second waits,
--     then sees the first's outcome and is refused. Whether every booking is
--     Confirmed and every line reserved is `recordSafetyCheck`'s check alone.
--
-- Custom SQLSTATEs, translated back into DomainErrors by
-- SupabaseSafetyCheckRepository:
--   CS050  the account does not hold the Safety Officer role (AC7, as SPM-259)
--   CS051  the event is not awaiting a safety check (AC6)
--   CS052  a rejection without comments (AC3)
--
-- Known gap, shared with the other staff functions: the Officer's id is
-- supplied by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

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
     or exists (select 1 from public.safety_check where event_id = p_event_id) then
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

revoke execute on function public.safety_officer_safety_check_review(bigint, bigint) from public;
grant execute on function public.safety_officer_safety_check_review(bigint, bigint) to anon, authenticated;
revoke execute on function public.safety_officer_record_safety_check(bigint, bigint, text, text) from public;
grant execute on function public.safety_officer_record_safety_check(bigint, bigint, text, text)
  to anon, authenticated;

commit;
