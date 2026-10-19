-- SPM-109: the assigned Event Coordinator marks an equipment line essential,
-- after agreeing it with the assigned Technical Support Staff outside the
-- system. The mark records their joint decision (#106); Technical Support see
-- it but do not set it (AC2).
--
-- equipment_reservation_line gains:
--
--   essential  whether the line is essential to the event (AC1), judged per
--              line rather than per reservation (AC3). False until the
--              coordinator marks it (AC4), so every existing line starts out
--              not essential.
--
-- The per-type event_essential_arrangement table is not used for this.
--
--   coordinator_set_equipment_line_essential(p_event_id,
--                                            p_coordinator_user_account_id,
--                                            p_equipment_item_id, p_essential)
--     Sets the mark. Locks the event through
--     coordinator_lock_event_for_equipment, so only the assigned coordinator
--     can set it (AC2) and only while the event's lines are editable, then
--     writes an audit_record in the same transaction.
--
--   coordinator_event_equipment
--     Each line's mark. Its result columns change, so it is dropped and
--     recreated.
--
--   technical_support_equipment_events, technical_support_event_equipment
--     Each line's mark too, inside the lines json, so Technical Support can
--     see which lines are essential (AC2). Replaced in place.
--
-- SQLSTATEs are the coordinator equipment functions' own, which the adapter
-- already translates:
--   CS030  no such event, or not assigned to this coordinator (#91)
--   CS031  the event is Completed or Cancelled; its status is the DETAIL
--   CS034  the event has no line for this item
--
-- Known gap, shared with the other coordinator functions: the coordinator id
-- is supplied by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

begin;

alter table public.equipment_reservation_line
  add column essential boolean not null default false;

create function public.coordinator_set_equipment_line_essential(
  p_event_id bigint,
  p_coordinator_user_account_id bigint,
  p_equipment_item_id bigint,
  p_essential boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line public.equipment_reservation_line;
begin
  perform public.coordinator_lock_event_for_equipment(p_event_id, p_coordinator_user_account_id);

  select l.*
  into v_line
  from public.equipment_reservation_line l
  join public.equipment_reservation r using (equipment_reservation_id)
  where r.event_id = p_event_id
    and l.equipment_item_id = p_equipment_item_id
  for update of l;

  if not found then
    raise exception 'Event % has no line for item %', p_event_id, p_equipment_item_id
      using errcode = 'CS034';
  end if;

  update public.equipment_reservation_line
  set essential = p_essential
  where reservation_line_id = v_line.reservation_line_id;

  insert into public.audit_record (actor_user_account_id, entity_type, entity_id, action)
  values (p_coordinator_user_account_id, 'equipment_reservation', v_line.equipment_reservation_id,
          case when p_essential then 'equipment line marked essential'
               else 'equipment line marked not essential'
          end);
end;
$$;

drop function public.coordinator_event_equipment(bigint);

create function public.coordinator_event_equipment(
  p_event_id bigint
)
returns table (
  equipment_reservation_id        bigint,
  reviewed_by_user_account_id     bigint,
  equipment_item_id               bigint,
  quantity_requested              integer,
  quantity_reserved               integer,
  technical_requirements          text,
  line_state                      text,
  reviewed_quantity_requested     integer,
  reviewed_technical_requirements text,
  removal_requested               boolean,
  decided_by_user_account_id      bigint,
  decided_by_name                 text,
  decision_comment                text,
  essential                       boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  with reservation as (
    select r.equipment_reservation_id, r.reviewed_by_user_account_id
    from public.equipment_reservation r
    where r.event_id = p_event_id
    order by r.equipment_reservation_id
    limit 1
  )
  select
    reservation.equipment_reservation_id,
    reservation.reviewed_by_user_account_id,
    l.equipment_item_id,
    l.quantity_requested,
    l.quantity_reserved,
    l.technical_requirements,
    l.line_state,
    l.reviewed_quantity_requested,
    l.reviewed_technical_requirements,
    l.removal_requested_at is not null,
    l.decided_by_user_account_id,
    u.name,
    l.decision_comment,
    l.essential
  from reservation
  left join public.equipment_reservation_line l
    on l.equipment_reservation_id = reservation.equipment_reservation_id
  left join public.user_account u on u.user_account_id = l.decided_by_user_account_id
  order by l.reservation_line_id;
$$;

create or replace function public.technical_support_equipment_events(
  p_user_account_id bigint
)
returns table (
  event_id       bigint,
  event_name     text,
  status         text,
  preferred_date date,
  lines          jsonb
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
      and r.role_name = 'Technical Support Staff'
  ) then
    raise exception 'Account % is not Technical Support Staff', p_user_account_id
      using errcode = 'CS040';
  end if;

  return query
  select
    e.event_id,
    e.name,
    e.status,
    e.preferred_date,
    l.lines
  from public.event e
  cross join lateral (
    select jsonb_agg(jsonb_build_object(
      'equipment_item_id', rl.equipment_item_id,
      'quantity_requested', rl.quantity_requested,
      'quantity_reserved', rl.quantity_reserved,
      'technical_requirements', rl.technical_requirements,
      'line_state', rl.line_state,
      'reviewed_quantity_requested', rl.reviewed_quantity_requested,
      'reviewed_technical_requirements', rl.reviewed_technical_requirements,
      'removal_requested', rl.removal_requested_at is not null,
      'decided_by_user_account_id', rl.decided_by_user_account_id,
      'decided_by_name', du.name,
      'decision_comment', rl.decision_comment,
      'essential', rl.essential
    ) order by rl.equipment_item_id) as lines
    from public.equipment_reservation_line rl
    join public.equipment_reservation res on res.equipment_reservation_id = rl.equipment_reservation_id
    left join public.user_account du on du.user_account_id = rl.decided_by_user_account_id
    where res.event_id = e.event_id
  ) l
  where l.lines is not null
  order by e.preferred_date nulls last, e.name;
end;
$$;

create or replace function public.technical_support_event_equipment(
  p_user_account_id bigint,
  p_event_id        bigint
)
returns table (
  event_id       bigint,
  event_name     text,
  status         text,
  preferred_date date,
  lines          jsonb
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
      and r.role_name = 'Technical Support Staff'
  ) then
    raise exception 'Account % is not Technical Support Staff', p_user_account_id
      using errcode = 'CS040';
  end if;

  return query
  select
    e.event_id,
    e.name,
    e.status,
    e.preferred_date,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'equipment_item_id', rl.equipment_item_id,
        'equipment_type', i.type,
        'owned', i.quantity,
        'out_of_service', i.out_of_service,
        'quantity_requested', rl.quantity_requested,
        'quantity_reserved', rl.quantity_reserved,
        'technical_requirements', rl.technical_requirements,
        'line_state', rl.line_state,
        'reviewed_quantity_requested', rl.reviewed_quantity_requested,
        'reviewed_technical_requirements', rl.reviewed_technical_requirements,
        'removal_requested', rl.removal_requested_at is not null,
        'decided_by_user_account_id', rl.decided_by_user_account_id,
        'decided_by_name', du.name,
        'decision_comment', rl.decision_comment,
        'essential', rl.essential,
        'other_holds', coalesce((
          select jsonb_agg(jsonb_build_object(
            'event_status', oe.status,
            'preferred_date', oe.preferred_date,
            'quantity_reserved', ol.quantity_reserved
          ))
          from public.equipment_reservation_line ol
          join public.equipment_reservation ores on ores.equipment_reservation_id = ol.equipment_reservation_id
          join public.event oe on oe.event_id = ores.event_id
          where ol.equipment_item_id = rl.equipment_item_id
            and ol.quantity_reserved > 0
            and oe.event_id <> e.event_id
        ), '[]'::jsonb)
      ) order by i.type)
      from public.equipment_reservation_line rl
      join public.equipment_reservation res on res.equipment_reservation_id = rl.equipment_reservation_id
      join public.equipment_item i on i.equipment_item_id = rl.equipment_item_id
      left join public.user_account du on du.user_account_id = rl.decided_by_user_account_id
      where res.event_id = e.event_id
    ), '[]'::jsonb)
  from public.event e
  where e.event_id = p_event_id;
end;
$$;

revoke execute on function public.coordinator_set_equipment_line_essential(bigint, bigint, bigint, boolean) from public;
grant execute on function public.coordinator_set_equipment_line_essential(bigint, bigint, bigint, boolean) to anon, authenticated;

revoke execute on function public.coordinator_event_equipment(bigint) from public;
grant execute on function public.coordinator_event_equipment(bigint) to anon, authenticated;

commit;
