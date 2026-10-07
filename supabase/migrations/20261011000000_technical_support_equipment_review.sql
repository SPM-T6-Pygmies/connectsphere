-- SPM-273: what Technical Support Staff read to see equipment needing attention.
--
--   technical_support_equipment_events(p_user_account_id)
--     Every event with at least one equipment line, whatever its status, with
--     its lines: one row per event, soonest first, events with no date last.
--     Facts only -- which list an event belongs on (Needs review, Reviewed,
--     Archive) is `equipmentQueueOf`'s call (src/core/domain/equipment-review.ts).
--     Every venue, coordinator and equipment type is included (#66).
--
--   technical_support_event_equipment(p_user_account_id, p_event_id)
--     One event and its lines, ordered by type. Each line carries how many
--     units of its type are owned and what every other event has reserved of
--     that type, with that event's status and date. Which of those holds
--     overlap the event's D-1 -> Return Day + 1 window is `unitsAvailable`'s
--     call (#5, #113). No row when there is no such event.
--
-- Both restate at the read boundary that only an account holding the Technical
-- Support Staff role may read them, answering CS040 otherwise -- the same code
-- technical_support_equipment_rechecks uses, translated back into
-- NotTechnicalSupportStaffError. That function is left in place.
--
-- Known gap, shared with the other staff functions: the reader's id is
-- supplied by the caller and execute is granted to anon, so this trusts the
-- application's acting identity until real authentication lands (#62).

begin;

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
      'removal_requested', rl.removal_requested_at is not null
    ) order by rl.equipment_item_id) as lines
    from public.equipment_reservation_line rl
    join public.equipment_reservation res on res.equipment_reservation_id = rl.equipment_reservation_id
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
        'quantity_requested', rl.quantity_requested,
        'quantity_reserved', rl.quantity_reserved,
        'technical_requirements', rl.technical_requirements,
        'line_state', rl.line_state,
        'reviewed_quantity_requested', rl.reviewed_quantity_requested,
        'reviewed_technical_requirements', rl.reviewed_technical_requirements,
        'removal_requested', rl.removal_requested_at is not null,
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
      where res.event_id = e.event_id
    ), '[]'::jsonb)
  from public.event e
  where e.event_id = p_event_id;
end;
$$;

revoke execute on function public.technical_support_equipment_events(bigint) from public;
grant execute on function public.technical_support_equipment_events(bigint) to anon, authenticated;

revoke execute on function public.technical_support_event_equipment(bigint, bigint) from public;
grant execute on function public.technical_support_event_equipment(bigint, bigint) to anon, authenticated;

commit;
